const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const { formatAmount, formatDuration } = require("../utils/format");
const { now } = require("../utils/time");

module.exports = {
  name: "daily",
  slash: new SlashCommandBuilder().setName("daily").setDescription("Claim daily reward"),
  async executeSlash(interaction) {
    if (!config.daily.enabled) return interaction.reply({ content: "Daily rewards are disabled.", ephemeral: true });
    const res = wallet.claimDaily(interaction.user.id, now());
    if (!res.ok) return interaction.reply({ content: `You can claim again in ${formatDuration(res.remainingMs)}.`, ephemeral: true });
    await interaction.reply({ content: `You claimed ${formatAmount(res.amount)}. New balance: ${formatAmount(res.balance)}.` });
  },
  async executePrefix(message) {
    if (!config.daily.enabled) return message.reply({ content: "Daily rewards are disabled.", allowedMentions: { repliedUser: false } });
    const res = wallet.claimDaily(message.author.id, now());
    if (!res.ok) return message.reply({ content: `You can claim again in ${formatDuration(res.remainingMs)}.`, allowedMentions: { repliedUser: false } });
    await message.reply({ content: `You claimed ${formatAmount(res.amount)}. New balance: ${formatAmount(res.balance)}.`, allowedMentions: { repliedUser: false } });
  },
};
