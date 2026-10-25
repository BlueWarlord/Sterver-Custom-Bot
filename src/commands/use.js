const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const inventory = require("../economy/inventory");
const { formatAmount } = require("../utils/format");

module.exports = {
  name: "use",
  aliases: [],
  slash: new SlashCommandBuilder().setName("use").setDescription("Use an item")
    .addStringOption(o => o.setName("id").setDescription("Item ID").setRequired(true)),
  async executeSlash(interaction) {
    const id = interaction.options.getString("id");
    const res = inventory.useItem(interaction.user.id, id);
    if (!res.ok) {
      if (res.code === "NOT_OWNED") return interaction.reply({ content: "You don't own that item.", flags: MessageFlags.Ephemeral });
      if (res.code === "UNKNOWN_ITEM") return interaction.reply({ content: "Unknown item.", flags: MessageFlags.Ephemeral });
      return interaction.reply({ content: "Failed to use item.", flags: MessageFlags.Ephemeral });
    }
    const item = inventory.findItem(id);
    return interaction.reply({ content: `You used ${item ? item.name : id}.` });
  },
  async executePrefix(message, args) {
    const id = args[0];
    if (!id) return message.reply({ content: "Usage: .use <item id>", allowedMentions: { repliedUser: false } });
    const res = inventory.useItem(message.author.id, id);
    if (!res.ok) {
      if (res.code === "NOT_OWNED") return message.reply({ content: "You don't own that item.", allowedMentions: { repliedUser: false } });
      if (res.code === "UNKNOWN_ITEM") return message.reply({ content: "Unknown item.", allowedMentions: { repliedUser: false } });
      return message.reply({ content: "Failed to use item.", allowedMentions: { repliedUser: false } });
    }
    const item = inventory.findItem(id);
    return message.reply({ content: `You used ${item ? item.name : id}.`, allowedMentions: { parse: [] } });
  },
};
