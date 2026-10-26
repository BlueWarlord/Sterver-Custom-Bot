const config = require("../../../config");
const { formatAmount, formatDuration } = require("../../utils/format");
const {
  resolveBetLimits,
  resolveCooldownSeconds,
  resolveHouseEdge,
} = require("../../economy/games/common");

function getBetLimits(section) {
  return resolveBetLimits(section, config.gambling);
}

function getCooldownSeconds(section) {
  return resolveCooldownSeconds(section, config.gambling);
}

function getHouseEdge(section) {
  return resolveHouseEdge(section, config.gambling.houseEdge);
}

function formatPercent(value) {
  const percent = value * 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
}

function houseEdgeLabel(section) {
  const edge = getHouseEdge(section);
  return edge > 0 ? `${formatPercent(edge)} house edge` : "no house edge";
}

function formatGamblingError(res, section) {
  const limits = getBetLimits(section);
  switch (res.code) {
    case "GAMBLING_DISABLED":
      return "Gambling is currently disabled.";
    case "INVALID_BET":
      return "Invalid bet amount.";
    case "BET_TOO_SMALL":
      return `Minimum bet is ${formatAmount(limits.min)}.`;
    case "BET_TOO_LARGE":
      return `Maximum bet is ${formatAmount(limits.max)}.`;
    case "INSUFFICIENT_FUNDS":
      return `Insufficient funds. Balance: ${formatAmount(res.balance)}.`;
    case "ON_COOLDOWN":
      return `You're on cooldown. Try again in ${formatDuration(res.remainingMs)}.`;
    default:
      return null;
  }
}

module.exports = {
  getBetLimits,
  getCooldownSeconds,
  getHouseEdge,
  formatPercent,
  houseEdgeLabel,
  formatGamblingError,
};
