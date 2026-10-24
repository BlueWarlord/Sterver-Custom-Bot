const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const config = require("../../config");
const inventory = require("../economy/inventory");
const wallet = require("../economy/wallet");
const store = require("../economy/store");
const { formatAmount } = require("../utils/format");

function listCatalog() {
  const cat = inventory.getCatalog();
  const items = (cat.items || []).map(i => `• ${i.name} (${i.id}) - ${formatAmount(i.price)}`).join("\n");
  const roles = (cat.roles || []).map(r => {
    const dur = r.durationMs == null ? "permanent" : `${Math.round(r.durationMs/3600000)}h`;
    return `• ${r.name} (${r.id}) - ${formatAmount(r.price)} [${dur}]`;
  }).join("\n");
  return `**Items**\n${items || "(none)"}\n\n**Roles**\n${roles || "(none)"}`;
}

module.exports = {
  name: "buy",
  aliases: ["shop", "purchase"],
  slash: new SlashCommandBuilder().setName("buy").setDescription("Buy an item or role")
    .addStringOption(o => o.setName("id").setDescription("Item or role ID").setRequired(true)),
  async executeSlash(interaction) {
    const id = interaction.options.getString("id");
    const item = inventory.findItem(id);
    if (item) {
      const res = inventory.buyItem(interaction.user.id, id);
      if (!res.ok) {
        if (res.code === "INSUFFICIENT_FUNDS") return interaction.reply({ content: `Insufficient funds.`, flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: "Purchase failed.", flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: `Bought ${item.name} for ${formatAmount(item.price)}.` });
    }
    const role = inventory.findRole(id);
    if (role) {
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => interaction.member);
      const res = inventory.buyRole(interaction.user.id, id, member);
      if (!res.ok) {
        if (res.code === "INSUFFICIENT_FUNDS") return interaction.reply({ content: `Insufficient funds.`, flags: MessageFlags.Ephemeral });
        if (res.code === "ROLE_ASSIGN_FAILED") return interaction.reply({ content: "Failed to assign role (check bot permissions).", flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: "Purchase failed.", flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: `Bought role ${role.name}.` });
    }
    return interaction.reply({ content: `Unknown item/role. Use /inventory to view catalog or see shop.\n\n${listCatalog()}`, flags: MessageFlags.Ephemeral });
  },
  async executePrefix(message, args) {
    const id = args[0];
    if (!id) return message.reply({ content: `Usage: .buy <id>\n\n${listCatalog()}`, allowedMentions: { repliedUser: false } });
    const item = inventory.findItem(id);
    if (item) {
      const res = inventory.buyItem(message.author.id, id);
      if (!res.ok) {
        if (res.code === "INSUFFICIENT_FUNDS") return message.reply({ content: `Insufficient funds.`, allowedMentions: { repliedUser: false } });
        return message.reply({ content: "Purchase failed.", allowedMentions: { repliedUser: false } });
      }
      return message.reply({ content: `Bought ${item.name} for ${formatAmount(item.price)}.`, allowedMentions: { parse: [] } });
    }
    const role = inventory.findRole(id);
    if (role) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      const res = inventory.buyRole(message.author.id, id, member);
      if (!res.ok) {
        if (res.code === "INSUFFICIENT_FUNDS") return message.reply({ content: `Insufficient funds.`, allowedMentions: { repliedUser: false } });
        if (res.code === "ROLE_ASSIGN_FAILED") return message.reply({ content: "Failed to assign role (check bot permissions).", allowedMentions: { repliedUser: false } });
        return message.reply({ content: "Purchase failed.", allowedMentions: { repliedUser: false } });
      }
      return message.reply({ content: `Bought role ${role.name}.`, allowedMentions: { parse: [] } });
    }
    return message.reply({ content: `Unknown item/role.\n\n${listCatalog()}`, allowedMentions: { repliedUser: false } });
  },
};
