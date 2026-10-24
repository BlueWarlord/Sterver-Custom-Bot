const assert = require("node:assert");
const { test } = require("node:test");
const os = require("node:os");
const path = require("node:path");

const config = require("./config");
config.storage.path = path.join(os.tmpdir(), `sterbot-test-${process.pid}-${Date.now()}.json`);

const store = require("./src/economy/store");
store.load();

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

test.after(() => store.stop());
