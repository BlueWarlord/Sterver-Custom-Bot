const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const config = require("../../config");
const blackjack = require("../economy/games/blackjack");
const logger = require("../utils/logger");
const { formatAmount } = require("../utils/format");
const { getBetLimits, houseEdgeLabel, formatGamblingError } = require("./shared/gambling");

const PLAY_AGAIN_PREFIX = "blackjack:playagain:";
const NEW_BET_BUTTON = "blackjack:newbet";
const NEW_BET_PREFIX = "blackjack:newbet:";

function parsePrefixArgs(args) {
  let bet = null;
  for (const arg of args) {
    if (bet === null && /^\d+$/.test(arg)) {
      bet = Number(arg);
      continue;
    }
  }
  return { bet };
}

function formatError(res) {
  const shared = formatGamblingError(res, config.blackjack);
  if (shared) return shared;
  switch (res.code) {
    case "GAME_IN_PROGRESS": return "You already have an active blackjack game.";
    case "NO_GAME": return "You don't have an active blackjack game.";
    case "CANNOT_DOUBLE": return "You can only double on your first two cards.";
    default: return "Something went wrong.";
  }
}

function formatCards(cards) {
  if (!Array.isArray(cards)) return "";
  return cards.map(card => `${card.rank}${card.suit}`).join(" ");
}

function handTotal(cards) {
  if (!cards || !cards.length) return 0;
  return blackjack.handValue(cards);
}

function buildPlayingEmbed(user, game, res) {
  return new EmbedBuilder()
    .setTitle("Blackjack")
    .setColor(0x2ecc71)
    .addFields(
      { name: "Your Hand", value: `${formatCards(game.player)}\nTotal: ${handTotal(game.player)}`, inline: true },
      { name: "Dealer's Hand", value: `${formatCards([game.dealer[0]])} [Hidden]\nVisible: ${blackjack.handValue([game.dealer[0]])}`, inline: true },
      { name: "Bet", value: `${formatAmount(res.totalBet || game.totalBet || res.bet)}`, inline: false }
    )
    .setFooter({
      text: `Hit, Stand, or Double (Double only on first two cards) · ${houseEdgeLabel(config.blackjack)}`,
    });
}

function buildEndedEmbed(user, res) {
  const playerTotal = handTotal(res.player);
  const dealerTotal = handTotal(res.dealer);
  let description = "";
  if (res.result === "BLACKJACK") description = `Blackjack! You win ${formatAmount(res.profit)}.`;
  else if (res.result === "WIN") description = `You win! +${formatAmount(res.profit)}.`;
  else if (res.result === "LOSE") description = `You lose. -${formatAmount(Math.abs(res.profit))}.`;
  else if (res.result === "PUSH") description = "Push. Bet returned.";

  return new EmbedBuilder()
    .setTitle("Blackjack - Result")
    .setColor(res.result === "WIN" || res.result === "BLACKJACK" ? 0x2ecc71 : res.result === "PUSH" ? 0xf1c40f : 0xe74c3c)
    .setDescription(description)
    .addFields(
      { name: "Your Hand", value: `${formatCards(res.player)}\nTotal: ${playerTotal}`, inline: true },
      { name: "Dealer's Hand", value: `${formatCards(res.dealer)}\nTotal: ${dealerTotal}`, inline: true },
      { name: "Profit/Loss", value: res.profit >= 0 ? `+${formatAmount(res.profit)}` : `-${formatAmount(Math.abs(res.profit))}`, inline: true },
      { name: "New Balance", value: `${formatAmount(res.balance)}`, inline: true }
    )
    .setFooter({ text: `SterCoin Blackjack · ${houseEdgeLabel(config.blackjack)}` });
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
  const limits = getBetLimits(config.blackjack);
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

  const filter = (interaction) =>
    interaction.user.id === user.id &&
    interaction.guildId === config.discord.guildId &&
    interaction.customId.startsWith("blackjack:");
  // Use idle rather than an absolute lifetime so every action resets the
  // per-turn timer. The server-side game timer is the authoritative fallback.
  const collector = msg.createMessageComponentCollector({
    filter,
    idle: getTimeoutMs() + 5000,
  });
  const ownedGame = blackjack.getGame(user.id) || null;

  const endGame = async (interaction, res) => {
    await interaction.update({
      embeds: [buildEndedEmbed(user, res)],
      components: [buildPlayAgainRow(res.bet)],
      allowedMentions: { parse: [] },
    });
  };

  const fail = async (interaction, res) => {
    await interaction.update({
      content: formatError(res),
      embeds: [],
      components: [],
      allowedMentions: { parse: [] },
    });
    collector.stop("err");
  };

  // Replays in the same message, exactly like clicking again in coinflip.
  const replay = async (interaction, bet) => {
    const started = startGame(user, bet);
    if (!started.ok) {
      await interaction.reply({ content: started.error, flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }
    collector.stop("replay");
    try {
      await interaction.update(started.payload);
      attachCollector(interaction.message, user);
    } catch (error) {
      logger.warn("blackjack replay update failed", { error });
    }
  };

  const askNewBet = async (interaction) => {
    try {
      await interaction.update({
        embeds: [new EmbedBuilder().setTitle("Blackjack - Choose New Bet").setDescription("Select a bet amount").setColor(0x3498db)],
        components: [buildBetButtons()],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      logger.warn("blackjack new-bet update failed", { error });
    }
  };

  // The game module owns the server-side timer. When it settles the hand, stop
  // the collector and render the result so the message cannot stay stale.
  if (ownedGame) {
    blackjack.setTimeoutHandler(user.id, async (res) => {
      try {
        collector.stop("timeout");
      } catch (_) {}
      try {
        await msg.edit({
          embeds: [buildEndedEmbed(user, res)],
          components: [buildPlayAgainRow(res.bet)],
          allowedMentions: { parse: [] },
        });
        attachCollector(msg, user);
      } catch (error) {
        logger.warn("blackjack timeout update failed", { error });
      }
    });
  }

  collector.on("collect", async (interaction) => {
    try {
      if (interaction.customId.startsWith(PLAY_AGAIN_PREFIX)) {
        const bet = Number(interaction.customId.slice(PLAY_AGAIN_PREFIX.length));
        await replay(interaction, bet);
        return;
      }

      if (interaction.customId === NEW_BET_BUTTON || interaction.customId.startsWith(NEW_BET_PREFIX)) {
        if (interaction.customId.startsWith(NEW_BET_PREFIX) && interaction.customId !== NEW_BET_BUTTON) {
          const bet = Number(interaction.customId.slice(NEW_BET_PREFIX.length));
          await replay(interaction, bet);
          return;
        }
        await askNewBet(interaction);
        return;
      }

      if (interaction.customId === "blackjack:hit") {
        const hitResult = blackjack.hit(user.id);
        if (!hitResult.ok) return fail(interaction, hitResult);
        if (hitResult.ended) return endGame(interaction, hitResult);
        const game = blackjack.getGame(user.id);
        await interaction.update({
          embeds: [buildPlayingEmbed(user, game, hitResult)],
          components: [buildRow(false)],
          allowedMentions: { parse: [] },
        });
        return;
      }

      if (interaction.customId === "blackjack:stand") {
        const standResult = blackjack.stand(user.id);
        if (!standResult.ok) return fail(interaction, standResult);
        return endGame(interaction, standResult);
      }

      if (interaction.customId === "blackjack:double") {
        const doubleResult = blackjack.double(user.id);
        if (!doubleResult.ok) return fail(interaction, doubleResult);
        return endGame(interaction, doubleResult);
      }
    } catch (error) {
      logger.error("blackjack collector error", { error });
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (reason !== "idle" && reason !== "time") return;

    if (!ownedGame || blackjack.getGame(user.id) !== ownedGame) {
      // The game already finished (or was replaced by a newer one); keep the
      // result embed and just drop the buttons.
      try {
        await msg.edit({ components: [] });
      } catch (_) {}
      return;
    }

    const timeoutResult = blackjack.forceStandTimeout(user.id);
    if (timeoutResult && timeoutResult.ok && timeoutResult.ended) {
      try {
        await msg.edit({
          embeds: [buildEndedEmbed(user, timeoutResult)],
          components: [buildPlayAgainRow(timeoutResult.bet)],
          allowedMentions: { parse: [] },
        });
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
      const limits = getBetLimits(config.blackjack);
      return o.setName("bet").setDescription("Bet amount").setRequired(true).setMinValue(limits.min).setMaxValue(limits.max);
    }),
  async executeSlash(interaction) {
    const started = startGame(interaction.user, interaction.options.getInteger("bet"));
    if (!started.ok) return interaction.reply({ content: started.error, flags: MessageFlags.Ephemeral });

    let message;
    try {
      message = await interaction.reply({ ...started.payload, fetchReply: true });
    } catch (error) {
      // The game was already created and the bet debited. Settle it instead of
      // leaving the user permanently locked out.
      blackjack.forceStandTimeout(interaction.user.id);
      throw error;
    }
    attachCollector(message, interaction.user);
  },
  async executePrefix(message, args) {
    const parsed = parsePrefixArgs(args);
    const started = startGame(message.author, parsed.bet);
    if (!started.ok) return message.reply({ content: started.error, allowedMentions: { parse: [], repliedUser: false } });

    let reply;
    try {
      reply = await message.reply(started.payload);
    } catch (error) {
      blackjack.forceStandTimeout(message.author.id);
      throw error;
    }
    attachCollector(reply, message.author);
  },
};
