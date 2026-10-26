const assert = require("node:assert");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const config = require("./config");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sterbot-store-test-"));
config.storage.path = path.join(tempDir, "data.json");

const store = require("./src/economy/store");
const loading = store.load();

test("store.ensureUser initializes gambling stats to 0", async () => {
  const u = store.ensureUser("new-user");
  assert.strictEqual(u.totalWagered, 0);
  assert.strictEqual(u.totalWon, 0);
  assert.strictEqual(u.totalLost, 0);
  assert.strictEqual(u.lastFlipAt, null);
  assert.strictEqual(u.balance, config.economy.startingBalance);
});

test("store.ensureUser backfills missing fields on old records", async () => {
  const old = { balance: 42, lastDailyAt: null, lastActivityRewardAt: null, totalEarned: 0, totalGifted: 0, totalReceived: 0, createdAt: Date.now() };
  store.data.users["old-user"] = old;
  store.update(() => {});
  const u = store.ensureUser("old-user");
  assert.strictEqual(u.totalWagered, 0);
  assert.strictEqual(u.totalWon, 0);
  assert.strictEqual(u.totalLost, 0);
  assert.strictEqual(u.lastFlipAt, null);
  assert.strictEqual(u.balance, 42);
});

test.after(async () => {
  await loading.catch(() => {});
  try {
    await store.flushNow();
  } catch (_) {}
  store.stop();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}
});
