const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const { play } = require("../economy/games/coinflip");
const { formatAmount, formatDuration } = require("../utils/format");

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

function formatResult(res, user) {
  const tag = user.toString();
  if (res.won) {
    return `${tag} flipped **${res.result}** — you won! +${formatAmount(res.profit)}. New balance: ${formatAmount(res.balance)}.`;
  }
  return `${tag} flipped **${res.result}** — you lost. -${formatAmount(Math.abs(res.profit))}. New balance: ${formatAmount(res.balance)}.`;
}

module.exports = {
  name: "coinflip",
  aliases: ["flip", "cf"],
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
    await interaction.reply({ content: formatResult(res, interaction.user), allowedMentions: { parse: [] } });
  },
  async executePrefix(message, args) {
    const parsed = parsePrefixArgs(args);
    const res = play(message.author.id, parsed.bet, parsed.guess);
    if (!res.ok) return message.reply({ content: formatError(res), allowedMentions: { repliedUser: false } });
    await message.reply({ content: formatResult(res, message.author), allowedMentions: { parse: [] } });
  },
};