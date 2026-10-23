const config = require("../../config");
const store = require("../economy/store");
const drops = require("../economy/drops");
const logger = require("../utils/logger");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    logger.info("ready", { tag: client.user.tag });
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) { logger.error("guild not found"); process.exit(1); }
    store.startBackupTimer();
    drops.init(client);
    drops.verifyChannel(client);
  },
};
