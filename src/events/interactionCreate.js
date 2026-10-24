const { MessageFlags } = require("discord.js");
const config = require("../../config");
const commands = require("../commands");

module.exports = {
  name: "interactionCreate",

  async execute(interaction) {
    try {
      if (!interaction.isChatInputCommand()) return;

      const channelId = interaction.channelId;
      if (!channelId) return;

      const allowedChannelIds = config.commands.allowedChannelIds || [];
      if (
        allowedChannelIds.length > 0 &&
        !allowedChannelIds.includes(channelId)
      ) {
        return interaction.reply({
          content: "Commands are not allowed in this channel.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const cmd = commands.find(
        (command) => command.name === interaction.commandName
      );

      if (!cmd) {
        return interaction.reply({
          content: "Unknown command.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await cmd.executeSlash(interaction);
    } catch (error) {
      console.error("interactionCreate error:", error);

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
