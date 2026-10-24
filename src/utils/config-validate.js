const config = require("../../config");
function isNumStr(v){ return typeof v === "string" && /^\d+$/.test(v); }
function validate(cfg) {
  const errors = [];
  const e = (msg) => errors.push(msg);
  if (!isNumStr(cfg.discord.guildId)) e("discord.guildId must be numeric string");
  if (!isNumStr(cfg.channels.generalChatId) || cfg.channels.generalChatId === "PASTE_CHANNEL_ID") e("channels.generalChatId invalid");
  if (typeof cfg.currency.name !== "string" || !cfg.currency.name) e("currency.name");
  if (typeof cfg.currency.plural !== "string" || !cfg.currency.plural) e("currency.plural");
  if (typeof cfg.commands.prefix !== "string" || !cfg.commands.prefix || /\s/.test(cfg.commands.prefix)) e("commands.prefix");
  if (!Number.isInteger(cfg.economy.startingBalance) || cfg.economy.startingBalance < 0) e("economy.startingBalance");
  if (!Number.isInteger(cfg.activity.cooldownSeconds) || cfg.activity.cooldownSeconds <= 0) e("activity.cooldownSeconds");
  if (!Number.isInteger(cfg.activity.amountMin) || cfg.activity.amountMin < 0) e("activity.amountMin");
  if (!Number.isInteger(cfg.activity.amountMax) || cfg.activity.amountMax < 0) e("activity.amountMax");
  if (cfg.activity.amountMin > cfg.activity.amountMax) e("activity amountMin>amountMax");
  if (!Array.isArray(cfg.activity.ignoredChannelIds) || !cfg.activity.ignoredChannelIds.every(isNumStr)) e("activity.ignoredChannelIds");
  if (!Number.isInteger(cfg.daily.amountMin) || cfg.daily.amountMin < 0) e("daily.amountMin");
  if (!Number.isInteger(cfg.daily.amountMax) || cfg.daily.amountMax < 0) e("daily.amountMax");
  if (cfg.daily.amountMin > cfg.daily.amountMax) e("daily amountMin>amountMax");
  if (typeof cfg.daily.cooldownHours !== "number" || cfg.daily.cooldownHours <= 0) e("daily.cooldownHours");
  if (!Number.isInteger(cfg.drops.intervalMinMinutes) || cfg.drops.intervalMinMinutes <= 0) e("drops.intervalMinMinutes");
  if (!Number.isInteger(cfg.drops.intervalMaxMinutes) || cfg.drops.intervalMaxMinutes <= 0) e("drops.intervalMaxMinutes");
  if (cfg.drops.intervalMinMinutes > cfg.drops.intervalMaxMinutes) e("drops intervalMin>intervalMax");
  if (!Number.isInteger(cfg.drops.claimWindowMinutes) || cfg.drops.claimWindowMinutes <= 0) e("drops.claimWindowMinutes");
  if (cfg.drops.claimWindowMinutes > cfg.drops.intervalMinMinutes) console.warn("[config] claim window longer than min interval (overlapping drops allowed)");
  if (!Array.isArray(cfg.drops.table) || cfg.drops.table.length === 0) e("drops.table");
  let total = 0;
  for (const t of cfg.drops.table || []) {
    if (!Number.isInteger(t.weight) || t.weight <= 0) e("drops.table weight");
    if (!Number.isInteger(t.min) || t.min < 0) e("drops.table min");
    if (!Number.isInteger(t.max) || t.max < 0) e("drops.table max");
    if (t.min > t.max) e("drops.table min>max");
    total += t.weight;
  }
  if (total <= 0) e("drops.table total weight");
  if (!Number.isInteger(cfg.gift.minAmount) || cfg.gift.minAmount <= 0) e("gift.minAmount");
  if (cfg.gift.maxAmount !== null && (!Number.isInteger(cfg.gift.maxAmount) || cfg.gift.maxAmount < cfg.gift.minAmount)) e("gift.maxAmount");
  if (!Number.isInteger(cfg.leaderboard.size) || cfg.leaderboard.size < 1 || cfg.leaderboard.size > 25) e("leaderboard.size");
  if (!Number.isInteger(cfg.storage.flushIntervalMs) || cfg.storage.flushIntervalMs < 500) e("storage.flushIntervalMs");
  if (!Number.isInteger(cfg.storage.backupIntervalMinutes) || cfg.storage.backupIntervalMinutes <= 0) e("storage.backupIntervalMinutes");
  if (!Number.isInteger(cfg.storage.backupsToKeep) || cfg.storage.backupsToKeep <= 0) e("storage.backupsToKeep");
  if (typeof cfg.gambling.enabled !== "boolean") e("gambling.enabled");
  if (!Number.isInteger(cfg.gambling.minBet) || cfg.gambling.minBet < 1) e("gambling.minBet");
  if (!Number.isInteger(cfg.gambling.maxBet) || cfg.gambling.maxBet < cfg.gambling.minBet) e("gambling.maxBet");
  if (!Number.isInteger(cfg.gambling.cooldownSeconds) || cfg.gambling.cooldownSeconds <= 0) e("gambling.cooldownSeconds");
  if (cfg.blackjack) {
    if (!Number.isInteger(cfg.blackjack.minBet) || cfg.blackjack.minBet < 1) e("blackjack.minBet");
    if (!Number.isInteger(cfg.blackjack.maxBet) || cfg.blackjack.maxBet < cfg.blackjack.minBet) e("blackjack.maxBet");
    if (!Number.isInteger(cfg.blackjack.cooldownSeconds) || cfg.blackjack.cooldownSeconds <= 0) e("blackjack.cooldownSeconds");
    if (typeof cfg.blackjack.blackjackPayout !== "number" || cfg.blackjack.blackjackPayout <= 0) e("blackjack.blackjackPayout");
    if (typeof cfg.blackjack.dealerHitsSoft17 !== "boolean") e("blackjack.dealerHitsSoft17");
    if (!Number.isInteger(cfg.blackjack.timeoutMs) || cfg.blackjack.timeoutMs <= 0) e("blackjack.timeoutMs");
  }
  return errors;
}
module.exports = { validate };
