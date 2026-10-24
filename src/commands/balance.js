const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const config = require("../../config");
const wallet = require("../economy/wallet");
const store = require("../economy/store");
const { formatAmount } = require("../utils/format");

module.exports = {
  name: "balance",
  slash: new SlashCommandBuilder().setName("balance").setDescription("Show balance").addUserOption(o=>o.setName("user").setDescription("User").setRequired(false)),
  async executeSlash(interaction) {
    const target = interaction.options.getUser("user") || interaction.user;
    if (target.bot) return interaction.reply({ content: "Bots don't have balances.", flags: MessageFlags.Ephemeral });
    const bal = wallet.getBalance(target.id);
    await interaction.reply({ content: `${target}'s balance: ${formatAmount(bal)}` });
  },
  async executePrefix(message, args) {
    let target = message.mentions.users.first() || message.author;
    if (target.bot) return message.reply({ content: "Bots don't have balances.", allowedMentions: { repliedUser: false } });
    const bal = wallet.getBalance(target.id);
    await message.reply({ content: `${target}'s balance: ${formatAmount(bal)}`, allowedMentions: { parse: [] } });
  },
};
