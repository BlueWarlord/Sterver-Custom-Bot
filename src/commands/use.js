const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const inventory = require("../economy/inventory");
const { formatAmount } = require("../utils/format");

function itemName(itemId) {
  const item = inventory.findItem(itemId);
  return item ? item.name : itemId;
}

function useErrorMessage(res) {
  switch (res.code) {
    case "NOT_OWNED":
      return "You don't own that item.";
    case "UNKNOWN_ITEM":
      return "Unknown item.";
    case "NOT_USABLE":
      return "That item has no use effect, so it was not consumed.";
    case "INVALID_EFFECT":
      return "That item is misconfigured and cannot be used.";
    default:
      return "Failed to use item.";
  }
}

function successMessage(res) {
  return `You used ${itemName(res.itemId)} and received ${formatAmount(res.amount)}.`;
}

module.exports = {
  name: "use",
  aliases: [],
  slash: new SlashCommandBuilder().setName("use").setDescription("Use an item")
    .addStringOption(o => o.setName("id").setDescription("Item ID").setRequired(true)),
  async executeSlash(interaction) {
    const id = interaction.options.getString("id");
    const res = inventory.useItem(interaction.user.id, id);
    if (!res.ok) {
      return interaction.reply({ content: useErrorMessage(res), flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({
      content: successMessage(res),
      allowedMentions: { parse: [] },
    });
  },
  async executePrefix(message, args) {
    const id = args[0];
    if (!id) {
      return message.reply({
        content: "Usage: .use <item id>",
        allowedMentions: { parse: [], repliedUser: false },
      });
    }
    const res = inventory.useItem(message.author.id, id);
    if (!res.ok) {
      return message.reply({
        content: useErrorMessage(res),
        allowedMentions: { parse: [], repliedUser: false },
      });
    }
    return message.reply({
      content: successMessage(res),
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
};
