const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const inventory = require("../economy/inventory");
const { formatAmount } = require("../utils/format");

module.exports = {
  name: "sell",
  aliases: ["sellitem"],
  slash: new SlashCommandBuilder().setName("sell").setDescription("Sell an item")
    .addStringOption(o => o.setName("id").setDescription("Item ID").setRequired(true))
    .addIntegerOption(o => o.setName("quantity").setDescription("Quantity").setRequired(false).setMinValue(1)),
  async executeSlash(interaction) {
    const id = interaction.options.getString("id");
    const qty = interaction.options.getInteger("quantity") || 1;
    const res = inventory.sellItem(interaction.user.id, id, qty);
    if (!res.ok) {
      if (res.code === "NOT_ENOUGH") return interaction.reply({ content: "You don't have enough.", flags: MessageFlags.Ephemeral });
      if (res.code === "UNKNOWN_ITEM") return interaction.reply({ content: "Unknown item.", flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: "Sell failed.", flags: MessageFlags.Ephemeral });
    }
    const item = inventory.findItem(id);
    return interaction.reply({ content: `Sold ${qty}x ${item ? item.name : id} for ${formatAmount(res.total)}.` });
  },
  async executePrefix(message, args) {
    const id = args[0];
    const qtoken = args.find(t => /^\d+$/.test(t));
    const qty = qtoken ? parseInt(qtoken, 10) : 1;
    if (!id) return message.reply({ content: "Usage: .sell <item id> [quantity]", allowedMentions: { repliedUser: false } });
    const res = inventory.sellItem(message.author.id, id, qty);
    if (!res.ok) {
      if (res.code === "NOT_ENOUGH") return message.reply({ content: "You don't have enough.", allowedMentions: { repliedUser: false } });
      if (res.code === "UNKNOWN_ITEM") return message.reply({ content: "Unknown item.", allowedMentions: { repliedUser: false } });
      return message.reply({ content: "Sell failed.", allowedMentions: { repliedUser: false } });
    }
    const item = inventory.findItem(id);
    return message.reply({ content: `Sold ${qty}x ${item ? item.name : id} for ${formatAmount(res.total)}.`, allowedMentions: { parse: [] } });
  },
};
