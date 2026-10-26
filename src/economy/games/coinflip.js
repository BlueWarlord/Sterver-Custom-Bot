const config = require("../../../config");
const store = require("../store");
const logger = require("../../utils/logger");
const { now } = require("../../utils/time");
const {
  resolveRng,
  resolveBetLimits,
  resolveCooldownSeconds,
  validateBet,
  cooldownRemainingMs,
  resolveHouseEdge,
  applyHouseEdge,
} = require("./common");

const VALID_GUESSES = { heads: "Heads", tails: "Tails", h: "Heads", t: "Tails" };

function normalizeGuess(guess) {
  if (typeof guess !== "string") return null;
  const key = guess.trim().toLowerCase();
  return VALID_GUESSES[key] || null;
}

function play(userId, bet, guess, opts) {
  const rng = resolveRng(opts);

  if (!config.gambling.enabled) return { ok: false, code: "GAMBLING_DISABLED" };

  const betError = validateBet(bet, resolveBetLimits(config.gambling));
  if (betError) return { ok: false, code: betError };

  const guessSide = normalizeGuess(guess);
  if (!guessSide) return { ok: false, code: "INVALID_GUESS" };

  const cooldownMs = resolveCooldownSeconds(config.gambling) * 1000;
  const payoutMultiplier = Number.isFinite(config.gambling.coinflipPayout)
    ? config.gambling.coinflipPayout
    : 2;
  const houseEdge = resolveHouseEdge(config.gambling);

  let result;
  store.update((data) => {
    const u = store.ensureUserIn(data, userId).user;

    const remainingMs = cooldownRemainingMs(u.lastFlipAt, cooldownMs);
    if (remainingMs > 0) {
      result = { ok: false, code: "ON_COOLDOWN", remainingMs };
      return;
    }
    if (u.balance < bet) {
      result = { ok: false, code: "INSUFFICIENT_FUNDS", balance: u.balance };
      return;
    }

    const coinSide = rng() < 0.5 ? "Heads" : "Tails";
    const won = coinSide === guessSide;

    // The gross return is 2x the stake by default. The house keeps a slice of
    // winning returns, giving the configured expected-value edge.
    const payout = won ? applyHouseEdge(bet * payoutMultiplier, houseEdge) : 0;
    const profit = won ? payout - bet : -bet;
    const finalBalance = u.balance - bet + payout;
    if (!Number.isSafeInteger(payout) || !Number.isSafeInteger(finalBalance)) {
      result = { ok: false, code: "AMOUNT_OVERFLOW", balance: u.balance };
      return;
    }

    u.balance = finalBalance;
    u.totalWagered += bet;
    u.lastFlipAt = now();
    if (profit > 0) u.totalWon += profit;
    else if (profit < 0) u.totalLost += -profit;

    result = {
      ok: true,
      won,
      result: coinSide,
      guess: guessSide,
      bet,
      payout,
      profit,
      houseEdge,
      balance: u.balance,
      totalWagered: u.totalWagered,
      totalWon: u.totalWon,
      totalLost: u.totalLost,
    };

    logger.info(won ? "coinflip_win" : "coinflip_loss", {
      userId,
      bet,
      profit,
      balance: u.balance,
    });
  });

  return result;
}

module.exports = { play, normalizeGuess };
