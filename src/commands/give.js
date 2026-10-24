const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const { formatAmount } = require("../utils/format");

function validate(sender, target, amount) {
  if (!config.gift.enabled) return "Gifting is disabled.";
  if (!target) return "No target.";
  if (target.id === sender.id && !config.gift.allowSelf) return "Cannot gift yourself.";
  if (target.bot && !config.gift.allowBots) return "Cannot gift bots.";
  if (!Number.isInteger(amount) || amount <= 0) return "Invalid amount.";
  if (amount < config.gift.minAmount) return "Amount too small.";
  if (config.gift.maxAmount != null && amount > config.gift.maxAmount) return "Amount too large.";
  const bal = wallet.getBalance(sender.id);
  if (bal < amount) return `Insufficient funds. Balance: ${formatAmount(bal)}`;
  return null;
}

module.exports = {
  name: "give",
  aliases: ["pay"],
  slash: new SlashCommandBuilder().setName("give").setDescription("Gift SterCoins")
    .addUserOption(o=>o.setName("user").setDescription("Recipient").setRequired(true))
    .addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)),
  async executeSlash(interaction) {
    const target = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");
    const err = validate(interaction.user, target, amount);
    if (err) return interaction.reply({ content: err, flags: MessageFlags.Ephemeral });
    const res = wallet.transfer(interaction.user.id, target.id, amount);
    if (!res.ok) return interaction.reply({ content: "Transfer failed.", flags: MessageFlags.Ephemeral });
    await interaction.reply({ content: `${interaction.user} gave ${target} ${formatAmount(amount)}.` });
  },
  async executePrefix(message, args) {
    const target = message.mentions.users.first();
    const amtToken = args.find(t => /^\d+$/.test(t));
    const amount = amtToken ? parseInt(amtToken, 10) : NaN;
    const err = validate(message.author, target, amount);
    if (err) return message.reply({ content: err, allowedMentions: { repliedUser: false } });
    const res = wallet.transfer(message.author.id, target.id, amount);
    if (!res.ok) return message.reply({ content: "Transfer failed.", allowedMentions: { repliedUser: false } });
    await message.reply({ content: `${message.author} gave ${target} ${formatAmount(amount)}.`, allowedMentions: { parse: [] } });
  },
};
