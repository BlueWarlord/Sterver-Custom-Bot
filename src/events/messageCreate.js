const config = require("../../config");
const activity = require("../economy/activity");
const drops = require("../economy/drops");
const commands = require("../commands");
const { PermissionFlagsBits } = require("discord.js");
module.exports = {
  name: "messageCreate",

  async execute(message) {
    try {
      if (message.author.bot) return;

      if (
        !message.guild ||
        message.guild.id !== config.discord.guildId
      ) {
        return;
      }

      if (message.webhookId || message.system) return;

      // Track eligible ordinary messages for the drop probability model.
      // This function ignores messages outside configured drop channels
      // and ignores prefix commands.
      drops.observeMessage(message);

      // Preserve the existing activity reward system.
      activity.tryReward(message);

      const prefix = config.commands.prefix;

      if (!message.content.startsWith(prefix)) return;

      const body = message.content.slice(prefix.length).trim();

      if (!body) return;

      const parts = body.split(/\s+/);
      const name = parts[0].toLowerCase();
      const args = parts.slice(1);

      // ".pick" is handled directly by the drop system.
      if (name === "pick") {
        await drops.pick(message);
        return;
      }

      const channelId = message.channel?.id;
      if (!channelId) return;

      const allowedChannelIds = config.commands.allowedChannelIds || [];
      if (
        allowedChannelIds.length > 0 &&
        !allowedChannelIds.includes(channelId)
      ) {
        return;
      }

      // Preserve the existing prefix commands and aliases.
      const cmd = commands.find(
        (command) =>
          command.name === name ||
          (
            Array.isArray(command.aliases) &&
            command.aliases.includes(name)
          )
      );

      if (!cmd) return;

      await cmd.executePrefix(message, args);
    } catch (error) {
      console.error("messageCreate error:", error);
    }
  },
};
