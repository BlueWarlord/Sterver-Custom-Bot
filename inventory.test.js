const assert = require("node:assert");
const { test } = require("node:test");
const os = require("node:os");
const path = require("node:path");

const config = require("./config");
config.storage.path = path.join(os.tmpdir(), `sterbot-inv-test-${process.pid}-${Date.now()}.json`);

const store = require("./src/economy/store");
const wallet = require("./src/economy/wallet");
const inventory = require("./src/economy/inventory");

store.load();

test("ensureUser initializes inventory and ownedRoles", async () => {
  const u = store.ensureUser("u1");
  assert.deepStrictEqual(u.inventory, {});
  assert.deepStrictEqual(u.ownedRoles, {});
});

test("buy/sell/use/give flow", async () => {
  const u = store.ensureUser("buyer");
  u.balance = 1000;
  store.update(() => {});
  const buyRes = inventory.buyItem("buyer", "wooden_sword");
  assert.strictEqual(buyRes.ok, true);
  assert.strictEqual(store.ensureUser("buyer").inventory.wooden_sword, 1);
  const giveRes = inventory.giveItem("buyer", "receiver", "wooden_sword", 1);
  assert.strictEqual(giveRes.ok, true);
  assert.strictEqual(store.ensureUser("buyer").inventory.wooden_sword, undefined);
  assert.strictEqual(store.ensureUser("receiver").inventory.wooden_sword, 1);
  const sellRes = inventory.sellItem("receiver", "wooden_sword", 1);
  assert.strictEqual(sellRes.ok, true);
  assert.strictEqual(sellRes.total, 25); // 50% of 50
  assert.strictEqual(store.ensureUser("receiver").balance >= 25, true);
  // buy again and use
  store.ensureUser("u2").balance = 100;
  store.update(() => {});
  inventory.buyItem("u2", "wooden_sword");
  const useRes = inventory.useItem("u2", "wooden_sword");
  assert.strictEqual(useRes.ok, true);
  assert.strictEqual(store.ensureUser("u2").inventory.wooden_sword, undefined);
});

test("role grant and expiry cleanup", async () => {
  const u = store.ensureUser("r1");
  u.balance = 10000;
  store.update(() => {});
  // temp role
  const res = inventory.buyRole("r1", "temp_supporter", null);
  assert.strictEqual(res.ok, true);
  const owned = store.ensureUser("r1").ownedRoles;
  const keys = Object.keys(owned);
  assert.strictEqual(keys.length >= 1, true);
  // simulate expiry
  const roleIdKey = keys[0];
  owned[roleIdKey].expiresAt = Date.now() - 1000;
  store.update(() => {});
  await inventory.cleanupExpiredRoles({ members: { fetch: async () => null } });
  assert.strictEqual(Object.keys(store.ensureUser("r1").ownedRoles).length, 0);
});

test.after(() => store.stop());
