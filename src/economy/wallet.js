const config = require("../../config");
const store = require("./store");
const logger = require("../utils/logger");
const { randomInt } = require("../utils/random");

let leaderboardCache = { revision: -1, size: 0, entries: [] };

function getRecord(userId) {
  return store.getUser(userId);
}

function getBalance(userId) {
  const user = store.getUser(userId);
  if (!user) return config.economy.startingBalance;
  if (!Number.isSafeInteger(user.balance) || user.balance < 0) {
    return store.ensureUser(userId).balance;
  }
  return user.balance;
}

function credit(userId, amount, reason) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_AMOUNT" };
  }

  let result;
  store.update((data) => {
    const { user } = store.ensureUserIn(data, userId);
    if (!Number.isSafeInteger(user.balance + amount)) {
      result = { ok: false, code: "AMOUNT_OVERFLOW", balance: user.balance };
      return;
    }
    user.balance += amount;
    if (reason === "activity" || reason === "daily" || reason === "drop") {
      user.totalEarned += amount;
    }
    result = { ok: true, balance: user.balance };
  });

  if (result.ok) {
    logger.info("credit", { reason, userId, amount, balance: result.balance });
  }
  return result;
}

function debit(userId, amount, reason) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_AMOUNT" };
  }

  let result;
  store.update((data) => {
    const { user } = store.ensureUserIn(data, userId);
    if (user.balance < amount) {
      result = { ok: false, code: "INSUFFICIENT_FUNDS", balance: user.balance };
      return;
    }
    user.balance -= amount;
    if (reason === "gift_sent") user.totalGifted += amount;
    result = { ok: true, balance: user.balance };
  });

  if (result.ok) {
    logger.info("debit", { reason, userId, amount, balance: result.balance });
  }
  return result;
}

function transfer(fromId, toId, amount) {
  if (fromId === toId) return { ok: false, code: "SELF_TRANSFER" };
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, code: "INVALID_AMOUNT" };
  }

  const maxPerDay = config.gift.maxPerDay;
  let result;
  store.update((data) => {
    const from = store.ensureUserIn(data, fromId).user;
    const to = store.ensureUserIn(data, toId).user;

    if (from.balance < amount) {
      result = { ok: false, code: "INSUFFICIENT_FUNDS", balance: from.balance };
      return;
    }

    if (!Number.isSafeInteger(to.balance + amount)) {
      result = { ok: false, code: "AMOUNT_OVERFLOW" };
      return;
    }

    if (maxPerDay != null) {
      const day = new Date().toISOString().slice(0, 10);
      if (from.giftDay !== day) {
        from.giftDay = day;
        from.giftSentToday = 0;
      }
      if (!Number.isSafeInteger(from.giftSentToday) || from.giftSentToday < 0) {
        from.giftSentToday = 0;
      }
      if (from.giftSentToday + amount > maxPerDay) {
        result = {
          ok: false,
          code: "GIFT_LIMIT",
          remaining: Math.max(0, maxPerDay - from.giftSentToday),
        };
        return;
      }
      from.giftSentToday += amount;
    }

    from.balance -= amount;
    from.totalGifted += amount;
    to.balance += amount;
    to.totalReceived += amount;
    result = { ok: true, balance: from.balance };
  });

  return result;
}

function canClaimDaily(userId, nowTs) {
  const user = store.getUser(userId);
  if (!user || user.lastDailyAt == null) return { ok: true, remainingMs: 0 };
  const cooldownMs = config.daily.cooldownHours * 3600 * 1000;
  const remainingMs = (user.lastDailyAt + cooldownMs) - nowTs;
  if (remainingMs <= 0) return { ok: true, remainingMs: 0 };
  return { ok: false, remainingMs };
}

function claimDaily(userId, nowTs) {
  const cooldownMs = config.daily.cooldownHours * 3600 * 1000;
  let result;

  store.update((data) => {
    const { user } = store.ensureUserIn(data, userId);
    if (user.lastDailyAt != null) {
      const remainingMs = (user.lastDailyAt + cooldownMs) - nowTs;
      if (remainingMs > 0) {
        result = { ok: false, code: "ON_COOLDOWN", remainingMs };
        return;
      }
    }

    const amount = randomInt(config.daily.amountMin, config.daily.amountMax);
    if (!Number.isSafeInteger(user.balance + amount)) {
      result = { ok: false, code: "AMOUNT_OVERFLOW", balance: user.balance };
      return;
    }

    user.balance += amount;
    user.totalEarned += amount;
    user.lastDailyAt = nowTs;
    result = { ok: true, amount, balance: user.balance };
  });

  if (result.ok) {
    logger.info("daily", { userId, amount: result.amount, balance: result.balance });
  }
  return result;
}

function getLeaderboard(size) {
  if (leaderboardCache.revision === store.revision && leaderboardCache.size === size) {
    return leaderboardCache.entries.map((entry) => ({ ...entry }));
  }

  const data = store.snapshot();
  const entries = Object.entries(data.users)
    .map(([id, user]) => ({ id, balance: user.balance, createdAt: user.createdAt }))
    .filter((entry) => Number.isSafeInteger(entry.balance) && entry.balance > 0)
    .sort((a, b) => b.balance - a.balance || a.createdAt - b.createdAt)
    .slice(0, size);

  leaderboardCache = { revision: store.revision, size, entries };
  return entries.map((entry) => ({ ...entry }));
}

module.exports = {
  getRecord,
  getBalance,
  credit,
  debit,
  transfer,
  canClaimDaily,
  claimDaily,
  getLeaderboard,
};
