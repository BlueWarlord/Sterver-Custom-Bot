const config = require("../../config");
const logger = require("../utils/logger");

module.exports = {
  name: "guildCreate",
  async execute(guild) {
    if (!guild || guild.id === config.discord.guildId) return;
    logger.warn("leaving unconfigured guild", { guildId: guild.id });
    try {
      await guild.leave();
    } catch (error) {
      logger.warn("failed to leave unconfigured guild", { guildId: guild.id, error });
    }
  },
};
