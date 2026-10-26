const store = require("../economy/store");
const inventory = require("../economy/inventory");
const drops = require("../economy/drops");
const blackjack = require("../economy/games/blackjack");
const logger = require("../utils/logger");

let shuttingDown = false;

module.exports = async function shutdown(client) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    inventory.stopRoleExpiryTimer();
  } catch (error) {
    logger.error("failed to stop role expiry timer", { error });
  }

  try {
    drops.stop();
  } catch (error) {
    logger.error("failed to stop drop scheduler", { error });
  }

  try {
    blackjack.shutdown({ refund: true });
  } catch (error) {
    logger.error("failed to stop blackjack timers", { error });
  }

  try {
    store.stopBackupTimer();
    await store.flushNow();
  } catch (error) {
    logger.error("failed to flush data store during shutdown", { error });
  }

  try {
    store.stop();
  } catch (error) {
    logger.error("failed to release data store lock", { error });
  }

  try {
    client.destroy();
  } catch (_) {}

  process.exit(0);
};
