const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const config = require("../../config");
const blackjack = require("../economy/games/blackjack");
const { formatAmount, formatDuration } = require("../utils/format");

const PLAY_AGAIN_PREFIX = "blackjack:playagain:";
const NEW_BET_BUTTON = "blackjack:newbet";
const NEW_BET_PREFIX = "blackjack:newbet:";
// const NEW_BET_MODAL_PREFIX = "blackjack:newbet:";

function getBetLimits() {
  const bj = config.blackjack || {};
  return {
    min: bj.minBet != null ? bj.minBet : config.gambling.minBet,
    max: bj.maxBet != null ? bj.maxBet : config.gambling.maxBet,
  };
}

function parsePrefixArgs(args) {
  let bet = null;
  for (const arg of args) {
    if (bet === null && /^\d+$/.test(arg)) { bet = parseInt(arg, 10); continue; }
  }
  return { bet };
}

function formatError(res) {
  const limits = getBetLimits();
  switch (res.code) {
    case "GAMBLING_DISABLED": return "Gambling is currently disabled.";
    case "INVALID_BET": return "Invalid bet amount.";
    case "BET_TOO_SMALL": return `Minimum bet is ${formatAmount(limits.min)}.`;
    case "BET_TOO_LARGE": return `Maximum bet is ${formatAmount(limits.max)}.`;
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

function buildPlayAgainRow(bet) {
  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${PLAY_AGAIN_PREFIX}${bet}`)
      .setLabel("Play Again (Previous bet)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(NEW_BET_BUTTON)
      .setLabel("Play Again (New bet)")
      .setStyle(ButtonStyle.Secondary)
  );
  return row;
}

function buildBetButtons() {
  const limits = getBetLimits();
  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${NEW_BET_PREFIX}${limits.min}`)
      .setLabel(`${formatAmount(limits.min)}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${NEW_BET_PREFIX}${Math.floor((limits.min + limits.max) / 2)}`)
      .setLabel(`${formatAmount(Math.floor((limits.min + limits.max) / 2))}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${NEW_BET_PREFIX}${limits.max}`)
      .setLabel(`${formatAmount(limits.max)}`)
      .setStyle(ButtonStyle.Success)
  );
  return row;
}

function getTimeoutMs() {
  return (config.blackjack && config.blackjack.timeoutMs) || 60000;
}

/**
 * Starts a game and returns the payload that renders it, without sending anything.
 */
function startGame(user, bet) {
  const res = blackjack.start(user.id, bet);
  if (!res.ok) return { ok: false, res, error: formatError(res) };

  if (res.ended) {
    return {
      ok: true,
      res,
      payload: {
        embeds: [buildEndedEmbed(user, res)],
        components: [buildPlayAgainRow(res.bet)],
        allowedMentions: { parse: [] },
      },
    };
  }

  const game = blackjack.getGame(user.id);
  return {
    ok: true,
    res,
    payload: {
      embeds: [buildPlayingEmbed(user, game, res)],
      components: [buildRow(res.canDouble !== false)],
      allowedMentions: { parse: [] },
    },
  };
}

function attachCollector(msg, user) {
  if (!msg || typeof msg.createMessageComponentCollector !== "function") return;

  const filter = i => i.user.id === user.id && i.customId.startsWith("blackjack:");
  const collector = msg.createMessageComponentCollector({ filter, time: getTimeoutMs() });
  // The game this message belongs to (null when the message already shows a result).
  const ownedGame = blackjack.getGame(user.id) || null;

  const endGame = async (i, res) => {
    await i.update({
      embeds: [buildEndedEmbed(user, res)],
      components: [buildPlayAgainRow(res.bet)],
      allowedMentions: { parse: [] },
    });
  };

  const fail = async (i, res) => {
    await i.update({ content: formatError(res), embeds: [], components: [], allowedMentions: { parse: [] } });
    collector.stop("err");
  };

  // Replays in the same message, exactly like clicking again in coinflip.
  const replay = async (i, bet) => {
    const started = startGame(user, bet);
    if (!started.ok) {
      await i.reply({ content: started.error, ephemeral: true }).catch(() => {});
      return;
    }
    collector.stop("replay");
    try {
      await i.update(started.payload);
      attachCollector(i.message, user);
    } catch (e) {
      console.error(e);
    }
  };

  const askNewBet = async (i) => {
    // Show bet selection buttons in the same message
    const betRow = buildBetButtons();
    try {
      await i.update({
        embeds: [new EmbedBuilder().setTitle("Blackjack - Choose New Bet").setDescription("Select a bet amount").setColor(0x3498db)],
        components: [betRow],
        allowedMentions: { parse: [] },
      });
    } catch (e) {
      console.error(e);
      return;
    }
  };

  collector.on("collect", async i => {
    try {
      if (i.customId.startsWith(PLAY_AGAIN_PREFIX)) {
        const bet = parseInt(i.customId.slice(PLAY_AGAIN_PREFIX.length), 10);
        await replay(i, bet);
        return;
      }

      if (i.customId === NEW_BET_BUTTON || i.customId.startsWith(NEW_BET_PREFIX)) {
        if (i.customId.startsWith(NEW_BET_PREFIX) && i.customId !== NEW_BET_BUTTON) {
          const betStr = i.customId.slice(NEW_BET_PREFIX.length);
          const bet = parseInt(betStr, 10);
          await replay(i, bet);
          return;
        }
        await askNewBet(i);
        return;
      }

      if (i.customId === "blackjack:hit") {
        const hres = blackjack.hit(user.id);
        if (!hres.ok) return fail(i, hres);
        if (hres.ended) return endGame(i, hres);
        const game = blackjack.getGame(user.id);
        await i.update({ embeds: [buildPlayingEmbed(user, game, hres)], components: [buildRow(false)], allowedMentions: { parse: [] } });
        return;
      }

      if (i.customId === "blackjack:stand") {
        const sres = blackjack.stand(user.id);
        if (!sres.ok) return fail(i, sres);
        return endGame(i, sres);
      }

      if (i.customId === "blackjack:double") {
        const dres = blackjack.double(user.id);
        if (!dres.ok) return fail(i, dres);
        return endGame(i, dres);
      }
    } catch (e) {
      console.error(e);
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (reason !== "time") return;

    if (!ownedGame || blackjack.getGame(user.id) !== ownedGame) {
      // The game already finished (or was replaced by a newer one); keep the
      // result embed and just drop the buttons.
      try { await msg.edit({ components: [] }); } catch (_) {}
      return;
    }

    const tres = blackjack.forceStandTimeout(user.id);
    if (tres && tres.ok && tres.ended) {
      try {
        await msg.edit({ embeds: [buildEndedEmbed(user, tres)], components: [buildPlayAgainRow(tres.bet)], allowedMentions: { parse: [] } });
        attachCollector(msg, user);
        return;
      } catch (_) {}
    }
    try {
      await msg.edit({ content: "Blackjack timed out.", embeds: [], components: [], allowedMentions: { parse: [] } });
    } catch (_) {}
  });
}

module.exports = {
  name: "blackjack",
  aliases: ["bj"],
  slash: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play blackjack")
    .addIntegerOption(o => {
      const limits = getBetLimits();
      return o.setName("bet").setDescription("Bet amount").setRequired(true).setMinValue(limits.min).setMaxValue(limits.max);
    }),
  async executeSlash(interaction) {
    const started = startGame(interaction.user, interaction.options.getInteger("bet"));
    if (!started.ok) return interaction.reply({ content: started.error, ephemeral: true });
    const msg = await interaction.reply({ ...started.payload, fetchReply: true });
    attachCollector(msg, interaction.user);
  },
  async executePrefix(message, args) {
    const parsed = parsePrefixArgs(args);
    const started = startGame(message.author, parsed.bet);
    if (!started.ok) return message.reply({ content: started.error, allowedMentions: { repliedUser: false } });
    const msg = await message.reply(started.payload);
    attachCollector(msg, message.author);
  },
};
