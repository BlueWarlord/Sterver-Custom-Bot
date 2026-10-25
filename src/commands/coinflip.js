const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const config = require("../../config");
const { play } = require("../economy/games/coinflip");
const { formatAmount, formatDuration } = require("../utils/format");

const PLAY_AGAIN_PREFIX = "coinflip:playagain:";

function parsePrefixArgs(args) {
  let bet = null;
  let guess = null;
  for (const arg of args) {
    if (bet === null && /^\d+$/.test(arg)) { bet = parseInt(arg, 10); continue; }
    const lower = arg.toLowerCase();
    if (lower === "heads" || lower === "tails" || lower === "h" || lower === "t") {
      guess = lower === "h" ? "Heads" : lower === "t" ? "Tails" : lower[0].toUpperCase() + lower.slice(1);
    }
  }
  return { bet, guess };
}

function formatError(res) {
  switch (res.code) {
    case "GAMBLING_DISABLED": return "Gambling is currently disabled.";
    case "INVALID_BET": return "Invalid bet amount.";
    case "BET_TOO_SMALL": return `Minimum bet is ${formatAmount(config.gambling.minBet)}.`;
    case "BET_TOO_LARGE": return `Maximum bet is ${formatAmount(config.gambling.maxBet)}.`;
    case "INSUFFICIENT_FUNDS": return `Insufficient funds. Balance: ${formatAmount(res.balance)}.`;
    case "ON_COOLDOWN": return `You're on cooldown. Try again in ${formatDuration(res.remainingMs)}.`;
    case "INVALID_GUESS": return "Guess must be Heads or Tails.";
    default: return "Something went wrong.";
  }
}

function buildResultEmbed(user, res) {
  const embed = new EmbedBuilder()
    .setTitle(res.won ? "🪙 Coinflip - You Win!" : "🪙 Coinflip - You Lose")
    .setColor(res.won ? 0x2ecc71 : 0xe74c3c)
    .addFields(
      { name: "Result", value: `**${res.result}**`, inline: true },
      { name: "Your Guess", value: res.guess, inline: true },
      { name: "Bet", value: formatAmount(res.bet), inline: true },
      { name: "Profit/Loss", value: res.profit >= 0 ? `+${formatAmount(res.profit)}` : `-${formatAmount(Math.abs(res.profit))}`, inline: true },
      { name: "New Balance", value: formatAmount(res.balance), inline: true }
    )
    .setFooter({ text: `${user.username} · SterCoin` });
  return embed;
}

function buildPlayAgainRow(bet) {
  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${PLAY_AGAIN_PREFIX}${bet}:Heads`)
      .setLabel("Heads")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${PLAY_AGAIN_PREFIX}${bet}:Tails`)
      .setLabel("Tails")
      .setStyle(ButtonStyle.Secondary)
  );
  return row;
}

function attachCollector(msg, user) {
  if (!msg || typeof msg.createMessageComponentCollector !== "function") return;

  const filter = i => i.user.id === user.id && i.customId.startsWith(PLAY_AGAIN_PREFIX);
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on("collect", async i => {
    try {
      const [betPart, guess] = i.customId.slice(PLAY_AGAIN_PREFIX.length).split(":");
      const bet = parseInt(betPart, 10);
      const res = play(user.id, bet, guess);
      if (!res.ok) {
        await i.reply({ content: formatError(res), ephemeral: true });
        return;
      }
      await i.update({ embeds: [buildResultEmbed(user, res)], components: [buildPlayAgainRow(res.bet)], allowedMentions: { parse: [] } });
    } catch (e) {
      console.error(e);
    }
  });

  collector.on("end", () => {
    try { msg.edit({ components: [] }); } catch (_) {}
  });
}

module.exports = {
  name: "coinflip",
  aliases: ["cf"],
  slash: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin and bet on the outcome")
    .addIntegerOption(o => o.setName("amount").setDescription("Bet amount").setRequired(true).setMinValue(config.gambling.minBet).setMaxValue(config.gambling.maxBet))
    .addStringOption(o => o.setName("guess").setDescription("Your guess").setRequired(true)
      .addChoices({ name: "Heads", value: "Heads" }, { name: "Tails", value: "Tails" })),
  async executeSlash(interaction) {
    const bet = interaction.options.getInteger("amount");
    const guess = interaction.options.getString("guess");
    const res = play(interaction.user.id, bet, guess);
    if (!res.ok) return interaction.reply({ content: formatError(res), ephemeral: true });
    const embed = buildResultEmbed(interaction.user, res);
    const row = buildPlayAgainRow(res.bet);
    const msg = await interaction.reply({ embeds: [embed], components: [row], allowedMentions: { parse: [] }, fetchReply: true });
    attachCollector(msg, interaction.user);
  },
  async executePrefix(message, args) {
    const parsed = parsePrefixArgs(args);
    const res = play(message.author.id, parsed.bet, parsed.guess);
    if (!res.ok) return message.reply({ content: formatError(res), allowedMentions: { repliedUser: false } });
    const embed = buildResultEmbed(message.author, res);
    const row = buildPlayAgainRow(res.bet);
    const msg = await message.reply({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
    attachCollector(msg, message.author);
  },
};
