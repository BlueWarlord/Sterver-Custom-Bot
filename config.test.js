const assert = require("node:assert");
const { test } = require("node:test");
const config = require("./config");

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
