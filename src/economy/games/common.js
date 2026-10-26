const { cooldownRemaining } = require("../../utils/time");
const { randomFloat } = require("../../utils/random");

// Keep in sync with the validator's MAX_HOUSE_EDGE in config-validate/games.js.
const MAX_HOUSE_EDGE = 0.25;
const DEFAULT_MIN_BET = 1;
const DEFAULT_MAX_BET = 1000;
const DEFAULT_COOLDOWN_SECONDS = 7;

function resolveRng(options) {
  return options && typeof options.rng === "function" ? options.rng : randomFloat;
}

function firstDefined(...values) {
  return values.find((value) => value != null);
}

function resolveBetLimits(section, fallback) {
  const cfg = section || {};
  const base = fallback || {};
  return {
    min: firstDefined(cfg.minBet, base.minBet, DEFAULT_MIN_BET),
    max: firstDefined(cfg.maxBet, base.maxBet, DEFAULT_MAX_BET),
  };
}

function resolveCooldownSeconds(section, fallback) {
  const cfg = section || {};
  const base = fallback || {};
  return firstDefined(
    cfg.cooldownSeconds,
    base.cooldownSeconds,
    DEFAULT_COOLDOWN_SECONDS
  );
}

// Returns a result code when the wager is invalid, otherwise null.
function validateBet(bet, limits) {
  if (!Number.isSafeInteger(bet) || bet <= 0) return "INVALID_BET";
  if (bet < limits.min) return "BET_TOO_SMALL";
  if (bet > limits.max) return "BET_TOO_LARGE";
  return null;
}

function cooldownRemainingMs(lastAt, cooldownMs) {
  return cooldownRemaining(lastAt, cooldownMs);
}

function clampHouseEdge(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(value, MAX_HOUSE_EDGE);
}

// Per-game config may override the shared gambling.houseEdge. null/undefined
// inherit the fallback so operators only need to configure one value.
function resolveHouseEdge(section, fallback) {
  const candidate = section && section.houseEdge != null
    ? section.houseEdge
    : fallback;
  return clampHouseEdge(candidate);
}

// Withholds the configured fraction of a winning gross return. Losing bets
// never call this helper, so the house edge only reduces winnings.
//
// Always round down to whole coins. Balances and statistics are integer-only,
// so a fractional payout such as 25 * 2 * 0.95 = 47.5 returns 47, never 47.5.
// Flooring also keeps the configured edge from being rounded away.
function applyHouseEdge(totalReturn, edge) {
  const gross = Number.isFinite(totalReturn) && totalReturn > 0 ? totalReturn : 0;
  return Math.max(0, Math.floor(gross * (1 - clampHouseEdge(edge))));
}

module.exports = {
  MAX_HOUSE_EDGE,
  resolveRng,
  resolveBetLimits,
  resolveCooldownSeconds,
  validateBet,
  cooldownRemainingMs,
  resolveHouseEdge,
  clampHouseEdge,
  applyHouseEdge,
};
