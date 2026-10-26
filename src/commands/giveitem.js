const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const inventory = require("../economy/inventory");
const { firstExplicitMentionedUser, stripMentionTokens } = require("../utils/mentions");

function itemName(itemId) {
  const item = inventory.findItem(itemId);
  return item ? item.name : itemId;
}

module.exports = {
  name: "giveitem",
  aliases: ["gitem"],
  slash: new SlashCommandBuilder().setName("giveitem").setDescription("Give an item to someone")
    .addUserOption(o => o.setName("user").setDescription("Recipient").setRequired(true))
    .addStringOption(o => o.setName("id").setDescription("Item ID").setRequired(true))
    .addIntegerOption(o => o.setName("quantity").setDescription("Quantity").setRequired(false).setMinValue(1)),
  async executeSlash(interaction) {
    const target = interaction.options.getUser("user");
    const id = interaction.options.getString("id");
    const qty = interaction.options.getInteger("quantity") || 1;
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: "Cannot give to yourself.", flags: MessageFlags.Ephemeral });
    }
    if (target.bot) {
      return interaction.reply({ content: "Cannot give items to bots.", flags: MessageFlags.Ephemeral });
    }
    const res = inventory.giveItem(interaction.user.id, target.id, id, qty);
    if (!res.ok) {
      if (res.code === "NOT_ENOUGH") return interaction.reply({ content: "You don't have enough.", flags: MessageFlags.Ephemeral });
      if (res.code === "UNKNOWN_ITEM") return interaction.reply({ content: "Unknown item.", flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: "Transfer failed.", flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({
      content: `${interaction.user} gave ${target} ${qty}x ${itemName(id)}.`,
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
  async executePrefix(message, args) {
    const target = firstExplicitMentionedUser(message);
    if (!target) {
      return message.reply({
        content: "Usage: .giveitem <@user> <item id> [quantity]",
        allowedMentions: { parse: [], repliedUser: false },
      });
    }
    if (target.id === message.author.id) {
      return message.reply({ content: "Cannot give to yourself.", allowedMentions: { parse: [], repliedUser: false } });
    }
    if (target.bot) {
      return message.reply({ content: "Cannot give items to bots.", allowedMentions: { parse: [], repliedUser: false } });
    }

    const tokens = stripMentionTokens(args);
    const id = tokens[0];
    if (!id) {
      return message.reply({
        content: "Usage: .giveitem <@user> <item id> [quantity]",
        allowedMentions: { parse: [], repliedUser: false },
      });
    }

    let qty = 1;
    if (tokens[1] !== undefined) {
      if (!/^\d+$/.test(tokens[1])) {
        return message.reply({
          content: "Quantity must be a positive integer.",
          allowedMentions: { parse: [], repliedUser: false },
        });
      }
      qty = Number(tokens[1]);
    }

    const res = inventory.giveItem(message.author.id, target.id, id, qty);
    if (!res.ok) {
      if (res.code === "NOT_ENOUGH") return message.reply({ content: "You don't have enough.", allowedMentions: { parse: [], repliedUser: false } });
      if (res.code === "UNKNOWN_ITEM") return message.reply({ content: "Unknown item.", allowedMentions: { parse: [], repliedUser: false } });
      return message.reply({ content: "Transfer failed.", allowedMentions: { parse: [], repliedUser: false } });
    }
    return message.reply({
      content: `${message.author} gave ${target} ${qty}x ${itemName(id)}.`,
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
};
