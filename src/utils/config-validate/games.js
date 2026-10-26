const { isFiniteNumber, isPlainObject } = require("./helpers");

// Keep the configured edge modest so a misconfiguration cannot make every
// winning bet return less than the stake.
const MAX_HOUSE_EDGE = 0.25;

function validateHouseEdge(e, value, label) {
  if (!isFiniteNumber(value) || value < 0 || value > MAX_HOUSE_EDGE) {
    e(`${label} must be a number between 0 and ${MAX_HOUSE_EDGE}`);
  }
}

function validateGambling(e, cfg) {
  const gambling = cfg.gambling;

  if (typeof gambling.enabled !== "boolean") {
    e("gambling.enabled");
  }

  if (!Number.isInteger(gambling.minBet) || gambling.minBet < 1) {
    e("gambling.minBet");
  }

  if (
    !Number.isInteger(gambling.maxBet) ||
    gambling.maxBet < gambling.minBet
  ) {
    e("gambling.maxBet");
  }

  if (
    !Number.isInteger(gambling.cooldownSeconds) ||
    gambling.cooldownSeconds <= 0
  ) {
    e("gambling.cooldownSeconds");
  }

  validateHouseEdge(e, gambling.houseEdge, "gambling.houseEdge");

  if (
    typeof gambling.coinflipPayout !== "number" ||
    !Number.isFinite(gambling.coinflipPayout) ||
    gambling.coinflipPayout < 1 ||
    gambling.coinflipPayout > 2
  ) {
    e("gambling.coinflipPayout must be between 1 and 2");
  }
}

function validateBlackjack(e, cfg) {
  if (cfg.blackjack === undefined) return;

  const blackjack = cfg.blackjack;
  if (!isPlainObject(blackjack)) {
    e("blackjack must be a configuration object");
    return;
  }

  if (!Number.isInteger(blackjack.minBet) || blackjack.minBet < 1) {
    e("blackjack.minBet");
  }

  if (
    !Number.isInteger(blackjack.maxBet) ||
    blackjack.maxBet < blackjack.minBet
  ) {
    e("blackjack.maxBet");
  }

  if (
    !Number.isInteger(blackjack.cooldownSeconds) ||
    blackjack.cooldownSeconds <= 0
  ) {
    e("blackjack.cooldownSeconds");
  }

  if (
    typeof blackjack.blackjackPayout !== "number" ||
    !Number.isFinite(blackjack.blackjackPayout) ||
    blackjack.blackjackPayout <= 0
  ) {
    e("blackjack.blackjackPayout");
  }

  // null means "inherit gambling.houseEdge".
  if (blackjack.houseEdge !== null && blackjack.houseEdge !== undefined) {
    validateHouseEdge(e, blackjack.houseEdge, "blackjack.houseEdge");
  }

  if (typeof blackjack.dealerHitsSoft17 !== "boolean") {
    e("blackjack.dealerHitsSoft17");
  }

  if (!Number.isInteger(blackjack.timeoutMs) || blackjack.timeoutMs <= 0) {
    e("blackjack.timeoutMs");
  }
}

function validateGames(e, cfg) {
  validateGambling(e, cfg);
  validateBlackjack(e, cfg);
}

module.exports = { MAX_HOUSE_EDGE, validateGames };
