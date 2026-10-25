const { SlashCommandBuilder } = require("discord.js");
const config = require("../../config");
const drops = require("../economy/drops");

const dropTypes = config.drops.table.map((entry, index) => ({
  name: `${entry.min} to ${entry.max} ${entry.min < 0 ? "(negative)" : ""}`,
  value: index.toString(),
}));

module.exports = {
  name: "drop",
  aliases: ["triggerdrop"],
  slash: new SlashCommandBuilder()
    .setName("drop")
    .setDescription("Manually trigger a SterCoin drop (requires configured role)")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to post the drop in (defaults to current channel)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Specific drop type to trigger (random if not specified)")
        .setRequired(false)
        .addChoices(...dropTypes)
    ),

  async executeSlash(interaction) {
    const roleId = config.drops.manualTriggerRoleId;
    if (!roleId) {
      return interaction.reply({
        content: "Manual drop triggering is not configured.",
        flags: 64,
      });
    }

    const member = interaction.member;
    if (!member?.roles?.cache?.has(roleId)) {
      return interaction.reply({
        content: "You do not have permission to use this command.",
        flags: 64,
      });
    }

    const channel = interaction.options.getChannel("channel") || interaction.channel;
    const typeOption = interaction.options.getString("type");
    const tableIndex = typeOption !== null ? parseInt(typeOption, 10) : null;

    if (!channel?.isTextBased()) {
      return interaction.reply({
        content: "Invalid channel. Please select a text channel.",
        flags: 64,
      });
    }

    const allowedChannelIds = config.drops.channelIds || [];
    if (allowedChannelIds.length > 0 && !allowedChannelIds.includes(channel.id)) {
      return interaction.reply({
        content: "Drops are not enabled in this channel.",
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    const result = await drops.triggerDrop(channel.id, tableIndex);

    if (result.success) {
      await interaction.editReply({
        content: `Drop triggered in <#${channel.id}>! Amount: ${result.drop.amount}`,
      });
    } else {
      await interaction.editReply({
        content: `Failed to trigger drop: ${result.error}`,
      });
    }
  },

  async executePrefix(message, args) {
    const roleId = config.drops.manualTriggerRoleId;
    if (!roleId) {
      return message.reply("Manual drop triggering is not configured.");
    }

    if (!message.member?.roles?.cache?.has(roleId)) {
      return message.reply("You do not have permission to use this command.");
    }

    const channel = message.mentions.channels.first() || message.channel;
    const typeArg = args[0];
    const tableIndex = typeArg !== undefined ? parseInt(typeArg, 10) : null;

    if (!channel?.isTextBased()) {
      return message.reply("Invalid channel.");
    }

    const allowedChannelIds = config.drops.channelIds || [];
    if (allowedChannelIds.length > 0 && !allowedChannelIds.includes(channel.id)) {
      return message.reply("Drops are not enabled in this channel.");
    }

    const result = await drops.triggerDrop(channel.id, tableIndex);

    if (result.success) {
      await message.reply(`Drop triggered in <#${channel.id}>! Amount: ${result.drop.amount}`);
    } else {
      await message.reply(`Failed to trigger drop: ${result.error}`);
    }
  },
};