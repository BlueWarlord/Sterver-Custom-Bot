const assert = require("node:assert");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const config = require("./config");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sterbot-coinflip-test-"));
config.storage.path = path.join(tempDir, "data.json");

const store = require("./src/economy/store");
const loading = store.load();

const { play } = require("./src/economy/games/coinflip");
const coinflipCmd = require("./src/commands/coinflip");

function fund(userId, amount) {
  const u = store.ensureUser(userId);
  u.balance = amount;
  store.update(() => {});
  return u;
}

function resetCooldown(userId) {
  const u = store.getUser(userId);
  if (u) u.lastFlipAt = null;
}

test("coinflip play: win path applies the configured house edge", async () => {
  const edge = config.gambling.houseEdge;
  const payoutMultiplier = config.gambling.coinflipPayout;
  const expectedPayout = Math.floor(100 * payoutMultiplier * (1 - edge));
  const expectedProfit = expectedPayout - 100;

  fund("win-user", 1000);
  const res = play("win-user", 100, "Heads", { rng: () => 0 });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.won, true);
  assert.strictEqual(res.result, "Heads");
  assert.strictEqual(res.guess, "Heads");
  assert.strictEqual(res.bet, 100);
  assert.strictEqual(res.payout, expectedPayout);
  assert.strictEqual(res.profit, expectedProfit);
  assert.strictEqual(res.houseEdge, edge);
  assert.strictEqual(res.balance, 1000 + expectedProfit);
  assert.strictEqual(res.totalWagered, 100);
  assert.strictEqual(res.totalWon, Math.max(0, expectedProfit));
  assert.strictEqual(res.totalLost, Math.max(0, -expectedProfit));
});

test("coinflip play: 5% house edge returns 1.9x on a win", async () => {
  const originalEdge = config.gambling.houseEdge;
  const originalPayout = config.gambling.coinflipPayout;
  try {
    config.gambling.houseEdge = 0.05;
    config.gambling.coinflipPayout = 2;
    fund("edge-user", 1000);
    const res = play("edge-user", 100, "Heads", { rng: () => 0 });
    assert.strictEqual(res.payout, 190);
    assert.strictEqual(res.profit, 90);
    assert.strictEqual(res.balance, 1090);
    assert.strictEqual(res.houseEdge, 0.05);
  } finally {
    config.gambling.houseEdge = originalEdge;
    config.gambling.coinflipPayout = originalPayout;
  }
});

test("coinflip play: fractional payouts round down to whole coins", async () => {
  const originalEdge = config.gambling.houseEdge;
  const originalPayout = config.gambling.coinflipPayout;
  try {
    config.gambling.houseEdge = 0.05;
    config.gambling.coinflipPayout = 2;
    fund("rounding-user", 1000);
    const res = play("rounding-user", 25, "Heads", { rng: () => 0 });
    // 25 * 2 * 0.95 = 47.5, which must become 47 whole coins.
    assert.strictEqual(res.payout, 47);
    assert.strictEqual(res.profit, 22);
    assert.strictEqual(res.balance, 1022);
    assert.ok(Number.isSafeInteger(res.payout));
    assert.ok(Number.isSafeInteger(res.profit));
    assert.ok(Number.isSafeInteger(res.balance));
  } finally {
    config.gambling.houseEdge = originalEdge;
    config.gambling.coinflipPayout = originalPayout;
  }
});

test("coinflip play: loss path", async () => {
  fund("loss-user", 1000);
  const res = play("loss-user", 100, "Heads", { rng: () => 1 });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.won, false);
  assert.strictEqual(res.result, "Tails");
  assert.strictEqual(res.guess, "Heads");
  assert.strictEqual(res.bet, 100);
  assert.strictEqual(res.profit, -100);
  assert.strictEqual(res.balance, 900);
  assert.strictEqual(res.totalWagered, 100);
  assert.strictEqual(res.totalWon, 0);
  assert.strictEqual(res.totalLost, 100);
});

test("coinflip play: guess case-insensitivity", async () => {
  for (const guess of ["heads", "HEADS", "h", "Heads"]) {
    fund(`case-${guess}`, 1000);
    const res = play(`case-${guess}`, 10, guess, { rng: () => 0 });
    assert.strictEqual(res.guess, "Heads", `guess ${guess} not normalized`);
  }
  fund("case-tails", 1000);
  const resT = play("case-tails", 10, "TAILS", { rng: () => 1 });
  assert.strictEqual(resT.guess, "Tails");
  assert.strictEqual(resT.won, true);
});

test("coinflip play: invalid bet", async () => {
  for (const bet of [0, -1, 1.5, "50", null, undefined, NaN]) {
    fund("badbet", 1000);
    const res = play("badbet", bet, "Heads");
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, "INVALID_BET");
  }
});

test("coinflip play: bet too small / too large", async () => {
  const origMin = config.gambling.minBet;
  try {
    config.gambling.minBet = 5;
    fund("betsmall", 1000);
    assert.strictEqual(play("betsmall", 3, "Heads").code, "BET_TOO_SMALL");
  } finally {
    config.gambling.minBet = origMin;
  }
  fund("betlarge", 10000);
  assert.strictEqual(play("betlarge", 2000, "Heads").code, "BET_TOO_LARGE");
});

test("coinflip play: insufficient funds", async () => {
  fund("poor", 50);
  const res = play("poor", 100, "Heads");
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "INSUFFICIENT_FUNDS");
  assert.strictEqual(res.balance, 50);
});

test("coinflip play: cooldown enforcement", async () => {
  fund("cd", 1000);
  assert.strictEqual(play("cd", 10, "Heads").ok, true);
  const res = play("cd", 10, "Heads");
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "ON_COOLDOWN");
  assert.ok(res.remainingMs > 0);
  assert.ok(res.remainingMs <= config.gambling.cooldownSeconds * 1000);
  resetCooldown("cd");
  assert.strictEqual(play("cd", 10, "Heads").ok, true);
});

test("coinflip play: invalid guess", async () => {
  fund("guess", 1000);
  for (const guess of ["foo", "HEAD", "123", null, undefined]) {
    const res = play("guess", 10, guess);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, "INVALID_GUESS");
  }
});

test("coinflip play: gambling disabled", async () => {
  const orig = config.gambling.enabled;
  config.gambling.enabled = false;
  try {
    fund("disabled", 1000);
    assert.strictEqual(play("disabled", 10, "Heads").code, "GAMBLING_DISABLED");
  } finally {
    config.gambling.enabled = orig;
  }
});

test("coinflip command: slash builder shape", async () => {
  assert.strictEqual(coinflipCmd.name, "coinflip");
  assert.deepStrictEqual(coinflipCmd.aliases, ["cf"]);
  const json = coinflipCmd.slash.toJSON();
  assert.strictEqual(json.name, "coinflip");
  const amountOpt = json.options.find(o => o.name === "amount");
  const guessOpt = json.options.find(o => o.name === "guess");
  assert.ok(amountOpt);
  assert.strictEqual(amountOpt.min_value, config.gambling.minBet);
  assert.strictEqual(amountOpt.max_value, config.gambling.maxBet);
  assert.ok(guessOpt);
  assert.deepStrictEqual(guessOpt.choices.map(c => c.value), ["Heads", "Tails"]);
});

test("coinflip command: prefix parsing order-independence", async () => {
  const cases = [
    [["25", "heads"], "bet-first lowercase"],
    [["tails", "25"], "guess-first"],
    [["HEADS", "25"], "uppercase guess"],
    [["25", "H"], "single-letter guess"],
    [["h", "25"], "single-letter guess first"],
  ];
  for (const [args, label] of cases) {
    const id = `px-${Math.random()}`;
    fund(id, 1000);
    const sent = [];
    const message = { author: { id, username: "tester", toString: () => `<@${id}>` }, reply: async (c) => sent.push(c) };
    await coinflipCmd.executePrefix(message, args);
    resetCooldown(id);

    const payload = sent.find(p => p && Array.isArray(p.embeds) && p.embeds.length === 1);
    assert.ok(payload, `${label}: expected a result embed, got ${JSON.stringify(sent)}`);
    assert.strictEqual(payload.content, undefined, `${label}: result message should contain only the embed`);

    const buttons = payload.components[0].toJSON().components;
    assert.deepStrictEqual(buttons.map(b => b.label), ["Heads", "Tails"], `${label}: play again should offer Heads or Tails`);
  }
});

test("coinflip command: prefix invalid inputs", async () => {
  const id = "px-bad";
  fund(id, 1000);
  const sent = [];
  const message = { author: { id, toString: () => `<@${id}>` }, reply: async (c) => sent.push(typeof c === "string" ? c : c.content) };
  await coinflipCmd.executePrefix(message, ["heads"]);
  resetCooldown(id);
  assert.ok(sent.some(s => typeof s === "string" && s.includes("Invalid bet amount")), JSON.stringify(sent));
  sent.length = 0;
  await coinflipCmd.executePrefix(message, ["25", "foobar"]);
  resetCooldown(id);
  assert.ok(sent.some(s => typeof s === "string" && s.includes("Heads or Tails")), JSON.stringify(sent));
});

test("cooldown reply format uses remaining time", async () => {
  const { formatDuration } = require("./src/utils/format");
  fund("fmt", 1000);
  play("fmt", 10, "Heads");
  const res = play("fmt", 10, "Heads");
  const formatted = formatDuration(res.remainingMs);
  assert.ok(formatted.includes("s") || formatted.includes("ms"));
  resetCooldown("fmt");
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
