const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const inventory = require("../economy/inventory");
const store = require("../economy/store");
const config = require("../../config");

function formatUserInventory(userId, user) {
  const u = store.ensureUser(userId);
  const cat = inventory.getCatalog();
  const inv = u.inventory || {};
  const owned = u.ownedRoles || {};

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${user?.username || "User"}'s Inventory`,
      iconURL: user?.displayAvatarURL?.({ size: 128 }),
    })
    .setColor(0x5865f2)
    .setThumbnail(user?.displayAvatarURL?.({ size: 256 }))
    .setTimestamp();

  const balance = u.balance || 0;
  embed.addFields({
    name: `${config.currency.emoji} Balance`,
    value: `**${balance.toLocaleString()}** ${balance === 1 ? config.currency.name : config.currency.plural}`,
    inline: true,
  });

  const itemLines = [];
  for (const [itemId, count] of Object.entries(inv)) {
    const it = inventory.findItem(itemId);
    const name = it ? it.name : itemId;
    itemLines.push(`\`x${count}\` ${name}`);
  }
  embed.addFields({
    name: "📦 Items",
    value: itemLines.length ? itemLines.join("\n") : "*Empty*",
    inline: true,
  });

  const roleLines = [];
  for (const [roleId, info] of Object.entries(owned)) {
    const r = (cat.roles || []).find((x) => x.roleId === roleId);
    const name = r ? r.name : roleId;
    if (info && info.expiresAt) {
      const rem = info.expiresAt - Date.now();
      if (rem > 0) {
        const h = Math.floor(rem / 3600000);
        const m = Math.floor((rem % 3600000) / 60000);
        const s = Math.floor((rem % 60000) / 1000);
        if (h > 0) {
          roleLines.push(`• ${name} • **${h}h ${m}m** left`);
        } else if (m > 0) {
          roleLines.push(`• ${name} • **${m}m ${s}s** left`);
        } else {
          roleLines.push(`• ${name} • **${s}s** left`);
        }
      } else {
        roleLines.push(`• ${name} • *Expired*`);
      }
    } else {
      roleLines.push(`• ${name} • *Permanent*`);
    }
  }
  if (roleLines.length) {
    embed.addFields({ name: "🎭 Roles", value: roleLines.join("\n"), inline: false });
  }

  embed.setFooter({ text: "Sterbot • Inventory" });
  return embed;
}

module.exports = {
  name: "inventory",
  aliases: ["inv"],
  slash: new SlashCommandBuilder().setName("inventory").setDescription("View your inventory"),
  async executeSlash(interaction) {
    await interaction.reply({
      embeds: [formatUserInventory(interaction.user.id, interaction.user)],
      allowedMentions: { parse: [] },
    });
  },
  async executePrefix(message) {
    await message.reply({
      embeds: [formatUserInventory(message.author.id, message.author)],
      allowedMentions: { parse: [] },
    });
  },
};
