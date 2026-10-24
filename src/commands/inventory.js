const { SlashCommandBuilder } = require("discord.js");
const inventory = require("../economy/inventory");
const store = require("../economy/store");
const { formatAmount } = require("../utils/format");

function formatUserInventory(userId) {
  const u = store.ensureUser(userId);
  const cat = inventory.getCatalog();
  const inv = u.inventory || {};
  const owned = u.ownedRoles || {};
  const itemLines = [];
  for (const [itemId, count] of Object.entries(inv)) {
    const it = inventory.findItem(itemId);
    const name = it ? it.name : itemId;
    itemLines.push(`• ${name} x${count}`);
  }
  const roleLines = [];
  for (const [roleId, info] of Object.entries(owned)) {
    const r = (cat.roles || []).find(x => x.roleId === roleId);
    const name = r ? r.name : roleId;
    if (info && info.expiresAt) {
      const rem = info.expiresAt - Date.now();
      if (rem > 0) {
        const h = Math.floor(rem / 3600000);
        const m = Math.floor((rem % 3600000) / 60000);
        roleLines.push(`• ${name} (expires in ${h}h ${m}m)`);
      } else {
        roleLines.push(`• ${name} (expired)`);
      }
    } else {
      roleLines.push(`• ${name} (permanent)`);
    }
  }
  const items = itemLines.length ? itemLines.join("\n") : "(none)";
  const roles = roleLines.length ? roleLines.join("\n") : "(none)";
  return `**Inventory**\n**Items:**\n${items}\n\n**Roles:**\n${roles}`;
}

module.exports = {
  name: "inventory",
  aliases: ["inv", "items"],
  slash: new SlashCommandBuilder().setName("inventory").setDescription("View your inventory"),
  async executeSlash(interaction) {
    await interaction.reply({ content: formatUserInventory(interaction.user.id) });
  },
  async executePrefix(message) {
    await message.reply({ content: formatUserInventory(message.author.id), allowedMentions: { parse: [] } });
  },
};
