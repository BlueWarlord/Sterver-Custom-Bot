const assert = require("node:assert");
const { test } = require("node:test");
const config = require("./config");
const { validate } = require("./src/utils/config-validate");

const origDiscord = config.discord.guildId;
const origChannel = config.channels.generalChatId;
const origGambling = JSON.parse(JSON.stringify(config.gambling));

function validBase() {
  config.discord.guildId = "111222333444555";
  config.channels.generalChatId = "111222333444555";
  config.gambling = JSON.parse(JSON.stringify(origGambling));
}

test("config-validate: valid gambling config passes", () => {
  validBase();
  assert.deepStrictEqual(validate(config), []);
});

test("config-validate: gambling.enabled must be boolean", () => {
  validBase();
  config.gambling = { ...origGambling, enabled: "true" };
  assert.ok(validate(config).some(e => e.includes("gambling.enabled")));
  config.gambling = { ...origGambling, enabled: 1 };
  assert.ok(validate(config).some(e => e.includes("gambling.enabled")));
  validBase();
  assert.deepStrictEqual(validate(config), []);
});

test("config-validate: gambling.minBet integer >= 1", () => {
  validBase();
  for (const bad of [0, -1, 1.5, "1", null, undefined]) {
    config.gambling = { ...origGambling, minBet: bad };
    assert.ok(validate(config).some(e => e.includes("gambling.minBet")), `minBet=${bad}`);
  }
  config.gambling = { ...origGambling, minBet: 1 };
  assert.deepStrictEqual(validate(config), []);
});

test("config-validate: gambling.maxBet integer >= minBet", () => {
  validBase();
  config.gambling = { ...origGambling, maxBet: 0 };
  assert.ok(validate(config).some(e => e.includes("gambling.maxBet")));
  config.gambling = { ...origGambling, maxBet: 1.5 };
  assert.ok(validate(config).some(e => e.includes("gambling.maxBet")));
  config.gambling = { ...origGambling, maxBet: 1000 };
  assert.deepStrictEqual(validate(config), []);
});

test("config-validate: gambling.cooldownSeconds integer > 0", () => {
  validBase();
  for (const bad of [0, -5, 1.5, "5", null, undefined]) {
    config.gambling = { ...origGambling, cooldownSeconds: bad };
    assert.ok(validate(config).some(e => e.includes("gambling.cooldownSeconds")), `cooldownSeconds=${bad}`);
  }
  config.gambling = JSON.parse(JSON.stringify(origGambling));
  assert.deepStrictEqual(validate(config), []);
});

test.after(() => {
  config.discord.guildId = origDiscord;
  config.channels.generalChatId = origChannel;
  config.gambling = JSON.parse(JSON.stringify(origGambling));
});
