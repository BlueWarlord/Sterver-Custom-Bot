const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const inventory = require("../economy/inventory");
const { formatAmount } = require("../utils/format");

function buildShopEmbed() {
  const cat = inventory.getCatalog();
  const embed = new EmbedBuilder()
    .setTitle("🛒 Sterbot Shop")
    .setColor(0xFFD700)
    .setDescription("Use `.buy <id>` or `/buy <id>` to purchase an item or role.")
    .setFooter({ text: "SterCoin Shop" });

  const items = (cat.items || []);
  if (items.length > 0) {
    const itemText = items.map(i => `**${i.name}** (\`${i.id}\`) - ${formatAmount(i.price)}\n${i.description || ""}`).join("\n\n");
    embed.addFields({ name: "📦 Items", value: itemText, inline: false });
  } else {
    embed.addFields({ name: "📦 Items", value: "(none)", inline: false });
  }

  const roles = (cat.roles || []);
  if (roles.length > 0) {
    const roleText = roles.map(r => {
      const dur = r.durationMs == null ? "Permanent" : `${Math.round(r.durationMs / 3600000)}h`;
      return `**${r.name}** (\`${r.id}\`) - ${formatAmount(r.price)} • ${dur}\n${r.description || ""}`;
    }).join("\n\n");
    embed.addFields({ name: "🎭 Roles", value: roleText, inline: false });
  } else {
    embed.addFields({ name: "🎭 Roles", value: "(none)", inline: false });
  }

  return embed;
}

function listCatalog() {
  const cat = inventory.getCatalog();
  const items = (cat.items || []).map(i => `• ${i.name} (${i.id}) - ${formatAmount(i.price)}`).join("\n");
  const roles = (cat.roles || []).map(r => {
    const dur = r.durationMs == null ? "permanent" : `${Math.round(r.durationMs / 3600000)}h`;
    return `• ${r.name} (${r.id}) - ${formatAmount(r.price)} [${dur}]`;
  }).join("\n");
  return `**Items**\n${items || "(none)"}\n\n**Roles**\n${roles || "(none)"}`;
}

function roleErrorMessage(res) {
  switch (res.code) {
    case "INSUFFICIENT_FUNDS":
      return "Insufficient funds.";
    case "ROLE_ASSIGN_FAILED":
      return "Failed to assign role (check bot permissions).";
    case "MANAGE_ROLES_REQUIRED":
      return "The bot needs the Manage Roles permission to sell this role.";
    case "ROLE_HIERARCHY":
      return "The bot's highest role must be above the role being purchased.";
    case "ROLE_NOT_FOUND":
      return "The configured role no longer exists on this server.";
    case "ROLE_MANAGED":
      return "That role is managed by an integration and cannot be assigned.";
    case "ALREADY_OWNED":
      return "You already own that role.";
    case "ROLE_NOT_CONFIGURED":
    case "INVALID_DURATION":
    case "INVALID_PRICE":
      return "That role is misconfigured. Please contact an administrator.";
    default:
      return "Purchase failed.";
  }
}

module.exports = {
  name: "buy",
  aliases: ["shop"],
  slash: new SlashCommandBuilder().setName("buy").setDescription("Buy an item or role")
    .addStringOption(o => o.setName("id").setDescription("Item or role ID").setRequired(false)),
  async executeSlash(interaction) {
    const id = interaction.options.getString("id");
    if (!id) {
      return interaction.reply({ embeds: [buildShopEmbed()], allowedMentions: { parse: [] } });
    }

    const item = inventory.findItem(id);
    if (item) {
      const res = inventory.buyItem(interaction.user.id, id);
      if (!res.ok) {
        if (res.code === "INSUFFICIENT_FUNDS") return interaction.reply({ content: "Insufficient funds.", flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: "Purchase failed.", flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({
        content: `Bought ${item.name} for ${formatAmount(item.price)}.`,
        allowedMentions: { parse: [] },
      });
    }

    const role = inventory.findRole(id);
    if (role) {
      // Fetching the member and granting the role can exceed Discord's
      // three-second interaction window, so defer before doing that work.
      await interaction.deferReply();
      const member = interaction.guild
        ? await interaction.guild.members.fetch(interaction.user.id).catch(() => interaction.member)
        : null;
      const res = await inventory.buyRole(interaction.user.id, id, member);
      if (!res.ok) {
        return interaction.editReply({
          content: roleErrorMessage(res),
          allowedMentions: { parse: [] },
        });
      }
      return interaction.editReply({
        content: `Bought role ${role.name}.`,
        allowedMentions: { parse: [] },
      });
    }

    return interaction.reply({
      content: `Unknown item/role. Use /buy with no ID to view shop.\n\n${listCatalog()}`,
      flags: MessageFlags.Ephemeral,
    });
  },
  async executePrefix(message, args) {
    const id = args[0];
    if (!id) {
      return message.reply({ embeds: [buildShopEmbed()], allowedMentions: { parse: [], repliedUser: false } });
    }

    const item = inventory.findItem(id);
    if (item) {
      const res = inventory.buyItem(message.author.id, id);
      if (!res.ok) {
        if (res.code === "INSUFFICIENT_FUNDS") return message.reply({ content: "Insufficient funds.", allowedMentions: { parse: [], repliedUser: false } });
        return message.reply({ content: "Purchase failed.", allowedMentions: { parse: [], repliedUser: false } });
      }
      return message.reply({
        content: `Bought ${item.name} for ${formatAmount(item.price)}.`,
        allowedMentions: { parse: [] },
      });
    }

    const role = inventory.findRole(id);
    if (role) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      const res = await inventory.buyRole(message.author.id, id, member);
      if (!res.ok) {
        return message.reply({
          content: roleErrorMessage(res),
          allowedMentions: { parse: [], repliedUser: false },
        });
      }
      return message.reply({
        content: `Bought role ${role.name}.`,
        allowedMentions: { parse: [] },
      });
    }

    return message.reply({
      content: `Unknown item/role. Use .shop to view catalog.\n\n${listCatalog()}`,
      allowedMentions: { parse: [], repliedUser: false },
    });
  },
};
