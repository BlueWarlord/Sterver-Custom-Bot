const assert = require("node:assert");
const { test } = require("node:test");
const config = require("./config");
const { merge } = require("./config/merge");

test("config: split modules assemble every required section", () => {
  for (const section of [
    "discord",
    "channels",
    "currency",
    "commands",
    "economy",
    "activity",
    "daily",
    "drops",
    "gift",
    "leaderboard",
    "gambling",
    "blackjack",
    "inventory",
    "storage",
  ]) {
    assert.ok(config[section], `missing config section: ${section}`);
    assert.strictEqual(typeof config[section], "object", `${section} must be an object`);
  }
});

test("config: gambling exposes a modest, bounded house edge", () => {
  assert.strictEqual(typeof config.gambling.houseEdge, "number");
  assert.ok(config.gambling.houseEdge >= 0);
  assert.ok(config.gambling.houseEdge <= 0.25);
  if (config.blackjack.houseEdge !== null) {
    assert.ok(config.blackjack.houseEdge >= 0);
    assert.ok(config.blackjack.houseEdge <= 0.25);
  }
});

test("config: merge replaces arrays instead of concatenating them", () => {
  const merged = merge(
    { a: { b: 1, c: 2 }, list: [1] },
    { a: { c: 3 }, list: [2] }
  );
  assert.deepStrictEqual(merged, { a: { b: 1, c: 3 }, list: [2] });
});

test("config: merge ignores prototype-polluting keys", () => {
  const malicious = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
  const merged = merge({ safe: 0 }, malicious);
  assert.strictEqual(merged.safe, 1);
  assert.strictEqual({}.polluted, undefined);
});
