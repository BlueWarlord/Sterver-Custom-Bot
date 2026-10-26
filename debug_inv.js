const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const config = require("./config");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sterbot-inv-debug-"));
config.storage.path = path.join(tempDir, "data.json");

const store = require("./src/economy/store");
const inventory = require("./src/economy/inventory");
const logger = require("./src/utils/logger");

function cleanup() {
  try {
    store.stop();
  } catch (_) {}
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
}

process.on("exit", cleanup);

(async () => {
  try {
    await store.load();
    const user = store.ensureUser("buyer");
    user.balance = 1000;
    store.update(() => {});

    console.log(JSON.stringify(inventory.buyItem("buyer", "wooden_sword")));
    console.log(JSON.stringify(store.ensureUser("buyer").inventory));
    console.log(JSON.stringify(inventory.giveItem("buyer", "receiver", "wooden_sword", 1)));
    console.log(JSON.stringify(store.ensureUser("buyer").inventory));
    console.log(JSON.stringify(store.ensureUser("receiver").inventory));
    await store.flushNow();
  } finally {
    cleanup();
  }
})().catch((error) => {
  logger.error("inventory debug script failed", { error });
  process.exitCode = 1;
});
