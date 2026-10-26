const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require("discord.js");
const config = require("../../config");
const { play } = require("../economy/games/coinflip");
const logger = require("../utils/logger");
const { formatAmount } = require("../utils/format");
const { getBetLimits, houseEdgeLabel, formatGamblingError } = require("./shared/gambling");

const PLAY_AGAIN_PREFIX = "coinflip:playagain:";
const BET_LIMITS = getBetLimits(config.gambling);

function parsePrefixArgs(args) {
  let bet = null;
  let guess = null;
  for (const arg of args) {
    if (bet === null && /^\d+$/.test(arg)) { bet = Number(arg); continue; }
    const lower = arg.toLowerCase();
    if (lower === "heads" || lower === "tails" || lower === "h" || lower === "t") {
      guess = lower === "h" ? "Heads" : lower === "t" ? "Tails" : lower[0].toUpperCase() + lower.slice(1);
    }
  }
  return { bet, guess };
}

function formatError(res) {
  const shared = formatGamblingError(res, config.gambling);
  if (shared) return shared;
  switch (res.code) {
    case "INVALID_GUESS": return "Guess must be Heads or Tails.";
    case "AMOUNT_OVERFLOW": return "That bet is too large to settle.";
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
    .setFooter({ text: `${user.username} · SterCoin · ${houseEdgeLabel(config.gambling)}` });
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

  const filter = (interaction) =>
    interaction.user.id === user.id &&
    interaction.guildId === config.discord.guildId &&
    interaction.customId.startsWith(PLAY_AGAIN_PREFIX);
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on("collect", async (interaction) => {
    try {
      const [betPart, guess] = interaction.customId.slice(PLAY_AGAIN_PREFIX.length).split(":");
      const bet = Number(betPart);
      const res = play(user.id, bet, guess);
      if (!res.ok) {
        await interaction.reply({ content: formatError(res), flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.update({
        embeds: [buildResultEmbed(user, res)],
        components: [buildPlayAgainRow(res.bet)],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      logger.error("coinflip collector error", { error });
    }
  });

  collector.on("end", () => {
    msg.edit({ components: [] }).catch(() => {});
  });
}

module.exports = {
  name: "coinflip",
  aliases: ["cf"],
  slash: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin and bet on the outcome")
    .addIntegerOption(o => o.setName("amount").setDescription("Bet amount").setRequired(true).setMinValue(BET_LIMITS.min).setMaxValue(BET_LIMITS.max))
    .addStringOption(o => o.setName("guess").setDescription("Your guess").setRequired(true)
      .addChoices({ name: "Heads", value: "Heads" }, { name: "Tails", value: "Tails" })),
  async executeSlash(interaction) {
    const bet = interaction.options.getInteger("amount");
    const guess = interaction.options.getString("guess");
    const res = play(interaction.user.id, bet, guess);
    if (!res.ok) return interaction.reply({ content: formatError(res), flags: MessageFlags.Ephemeral });
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
