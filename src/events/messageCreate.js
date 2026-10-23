const config = require("../../config");
const activity = require("../economy/activity");
const commands = require("../commands");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    try {
      if (message.author.bot) return;
      if (!message.guild || message.guild.id !== config.discord.guildId) return;
      if (message.webhookId) return;
      activity.tryReward(message);
      const prefix = config.commands.prefix;
      if (!message.content.startsWith(prefix)) return;
      const body = message.content.slice(prefix.length).trim();
      if (!body) return;
      const parts = body.split(/\s+/);
      const name = parts[0].toLowerCase();
      const args = parts.slice(1);
      const cmd = commands.find(c => c.name === name);
      if (!cmd) return;
      await cmd.executePrefix(message, args);
    } catch (e) {
      console.error(e);
    }
  },
};
