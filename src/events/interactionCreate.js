const { MessageFlags } = require("discord.js");
const config = require("../../config");
const commands = require("../commands");
const logger = require("../utils/logger");
const rateLimit = require("../utils/command-rate-limit");
const { channelAllowed, commandAccess } = require("../utils/permissions");

module.exports = {
  name: "interactionCreate",

  async execute(interaction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.user?.bot) return;

      if (!interaction.guildId || interaction.guildId !== config.discord.guildId) {
        return interaction.reply({
          content: "This bot is not available here.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }

      const channelId = interaction.channelId;
      if (!channelId) return;

      if (!channelAllowed(channelId)) {
        return interaction.reply({
          content: "Commands are not allowed in this channel.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }

      const access = commandAccess(interaction.member);
      if (!access.ok) {
        return interaction.reply({
          content: "You do not have permission to use commands.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }

      if (!rateLimit.allowed(interaction.user.id)) return;

      const cmd = commands.find(
        (command) => command.name === interaction.commandName
      );

      if (!cmd) {
        return interaction.reply({
          content: "Unknown command.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }

      await cmd.executeSlash(interaction);
    } catch (error) {
      logger.error("interactionCreate error", { error });

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Something went wrong.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: "Something went wrong.",
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  },
};
