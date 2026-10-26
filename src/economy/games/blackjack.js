const config = require("../../../config");
const store = require("../store");
const logger = require("../../utils/logger");
const { now } = require("../../utils/time");
const { randomFloat } = require("../../utils/random");
const {
  resolveRng,
  resolveBetLimits,
  resolveCooldownSeconds,
  validateBet,
  cooldownRemainingMs,
  resolveHouseEdge,
  applyHouseEdge,
} = require("./common");

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const games = new Map();

function createDeck(rng) {
  const source = typeof rng === "function" ? rng : randomFloat;
  const deck = [];
  for (let s = 0; s < SUITS.length; s++) {
    for (let r = 0; r < RANKS.length; r++) {
      deck.push({ rank: RANKS[r], suit: SUITS[s] });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const raw = Number(source());
    const roll = Number.isFinite(raw)
      ? Math.min(Math.max(raw, 0), 0.9999999999999999)
      : 0;
    const j = Math.floor(roll * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

function drawCard(game) {
  if (game.deck.length === 0) game.deck = createDeck();
  return game.deck.pop();
}

function cardValue(rank) {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return parseInt(rank, 10);
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.rank === "A") aces++;
    total += cardValue(card.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isSoft17(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") aces++;
    total += cardValue(card.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total === 17 && aces > 0;
}

function isNaturalBlackjack(cards) {
  if (!Array.isArray(cards) || cards.length !== 2) return false;
  return handValue(cards) === 21;
}

function blackjackConfig() {
  return config.blackjack || {};
}

function getTimeoutMs() {
  const cfg = blackjackConfig();
  return Number.isInteger(cfg.timeoutMs) && cfg.timeoutMs > 0 ? cfg.timeoutMs : 60000;
}

function getHouseEdge() {
  return resolveHouseEdge(blackjackConfig(), config.gambling.houseEdge);
}

function clearGameTimer(game) {
  if (game.timeoutId) {
    clearTimeout(game.timeoutId);
    game.timeoutId = null;
  }
}

function armTimeout(game) {
  clearGameTimer(game);
  if (game.ended) return;

  game.timeoutId = setTimeout(() => {
    game.timeoutId = null;
    try {
      const current = games.get(game.userId);
      if (current !== game || game.ended) return;
      const result = settle(game);
      if (result && typeof game.onTimeout === "function") {
        try {
          const pending = game.onTimeout(result);
          if (pending && typeof pending.catch === "function") {
            pending.catch((error) => logger.error("blackjack timeout handler failed", {
              userId: game.userId,
              error,
            }));
          }
        } catch (error) {
          logger.error("blackjack timeout handler failed", { userId: game.userId, error });
        }
      }
    } catch (error) {
      logger.error("blackjack timeout settlement failed", { userId: game.userId, error });
    }
  }, getTimeoutMs());

  if (typeof game.timeoutId.unref === "function") game.timeoutId.unref();
}

// Applies the final payout to the user and turns the game into a result object.
// `payout` is the amount returned to the player after the stake was debited.
function finishGame(game, user, outcome, payout) {
  const profit = payout - game.totalBet;
  if (profit > 0) user.totalWon += profit;
  else if (profit < 0) user.totalLost += -profit;

  user.balance += payout;
  user.lastBlackjackAt = now();

  game.ended = true;
  clearGameTimer(game);
  games.delete(game.userId);

  const log = {
    userId: game.userId,
    bet: game.totalBet,
    profit,
    balance: user.balance,
  };
  if (outcome === "PUSH") logger.info("blackjack_push", { userId: game.userId, bet: game.totalBet });
  else if (outcome === "LOSE") logger.info("blackjack_loss", { userId: game.userId, bet: game.totalBet });
  else if (outcome === "BLACKJACK") logger.info("blackjack_blackjack", log);
  else logger.info("blackjack_win", log);

  return {
    ok: true,
    ended: true,
    result: outcome,
    player: game.player,
    dealer: game.dealer,
    bet: game.bet,
    totalBet: game.totalBet,
    payout,
    profit,
    houseEdge: game.houseEdge != null ? game.houseEdge : getHouseEdge(),
    balance: user.balance,
    totalWagered: user.totalWagered,
    totalWon: user.totalWon,
    totalLost: user.totalLost,
  };
}

function drawDealerToStand(game) {
  const dealerHitsSoft17 = blackjackConfig().dealerHitsSoft17 === true;

  while (true) {
    const total = handValue(game.dealer);
    if (total < 17) {
      game.dealer.push(drawCard(game));
      continue;
    }
    if (total === 17 && dealerHitsSoft17 && isSoft17(game.dealer)) {
      game.dealer.push(drawCard(game));
      continue;
    }
    break;
  }
}

function resolveSettlement(game, user) {
  if (game.houseEdge == null) game.houseEdge = getHouseEdge();

  const playerTotal = handValue(game.player);
  if (playerTotal > 21) {
    return finishGame(game, user, "LOSE", 0);
  }

  drawDealerToStand(game);
  const dealerTotal = handValue(game.dealer);

  if (dealerTotal > 21 || playerTotal > dealerTotal) {
    const payout = applyHouseEdge(game.totalBet * 2, game.houseEdge);
    return finishGame(game, user, "WIN", payout);
  }

  if (playerTotal < dealerTotal) {
    return finishGame(game, user, "LOSE", 0);
  }

  return finishGame(game, user, "PUSH", game.totalBet);
}

function start(userId, bet, opts) {
  const options = opts || {};
  const cfg = blackjackConfig();

  if (!config.gambling.enabled) return { ok: false, code: "GAMBLING_DISABLED" };

  const betError = validateBet(bet, resolveBetLimits(cfg, config.gambling));
  if (betError) return { ok: false, code: betError };
  if (games.has(userId)) return { ok: false, code: "GAME_IN_PROGRESS" };

  const rng = resolveRng(options);
  const cooldownMs = resolveCooldownSeconds(cfg, config.gambling) * 1000;

  let result;
  store.update((data) => {
    const u = store.ensureUserIn(data, userId).user;

    const remainingMs = cooldownRemainingMs(u.lastBlackjackAt, cooldownMs);
    if (remainingMs > 0) {
      result = { ok: false, code: "ON_COOLDOWN", remainingMs };
      return;
    }
    if (u.balance < bet) {
      result = { ok: false, code: "INSUFFICIENT_FUNDS", balance: u.balance };
      return;
    }

    const deck = createDeck(rng);
    const player = [deck.pop(), deck.pop()];
    const dealer = [deck.pop(), deck.pop()];
    u.balance -= bet;
    u.totalWagered += bet;

    const game = {
      userId,
      bet,
      totalBet: bet,
      deck,
      player,
      dealer,
      doubled: false,
      ended: false,
      timeoutId: null,
      onTimeout: typeof options.onTimeout === "function" ? options.onTimeout : null,
      houseEdge: getHouseEdge(),
      createdAt: now(),
    };

    const playerNatural = isNaturalBlackjack(player);
    const dealerNatural = isNaturalBlackjack(dealer);

    if (dealerNatural && playerNatural) {
      result = finishGame(game, u, "PUSH", bet);
      return;
    }

    if (dealerNatural) {
      result = finishGame(game, u, "LOSE", 0);
      return;
    }

    if (playerNatural) {
      const payoutRatio = cfg.blackjackPayout != null ? cfg.blackjackPayout : 1.5;
      const grossReturn = bet * (1 + payoutRatio);
      const payout = applyHouseEdge(grossReturn, game.houseEdge);
      result = finishGame(game, u, "BLACKJACK", payout);
      return;
    }

    games.set(userId, game);
    armTimeout(game);
    result = {
      ok: true,
      ended: false,
      player,
      dealer,
      bet,
      totalBet: bet,
      canDouble: true,
    };
  });

  return result;
}

function hit(userId) {
  const game = games.get(userId);
  if (!game || game.ended) return { ok: false, code: "NO_GAME" };

  game.player.push(drawCard(game));
  if (handValue(game.player) > 21) {
    return settle(game);
  }

  armTimeout(game);
  return {
    ok: true,
    ended: false,
    player: game.player,
    dealer: game.dealer,
    bet: game.bet,
    totalBet: game.totalBet,
    canDouble: false,
  };
}

function stand(userId) {
  const game = games.get(userId);
  if (!game || game.ended) return { ok: false, code: "NO_GAME" };
  return settle(game);
}

function doubleDown(userId) {
  const game = games.get(userId);
  if (!game || game.ended) return { ok: false, code: "NO_GAME" };
  if (game.player.length !== 2) return { ok: false, code: "CANNOT_DOUBLE" };

  let result;
  store.update((data) => {
    const u = store.ensureUserIn(data, userId).user;
    if (u.balance < game.bet) {
      result = { ok: false, code: "INSUFFICIENT_FUNDS", balance: u.balance };
      return;
    }

    u.balance -= game.bet;
    u.totalWagered += game.bet;
    game.totalBet = game.bet * 2;
    game.doubled = true;
    game.player.push(drawCard(game));
    result = resolveSettlement(game, u);
  });
  return result;
}

// Public settlement entry point. Accepts the game object for compatibility
// with callers that already hold it (timeouts, tests). The optional "BUST"
// force preserves the original API for callers that decide the hand is lost.
function settle(game, force) {
  if (!game || game.ended) return { ok: false, code: "NO_GAME" };

  let result;
  store.update((data) => {
    const u = store.ensureUserIn(data, game.userId).user;
    result = force === "BUST"
      ? finishGame(game, u, "LOSE", 0)
      : resolveSettlement(game, u);
  });
  return result;
}

function getGame(userId) {
  return games.get(userId);
}

function setTimeoutHandler(userId, handler) {
  const game = games.get(userId);
  if (!game || game.ended) return false;
  game.onTimeout = typeof handler === "function" ? handler : null;
  armTimeout(game);
  return true;
}

function forceStandTimeout(userId) {
  const game = games.get(userId);
  if (!game || game.ended) return null;
  return settle(game);
}

function shutdown(options) {
  const refund = Boolean(options && options.refund);
  for (const game of games.values()) {
    clearGameTimer(game);
    if (refund && game.totalBet > 0) {
      // Graceful shutdown should not silently confiscate an active stake.
      store.update((data) => {
        const u = store.ensureUserIn(data, game.userId).user;
        if (!Number.isSafeInteger(u.balance + game.totalBet)) return;
        u.balance += game.totalBet;
        u.totalWagered = Math.max(0, u.totalWagered - game.totalBet);
      });
    }
  }
  games.clear();
}

module.exports = {
  play: start,
  start,
  hit,
  stand,
  double: doubleDown,
  doubleDown,
  settle,
  getGame,
  setTimeoutHandler,
  forceStandTimeout,
  shutdown,
  createDeck,
  handValue,
  isSoft17,
  isNaturalBlackjack,
  games,
};
