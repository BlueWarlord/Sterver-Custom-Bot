const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const inventory = require("../economy/inventory");
const { formatAmount } = require("../utils/format");

function itemName(itemId) {
  const item = inventory.findItem(itemId);
  return item ? item.name : itemId;
}

module.exports = {
  name: "sell",
  aliases: [],
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
    return interaction.reply({
      content: `Sold ${qty}x ${itemName(id)} for ${formatAmount(res.total)}.`,
      allowedMentions: { parse: [] },
    });
  },
  async executePrefix(message, args) {
    const id = args[0];
    if (!id) {
      return message.reply({
        content: "Usage: .sell <item id> [quantity]",
        allowedMentions: { parse: [], repliedUser: false },
      });
    }

    let qty = 1;
    if (args[1] !== undefined) {
      if (!/^\d+$/.test(args[1])) {
        return message.reply({
          content: "Quantity must be a positive integer.",
          allowedMentions: { parse: [], repliedUser: false },
        });
      }
      qty = Number(args[1]);
    }

    const res = inventory.sellItem(message.author.id, id, qty);
    if (!res.ok) {
      if (res.code === "NOT_ENOUGH") return message.reply({ content: "You don't have enough.", allowedMentions: { parse: [], repliedUser: false } });
      if (res.code === "UNKNOWN_ITEM") return message.reply({ content: "Unknown item.", allowedMentions: { parse: [], repliedUser: false } });
      return message.reply({ content: "Sell failed.", allowedMentions: { parse: [], repliedUser: false } });
    }
    return message.reply({
      content: `Sold ${qty}x ${itemName(id)} for ${formatAmount(res.total)}.`,
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
};
