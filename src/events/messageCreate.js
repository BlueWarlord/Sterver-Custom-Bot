const config = require("../../config");
const activity = require("../economy/activity");
const drops = require("../economy/drops");
const commands = require("../commands");
const logger = require("../utils/logger");
const rateLimit = require("../utils/command-rate-limit");
const { channelAllowed, commandAccess } = require("../utils/permissions");

module.exports = {
  name: "messageCreate",

  async execute(message) {
    try {
      if (message.author.bot) return;

      if (!message.guild || message.guild.id !== config.discord.guildId) {
        return;
      }

      if (message.webhookId || message.system) return;

      // Track eligible ordinary messages for the drop probability model.
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

      // ".pick" is handled directly by the drop system, which enforces its own
      // drop-channel allow-list and per-user cooldown.
      if (name === "pick") {
        if (!commandAccess(message.member).ok) return;
        await drops.pick(message);
        return;
      }

      if (!rateLimit.allowed(message.author.id)) return;

      const cmd = commands.find(
        (command) =>
          command.name === name ||
          (Array.isArray(command.aliases) && command.aliases.includes(name))
      );

      if (!cmd) return;

      const channelId = message.channel?.id;
      if (!channelId) return;

      if (!channelAllowed(channelId)) {
        await message.reply({
          content: "Commands are not allowed in this channel.",
          allowedMentions: { parse: [], repliedUser: false },
        }).catch(() => {});
        return;
      }

      const access = commandAccess(message.member);
      if (!access.ok) {
        await message.reply({
          content: "You do not have permission to use commands.",
          allowedMentions: { parse: [], repliedUser: false },
        }).catch(() => {});
        return;
      }

      await cmd.executePrefix(message, args);
    } catch (error) {
      logger.error("messageCreate error", { error });
    }
  },
};
