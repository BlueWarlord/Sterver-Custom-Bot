const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const inventory = require("../economy/inventory");
const { formatAmount } = require("../utils/format");

module.exports = {
  name: "giveitem",
  aliases: ["gitem", "transferitem"],
  slash: new SlashCommandBuilder().setName("giveitem").setDescription("Give an item to someone")
    .addUserOption(o => o.setName("user").setDescription("Recipient").setRequired(true))
    .addStringOption(o => o.setName("id").setDescription("Item ID").setRequired(true))
    .addIntegerOption(o => o.setName("quantity").setDescription("Quantity").setRequired(false).setMinValue(1)),
  async executeSlash(interaction) {
    const target = interaction.options.getUser("user");
    const id = interaction.options.getString("id");
    const qty = interaction.options.getInteger("quantity") || 1;
    if (target.id === interaction.user.id) return interaction.reply({ content: "Cannot give to yourself.", flags: MessageFlags.Ephemeral });
    const res = inventory.giveItem(interaction.user.id, target.id, id, qty);
    if (!res.ok) {
      if (res.code === "NOT_ENOUGH") return interaction.reply({ content: "You don't have enough.", flags: MessageFlags.Ephemeral });
      if (res.code === "UNKNOWN_ITEM") return interaction.reply({ content: "Unknown item.", flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: "Transfer failed.", flags: MessageFlags.Ephemeral });
    }
    const item = inventory.findItem(id);
    return interaction.reply({ content: `${interaction.user} gave ${target} ${qty}x ${item ? item.name : id}.` });
  },
  async executePrefix(message, args) {
    const target = message.mentions.users.first();
    if (!target) return message.reply({ content: "Usage: .giveitem <@user> <item id> [quantity]", allowedMentions: { repliedUser: false } });
    if (target.id === message.author.id) return message.reply({ content: "Cannot give to yourself.", allowedMentions: { repliedUser: false } });
    const id = args.find(t => !t.startsWith("<@"));
    const qtoken = args.find(t => /^\d+$/.test(t));
    const qty = qtoken ? parseInt(qtoken, 10) : 1;
    if (!id) return message.reply({ content: "Usage: .giveitem <@user> <item id> [quantity]", allowedMentions: { repliedUser: false } });
    const res = inventory.giveItem(message.author.id, target.id, id, qty);
    if (!res.ok) {
      if (res.code === "NOT_ENOUGH") return message.reply({ content: "You don't have enough.", allowedMentions: { repliedUser: false } });
      if (res.code === "UNKNOWN_ITEM") return message.reply({ content: "Unknown item.", allowedMentions: { repliedUser: false } });
      return message.reply({ content: "Transfer failed.", allowedMentions: { repliedUser: false } });
    }
    const item = inventory.findItem(id);
    return message.reply({ content: `${message.author} gave ${target} ${qty}x ${item ? item.name : id}.`, allowedMentions: { parse: [] } });
  },
};
