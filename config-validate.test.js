const assert = require("node:assert");
const { test } = require("node:test");
const config = require("./config");
const { validate } = require("./src/utils/config-validate");

const origDiscord = config.discord.guildId;
const origChannel = config.channels.generalChatId;
const origGambling = JSON.parse(JSON.stringify(config.gambling));
const origBlackjack = JSON.parse(JSON.stringify(config.blackjack));

function validBase() {
  config.discord.guildId = "111222333444555";
  config.channels.generalChatId = "111222333444555";
  config.gambling = JSON.parse(JSON.stringify(origGambling));
  config.blackjack = JSON.parse(JSON.stringify(origBlackjack));
}

test("config-validate: valid gambling config passes", () => {
  validBase();
  assert.deepStrictEqual(validate(config), []);
});

test("config-validate: missing required sections are reported before feature checks", () => {
  validBase();
  const broken = { ...config, gambling: undefined };
  assert.ok(
    validate(broken).some(e => e.includes("gambling must be a configuration object")),
    JSON.stringify(validate(broken))
  );
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

test("config-validate: gambling.houseEdge is a fraction between 0 and 0.25", () => {
  validBase();
  for (const bad of [-0.01, 0.26, 1, "0.05", null, undefined, NaN]) {
    config.gambling = { ...origGambling, houseEdge: bad };
    assert.ok(
      validate(config).some(e => e.includes("gambling.houseEdge")),
      `houseEdge=${String(bad)}`
    );
  }
  for (const good of [0, 0.05, 0.25]) {
    config.gambling = { ...origGambling, houseEdge: good };
    assert.deepStrictEqual(validate(config), [], `houseEdge=${good}`);
  }
});

test("config-validate: blackjack.houseEdge may be null or 0..0.25", () => {
  validBase();
  for (const good of [null, undefined, 0, 0.05, 0.25]) {
    config.blackjack = { ...origBlackjack, houseEdge: good };
    assert.deepStrictEqual(validate(config), [], `houseEdge=${String(good)}`);
  }
  for (const bad of [-0.01, 0.26, 1, "0.05", NaN]) {
    config.blackjack = { ...origBlackjack, houseEdge: bad };
    assert.ok(
      validate(config).some(e => e.includes("blackjack.houseEdge")),
      `houseEdge=${String(bad)}`
    );
  }
});

test.after(() => {
  config.discord.guildId = origDiscord;
  config.channels.generalChatId = origChannel;
  config.gambling = JSON.parse(JSON.stringify(origGambling));
  config.blackjack = JSON.parse(JSON.stringify(origBlackjack));
});
