const { isNumStr } = require("./helpers");

// Passive income, daily rewards, gifts, and the leaderboard.
function validateEconomy(e, cfg) {
  if (
    !Number.isInteger(cfg.economy.startingBalance) ||
    cfg.economy.startingBalance < 0
  ) {
    e("economy.startingBalance");
  }

  if (
    !Number.isInteger(cfg.activity.cooldownSeconds) ||
    cfg.activity.cooldownSeconds <= 0
  ) {
    e("activity.cooldownSeconds");
  }

  if (
    !Number.isInteger(cfg.activity.amountMin) ||
    cfg.activity.amountMin < 0
  ) {
    e("activity.amountMin");
  }

  if (
    !Number.isInteger(cfg.activity.amountMax) ||
    cfg.activity.amountMax < 0
  ) {
    e("activity.amountMax");
  }

  if (cfg.activity.amountMin > cfg.activity.amountMax) {
    e("activity amountMin>amountMax");
  }

  if (
    !Array.isArray(cfg.activity.ignoredChannelIds) ||
    !cfg.activity.ignoredChannelIds.every(isNumStr)
  ) {
    e("activity.ignoredChannelIds");
  }

  if (!Number.isInteger(cfg.daily.amountMin) || cfg.daily.amountMin < 0) {
    e("daily.amountMin");
  }

  if (!Number.isInteger(cfg.daily.amountMax) || cfg.daily.amountMax < 0) {
    e("daily.amountMax");
  }

  if (cfg.daily.amountMin > cfg.daily.amountMax) {
    e("daily amountMin>amountMax");
  }

  if (
    typeof cfg.daily.cooldownHours !== "number" ||
    !Number.isFinite(cfg.daily.cooldownHours) ||
    cfg.daily.cooldownHours <= 0
  ) {
    e("daily.cooldownHours");
  }

  if (!Number.isInteger(cfg.gift.minAmount) || cfg.gift.minAmount <= 0) {
    e("gift.minAmount");
  }

  if (
    cfg.gift.maxAmount !== null &&
    (
      !Number.isInteger(cfg.gift.maxAmount) ||
      cfg.gift.maxAmount < cfg.gift.minAmount
    )
  ) {
    e("gift.maxAmount");
  }

  if (
    cfg.gift.maxPerDay !== null &&
    (
      !Number.isSafeInteger(cfg.gift.maxPerDay) ||
      cfg.gift.maxPerDay < 0
    )
  ) {
    e("gift.maxPerDay must be a non-negative integer or null");
  }

  if (!Number.isInteger(cfg.gift.minAccountAgeDays) || cfg.gift.minAccountAgeDays < 0) {
    e("gift.minAccountAgeDays must be a non-negative integer");
  }

  for (const key of ["enabled", "allowSelf", "allowBots"]) {
    if (typeof cfg.gift[key] !== "boolean") {
      e(`gift.${key} must be boolean`);
    }
  }

  if (
    !Number.isInteger(cfg.leaderboard.size) ||
    cfg.leaderboard.size < 1 ||
    cfg.leaderboard.size > 25
  ) {
    e("leaderboard.size");
  }
}

module.exports = { validateEconomy };
