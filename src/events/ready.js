const config = require("../../config");
const store = require("../economy/store");
const drops = require("../economy/drops");
const logger = require("../utils/logger");
const commands = require("../commands");
const inventory = require("../economy/inventory");

// Registers (bulk-overwrites) the slash commands for the configured guild.
// Done on every startup so a separate `npm run deploy` step is no longer required.
async function registerSlashCommands(guild) {
  const body = commands.map(c => c.slash.toJSON());
  try {
    await guild.commands.set(body);
    logger.info("slash commands registered", { count: body.length, guildId: guild.id });
  } catch (e) {
    if (e.code === 50001) {
      logger.error("Missing Access: re-invite the bot with BOTH the 'bot' and 'applications.commands' scopes, then restart.");
    } else {
      logger.error("slash command registration failed", { e: e.message });
    }
  }
}

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    logger.info("ready", { tag: client.user.tag });
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) { logger.error("guild not found"); process.exit(1); }
    await registerSlashCommands(guild);
    store.startBackupTimer();
    inventory.startRoleExpiryTimer(client);
    drops.init(client);
    drops.verifyChannel(client);
  },
};
