const config = require("../../config");
const store = require("./store");
const logger = require("../utils/logger");
const { randomInt } = require("../utils/random");

function getRecord(userId) { return store.getUser(userId); }

function getBalance(userId) {
  const u = store.getUser(userId);
  return u ? u.balance : config.economy.startingBalance;
}

function credit(userId, amount, reason) {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, code: "INVALID_AMOUNT" };
  const u = store.ensureUser(userId);
  u.balance += amount;
  if (reason === "activity" || reason === "daily" || reason === "drop") u.totalEarned += amount;
  store.update(() => {}); logger.info("credit", { reason, userId, amount, balance: u.balance });
  return { ok: true, balance: u.balance };
}

function debit(userId, amount, reason) {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, code: "INVALID_AMOUNT" };
  const u = store.ensureUser(userId);
  if (u.balance < amount) return { ok: false, code: "INSUFFICIENT_FUNDS", balance: u.balance };
  u.balance -= amount;
  if (reason === "gift_sent") u.totalGifted += amount;
  store.update(() => {}); logger.info("debit", { reason, userId, amount, balance: u.balance });
  return { ok: true, balance: u.balance };
}

function transfer(fromId, toId, amount) {
  if (fromId === toId) return { ok: false, code: "SELF_TRANSFER" };
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, code: "INVALID_AMOUNT" };
  let result;
  store.update((data) => {
    const from = data.users[fromId] || null;
    // ensure records
    if (!data.users[fromId]) data.users[fromId] = { balance: config.economy.startingBalance, lastDailyAt: null, lastActivityRewardAt: null, totalEarned: 0, totalGifted: 0, totalReceived: 0, createdAt: Date.now() };
    if (!data.users[toId]) data.users[toId] = { balance: config.economy.startingBalance, lastDailyAt: null, lastActivityRewardAt: null, totalEarned: 0, totalGifted: 0, totalReceived: 0, createdAt: Date.now() };
    const fu = data.users[fromId];
    const tu = data.users[toId];
    if (fu.balance < amount) { result = { ok: false, code: "INSUFFICIENT_FUNDS" }; return; }
    fu.balance -= amount;
    fu.totalGifted += amount;
    tu.balance += amount;
    tu.totalReceived += amount;
    result = { ok: true };
  });
  return result;
}

function canClaimDaily(userId, nowTs) {
  const u = store.getUser(userId);
  if (!u || u.lastDailyAt == null) return { ok: true, remainingMs: 0 };
  const cooldownMs = config.daily.cooldownHours * 3600 * 1000;
  const rem = (u.lastDailyAt + cooldownMs) - nowTs;
  if (rem <= 0) return { ok: true, remainingMs: 0 };
  return { ok: false, remainingMs: rem };
}

function claimDaily(userId, nowTs) {
  const check = canClaimDaily(userId, nowTs);
  if (!check.ok) return { ok: false, code: "ON_COOLDOWN", remainingMs: check.remainingMs };
  const amount = randomInt(config.daily.amountMin, config.daily.amountMax);
  const u = store.ensureUser(userId);
  u.balance += amount;
  u.totalEarned += amount;
  u.lastDailyAt = nowTs;
  store.update(() => {});
  // ensure persisted via ensureUser already scheduled? ensureUser schedules flush on create only; need schedule
  // schedule flush manually:
  // store.update already called above with no-op schedules flush
  logger.info("daily", { userId, amount, balance: u.balance });
  return { ok: true, amount, balance: u.balance };
}

function getLeaderboard(size) {
  const data = store.snapshot();
  const entries = Object.entries(data.users)
    .map(([id, u]) => ({ id, balance: u.balance, createdAt: u.createdAt }))
    .filter(e => e.balance > 0)
    .sort((a,b) => b.balance - a.balance || a.createdAt - b.createdAt)
    .slice(0, size);
  return entries;
}

module.exports = { getBalance, credit, debit, transfer, canClaimDaily, claimDaily, getLeaderboard };
