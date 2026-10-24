const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const config = require("../../config");
const blackjack = require("../economy/games/blackjack");
const { formatAmount, formatDuration } = require("../utils/format");

function parsePrefixArgs(args) {
  let bet = null;
  for (const arg of args) {
    if (bet === null && /^\d+$/.test(arg)) { bet = parseInt(arg, 10); continue; }
  }
  return { bet };
}

function formatError(res) {
  switch (res.code) {
    case "GAMBLING_DISABLED": return "Gambling is currently disabled.";
    case "INVALID_BET": return "Invalid bet amount.";
    case "BET_TOO_SMALL": return `Minimum bet is ${formatAmount((config.blackjack && config.blackjack.minBet) || config.gambling.minBet)}.`;
    case "BET_TOO_LARGE": return `Maximum bet is ${formatAmount((config.blackjack && config.blackjack.maxBet) || config.gambling.maxBet)}.`;
    case "INSUFFICIENT_FUNDS": return `Insufficient funds. Balance: ${formatAmount(res.balance)}.`;
    case "ON_COOLDOWN": return `You're on cooldown. Try again in ${formatDuration(res.remainingMs)}.`;
    case "GAME_IN_PROGRESS": return "You already have an active blackjack game.";
    case "NO_GAME": return "You don't have an active blackjack game.";
    case "CANNOT_DOUBLE": return "You can only double on your first two cards.";
    default: return "Something went wrong.";
  }
}

function formatCards(cards) {
  if (!Array.isArray(cards)) return "";
  return cards.map(c => `${c.rank}${c.suit}`).join(" ");
}

function handTotal(cards) {
  if (!cards || !cards.length) return 0;
  return blackjack.handValue(cards);
}

function buildPlayingEmbed(user, game, res) {
  const embed = new EmbedBuilder()
    .setTitle("Blackjack")
    .setColor(0x2ecc71)
    .addFields(
      { name: "Your Hand", value: `${formatCards(game.player)}\nTotal: ${handTotal(game.player)}`, inline: true },
      { name: "Dealer's Hand", value: `${formatCards([game.dealer[0]])} [Hidden]\nVisible: ${blackjack.handValue([game.dealer[0]])}`, inline: true },
      { name: "Bet", value: `${formatAmount(res.totalBet || game.totalBet || res.bet)}`, inline: false }
    )
    .setFooter({ text: "Hit, Stand, or Double (Double only on first two cards)" });
  return embed;
}

function buildEndedEmbed(user, res) {
  const playerTotal = handTotal(res.player);
  const dealerTotal = handTotal(res.dealer);
  let desc = "";
  if (res.result === "BLACKJACK") desc = `Blackjack! You win ${formatAmount(res.profit)}.`;
  else if (res.result === "WIN") desc = `You win! +${formatAmount(res.profit)}.`;
  else if (res.result === "LOSE") desc = `You lose. -${formatAmount(Math.abs(res.profit))}.`;
  else if (res.result === "PUSH") desc = "Push. Bet returned.";
  const embed = new EmbedBuilder()
    .setTitle("Blackjack - Result")
    .setColor(res.result === "WIN" || res.result === "BLACKJACK" ? 0x2ecc71 : res.result === "PUSH" ? 0xf1c40f : 0xe74c3c)
    .setDescription(desc)
    .addFields(
      { name: "Your Hand", value: `${formatCards(res.player)}\nTotal: ${playerTotal}`, inline: true },
      { name: "Dealer's Hand", value: `${formatCards(res.dealer)}\nTotal: ${dealerTotal}`, inline: true },
      { name: "Profit/Loss", value: res.profit >= 0 ? `+${formatAmount(res.profit)}` : `-${formatAmount(Math.abs(res.profit))}`, inline: true },
      { name: "New Balance", value: `${formatAmount(res.balance)}`, inline: true }
    );
  return embed;
}

function buildRow(canDouble) {
  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder().setCustomId("blackjack:hit").setLabel("Hit").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("blackjack:stand").setLabel("Stand").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("blackjack:double").setLabel("Double").setStyle(ButtonStyle.Success).setDisabled(!canDouble)
  );
  return row;
}

module.exports = {
  name: "blackjack",
  aliases: ["bj"],
  slash: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play blackjack")
    .addIntegerOption(o => {
      const bj = config.blackjack || {};
      const minB = bj.minBet != null ? bj.minBet : config.gambling.minBet;
      const maxB = bj.maxBet != null ? bj.maxBet : config.gambling.maxBet;
      return o.setName("bet").setDescription("Bet amount").setRequired(true).setMinValue(minB).setMaxValue(maxB);
    }),
  async executeSlash(interaction) {
    const bet = interaction.options.getInteger("bet");
    const res = blackjack.start(interaction.user.id, bet);
    if (!res.ok) return interaction.reply({ content: formatError(res), ephemeral: true });
    if (res.ended) {
      const embed = buildEndedEmbed(interaction.user, res);
      return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
    const game = blackjack.getGame(interaction.user.id);
    const embed = buildPlayingEmbed(interaction.user, game, res);
    const row = buildRow(res.canDouble !== false);
    const msg = await interaction.reply({ embeds: [embed], components: [row], allowedMentions: { parse: [] }, fetchReply: true });

    const filter = i => i.user.id === interaction.user.id && i.customId.startsWith("blackjack:");
    const collector = msg.createMessageComponentCollector({ filter, time: (config.blackjack && config.blackjack.timeoutMs) || 60000 });

    collector.on("collect", async i => {
      try {
        if (i.customId === "blackjack:hit") {
          const hres = blackjack.hit(interaction.user.id);
          if (!hres.ok) {
            await i.update({ content: formatError(hres), embeds: [], components: [], allowedMentions: { parse: [] } });
            collector.stop("err");
            return;
          }
          if (hres.ended) {
            await i.update({ embeds: [buildEndedEmbed(interaction.user, hres)], components: [], allowedMentions: { parse: [] } });
            collector.stop("done");
            return;
          }
          const g = blackjack.getGame(interaction.user.id);
          await i.update({ embeds: [buildPlayingEmbed(interaction.user, g, hres)], components: [buildRow(false)], allowedMentions: { parse: [] } });
          return;
        } else if (i.customId === "blackjack:stand") {
          const sres = blackjack.stand(interaction.user.id);
          if (!sres.ok) {
            await i.update({ content: formatError(sres), embeds: [], components: [], allowedMentions: { parse: [] } });
            collector.stop("err");
            return;
          }
          await i.update({ embeds: [buildEndedEmbed(interaction.user, sres)], components: [], allowedMentions: { parse: [] } });
          collector.stop("done");
          return;
        } else if (i.customId === "blackjack:double") {
          const dres = blackjack.double(interaction.user.id);
          if (!dres.ok) {
            await i.update({ content: formatError(dres), embeds: [], components: [], allowedMentions: { parse: [] } });
            collector.stop("err");
            return;
          }
          await i.update({ embeds: [buildEndedEmbed(interaction.user, dres)], components: [], allowedMentions: { parse: [] } });
          collector.stop("done");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        const tres = blackjack.forceStandTimeout(interaction.user.id);
        if (tres && tres.ok && tres.ended) {
          try {
            await msg.edit({ embeds: [buildEndedEmbed(interaction.user, tres)], components: [], allowedMentions: { parse: [] } });
            return;
          } catch (_) {}
        }
        try {
          await msg.edit({ content: "Blackjack timed out.", embeds: [], components: [], allowedMentions: { parse: [] } });
        } catch (_) {}
      }
    });
  },
  async executePrefix(message, args) {
    const parsed = parsePrefixArgs(args);
    const res = blackjack.start(message.author.id, parsed.bet);
    if (!res.ok) return message.reply({ content: formatError(res), allowedMentions: { repliedUser: false } });
    if (res.ended) {
      const embed = buildEndedEmbed(message.author, res);
      return message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }
    const game = blackjack.getGame(message.author.id);
    const embed = buildPlayingEmbed(message.author, game, res);
    const row = buildRow(res.canDouble !== false);
    const msg = await message.reply({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });

    const filter = i => i.user.id === message.author.id && i.customId.startsWith("blackjack:");
    const collector = msg.createMessageComponentCollector({ filter, time: (config.blackjack && config.blackjack.timeoutMs) || 60000 });

    collector.on("collect", async i => {
      try {
        if (i.customId === "blackjack:hit") {
          const hres = blackjack.hit(message.author.id);
          if (!hres.ok) {
            await i.update({ content: formatError(hres), embeds: [], components: [], allowedMentions: { parse: [] } });
            collector.stop("err");
            return;
          }
          if (hres.ended) {
            await i.update({ embeds: [buildEndedEmbed(message.author, hres)], components: [], allowedMentions: { parse: [] } });
            collector.stop("done");
            return;
          }
          const g = blackjack.getGame(message.author.id);
          await i.update({ embeds: [buildPlayingEmbed(message.author, g, hres)], components: [buildRow(false)], allowedMentions: { parse: [] } });
          return;
        } else if (i.customId === "blackjack:stand") {
          const sres = blackjack.stand(message.author.id);
          if (!sres.ok) {
            await i.update({ content: formatError(sres), embeds: [], components: [], allowedMentions: { parse: [] } });
            collector.stop("err");
            return;
          }
          await i.update({ embeds: [buildEndedEmbed(message.author, sres)], components: [], allowedMentions: { parse: [] } });
          collector.stop("done");
          return;
        } else if (i.customId === "blackjack:double") {
          const dres = blackjack.double(message.author.id);
          if (!dres.ok) {
            await i.update({ content: formatError(dres), embeds: [], components: [], allowedMentions: { parse: [] } });
            collector.stop("err");
            return;
          }
          await i.update({ embeds: [buildEndedEmbed(message.author, dres)], components: [], allowedMentions: { parse: [] } });
          collector.stop("done");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        const tres = blackjack.forceStandTimeout(message.author.id);
        if (tres && tres.ok && tres.ended) {
          try {
            await msg.edit({ embeds: [buildEndedEmbed(message.author, tres)], components: [], allowedMentions: { parse: [] } });
            return;
          } catch (_) {}
        }
        try {
          await msg.edit({ content: "Blackjack timed out.", embeds: [], components: [], allowedMentions: { parse: [] } });
        } catch (_) {}
      }
    });
  },
};
