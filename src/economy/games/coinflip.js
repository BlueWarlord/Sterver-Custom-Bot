const config = require("../../../config");
const store = require("../store");
const logger = require("../../utils/logger");
const { now } = require("../../utils/time");

const VALID_GUESSES = { heads: "Heads", tails: "Tails", h: "Heads", t: "Tails" };

function normalizeGuess(guess) {
  if (typeof guess !== "string") return null;
  const key = guess.trim().toLowerCase();
  return VALID_GUESSES[key] || null;
}

function ensureUserIn(data, userId) {
  let u = data.users[userId];
  if (!u) {
    u = {
      balance: config.economy.startingBalance,
      lastDailyAt: null,
      lastActivityRewardAt: null,
      totalEarned: 0,
      totalGifted: 0,
      totalReceived: 0,
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      lastFlipAt: null,
      createdAt: Date.now(),
    };
    data.users[userId] = u;
  } else {
    if (u.totalWagered == null) u.totalWagered = 0;
    if (u.totalWon == null) u.totalWon = 0;
    if (u.totalLost == null) u.totalLost = 0;
    if (u.lastFlipAt == null) u.lastFlipAt = null;
  }
  return u;
}

function play(userId, bet, guess) {
  if (!config.gambling.enabled) return { ok: false, code: "GAMBLING_DISABLED" };
  if (!Number.isInteger(bet) || bet <= 0) return { ok: false, code: "INVALID_BET" };
  if (bet < config.gambling.minBet) return { ok: false, code: "BET_TOO_SMALL" };
  if (bet > config.gambling.maxBet) return { ok: false, code: "BET_TOO_LARGE" };
  const guessSide = normalizeGuess(guess);
  if (!guessSide) return { ok: false, code: "INVALID_GUESS" };

  const cooldownMs = config.gambling.cooldownSeconds * 1000;
  let result;
  store.update((data) => {
    const u = ensureUserIn(data, userId);

    if (u.lastFlipAt != null) {
      const rem = (u.lastFlipAt + cooldownMs) - now();
      if (rem > 0) { result = { ok: false, code: "ON_COOLDOWN", remainingMs: rem }; return; }
    }
    if (u.balance < bet) {
      result = { ok: false, code: "INSUFFICIENT_FUNDS", balance: u.balance };
      return;
    }

    const coinSide = Math.random() < 0.5 ? "Heads" : "Tails";
    u.balance -= bet;
    u.totalWagered += bet;
    u.lastFlipAt = now();

    if (coinSide === guessSide) {
      const profit = bet * 1.5;
      u.balance += bet * 2.5;
      u.totalWon += profit;
      result = {
        ok: true,
        won: true,
        result: coinSide,
        guess: guessSide,
        bet,
        profit,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("coinflip_win", { userId, bet, profit, balance: u.balance });
    } else {
      u.totalLost += bet;
      result = {
        ok: true,
        won: false,
        result: coinSide,
        guess: guessSide,
        bet,
        profit: -bet,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("coinflip_loss", { userId, bet, balance: u.balance });
    }
  });
  return result;
}

module.exports = { play };