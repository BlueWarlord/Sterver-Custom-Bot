const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const { formatAmount } = require("../utils/format");
const { firstExplicitMentionedUser, stripMentionTokens } = require("../utils/mentions");

function accountAgeError(user) {
  const minDays = config.gift.minAccountAgeDays;
  if (!Number.isInteger(minDays) || minDays <= 0) return null;
  if (!user || typeof user.createdTimestamp !== "number") return null;
  const minAgeMs = minDays * 24 * 60 * 60 * 1000;
  if (Date.now() - user.createdTimestamp < minAgeMs) {
    return `Your account must be at least ${minDays} day(s) old to gift SterCoins.`;
  }
  return null;
}

function validate(sender, target, amount) {
  if (!config.gift.enabled) return "Gifting is disabled.";
  if (!target) return "No target. Mention a user explicitly.";
  if (target.id === sender.id && !config.gift.allowSelf) return "Cannot gift yourself.";
  if (target.bot && !config.gift.allowBots) return "Cannot gift bots.";
  if (!Number.isSafeInteger(amount) || amount <= 0) return "Invalid amount.";
  if (amount < config.gift.minAmount) return "Amount too small.";
  if (config.gift.maxAmount != null && amount > config.gift.maxAmount) return "Amount too large.";
  const ageError = accountAgeError(sender);
  if (ageError) return ageError;
  const balance = wallet.getBalance(sender.id);
  if (balance < amount) return `Insufficient funds. Balance: ${formatAmount(balance)}`;
  return null;
}

function transferErrorMessage(res) {
  if (res.code === "GIFT_LIMIT") {
    return `Daily gifting limit reached. You can gift ${formatAmount(res.remaining)} more today.`;
  }
  if (res.code === "INSUFFICIENT_FUNDS") {
    return `Insufficient funds. Balance: ${formatAmount(res.balance)}`;
  }
  return "Transfer failed.";
}

module.exports = {
  name: "give",
  aliases: ["pay"],
  slash: new SlashCommandBuilder().setName("give").setDescription("Gift SterCoins")
    .addUserOption(o => o.setName("user").setDescription("Recipient").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)),
  async executeSlash(interaction) {
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const err = validate(interaction.user, target, amount);
    if (err) return interaction.reply({ content: err, flags: MessageFlags.Ephemeral });
    const res = wallet.transfer(interaction.user.id, target.id, amount);
    if (!res.ok) {
      return interaction.reply({
        content: transferErrorMessage(res),
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.reply({
      content: `${interaction.user} gave ${target} ${formatAmount(amount)}.`,
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
  async executePrefix(message, args) {
    const target = firstExplicitMentionedUser(message);
    const tokens = stripMentionTokens(args);
    const amountToken = tokens.find((token) => /^\d+$/.test(token));
    const amount = amountToken ? Number(amountToken) : NaN;
    const err = validate(message.author, target, amount);
    if (err) return message.reply({ content: err, allowedMentions: { parse: [], repliedUser: false } });
    const res = wallet.transfer(message.author.id, target.id, amount);
    if (!res.ok) {
      return message.reply({
        content: transferErrorMessage(res),
        allowedMentions: { parse: [], repliedUser: false },
      });
    }
    await message.reply({
      content: `${message.author} gave ${target} ${formatAmount(amount)}.`,
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
};
