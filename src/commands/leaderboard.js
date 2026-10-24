const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const { formatAmount } = require("../utils/format");

module.exports = {
  name: "leaderboard",
  aliases: ["lb"],
  slash: new SlashCommandBuilder().setName("leaderboard").setDescription("Top users"),
  async executeSlash(interaction) {
    const entries = wallet.getLeaderboard(config.leaderboard.size);
    if (entries.length === 0) return interaction.reply({ content: "Nobody has any SterCoins yet." });
    const lines = entries.map((e, i) => `${i+1}. <@${e.id}> — ${formatAmount(e.balance)}`).join("\n");
    await interaction.reply({ content: lines, allowedMentions: { parse: [] } });
  },
  async executePrefix(message) {
    const entries = wallet.getLeaderboard(config.leaderboard.size);
    if (entries.length === 0) return message.reply({ content: "Nobody has any SterCoins yet.", allowedMentions: { repliedUser: false } });
    const lines = entries.map((e, i) => `${i+1}. <@${e.id}> — ${formatAmount(e.balance)}`).join("\n");
    await message.reply({ content: lines, allowedMentions: { parse: [] } });
  },
};
