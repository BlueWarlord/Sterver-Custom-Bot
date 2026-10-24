const config = require("../../../config");
const store = require("../store");
const logger = require("../../utils/logger");
const { now } = require("../../utils/time");

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const games = new Map();

function createDeck(rng) {
  if (typeof rng !== "function") rng = Math.random;
  const deck = [];
  for (let s = 0; s < SUITS.length; s++) {
    for (let r = 0; r < RANKS.length; r++) {
      deck.push({ rank: RANKS[r], suit: SUITS[s] });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
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
    const c = cards[i];
    if (c.rank === "A") aces++;
    total += cardValue(c.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isNaturalBlackjack(cards) {
  if (!Array.isArray(cards) || cards.length !== 2) return false;
  const v = handValue(cards);
  return v === 21;
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
      lastBlackjackAt: null,
      createdAt: Date.now(),
    };
    data.users[userId] = u;
  } else {
    if (u.totalWagered == null) u.totalWagered = 0;
    if (u.totalWon == null) u.totalWon = 0;
    if (u.totalLost == null) u.totalLost = 0;
    if (u.lastFlipAt == null) u.lastFlipAt = null;
    if (u.lastBlackjackAt == null) u.lastBlackjackAt = null;
  }
  return u;
}

function start(userId, bet, opts) {
  if (!opts) opts = {};
  const cfg = config.blackjack || {};
  if (!config.gambling.enabled) return { ok: false, code: "GAMBLING_DISABLED" };
  if (!Number.isInteger(bet) || bet <= 0) return { ok: false, code: "INVALID_BET" };
  const minBet = cfg.minBet != null ? cfg.minBet : config.gambling.minBet;
  const maxBet = cfg.maxBet != null ? cfg.maxBet : config.gambling.maxBet;
  if (bet < minBet) return { ok: false, code: "BET_TOO_SMALL" };
  if (bet > maxBet) return { ok: false, code: "BET_TOO_LARGE" };
  if (games.has(userId)) return { ok: false, code: "GAME_IN_PROGRESS" };

  const rng = opts.rng || Math.random;
  let result;
  store.update((data) => {
    const u = ensureUserIn(data, userId);
    const cooldownSec = cfg.cooldownSeconds != null ? cfg.cooldownSeconds : config.gambling.cooldownSeconds;
    const cooldownMs = cooldownSec * 1000;
    if (u.lastBlackjackAt != null) {
      const rem = (u.lastBlackjackAt + cooldownMs) - now();
      if (rem > 0) { result = { ok: false, code: "ON_COOLDOWN", remainingMs: rem }; return; }
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
      createdAt: now(),
    };

    games.set(userId, game);

    const playerNat = isNaturalBlackjack(player);
    const dealerNat = isNaturalBlackjack(dealer);

    if (dealerNat && playerNat) {
      game.ended = true;
      u.balance += bet;
      u.lastBlackjackAt = now();
      games.delete(userId);
      result = {
        ok: true,
        ended: true,
        result: "PUSH",
        player,
        dealer,
        bet,
        totalBet: bet,
        profit: 0,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("blackjack_push", { userId, bet });
      return;
    }
    if (dealerNat && !playerNat) {
      game.ended = true;
      u.totalLost += bet;
      u.lastBlackjackAt = now();
      games.delete(userId);
      result = {
        ok: true,
        ended: true,
        result: "LOSE",
        player,
        dealer,
        bet,
        totalBet: bet,
        profit: -bet,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("blackjack_loss", { userId, bet });
      return;
    }
    if (playerNat && !dealerNat) {
      game.ended = true;
      const payoutMult = (cfg.blackjackPayout != null ? cfg.blackjackPayout : 1.5) + 1;
      const payout = Math.floor(bet * payoutMult);
      const profit = payout - bet;
      u.balance += payout;
      u.totalWon += profit;
      u.lastBlackjackAt = now();
      games.delete(userId);
      result = {
        ok: true,
        ended: true,
        result: "BLACKJACK",
        player,
        dealer,
        bet,
        totalBet: bet,
        profit,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("blackjack_blackjack", { userId, bet, profit });
      return;
    }

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
  const card = game.deck.pop();
  game.player.push(card);
  const pv = handValue(game.player);
  if (pv > 21) {
    return settle(game, "BUST");
  }
  return { ok: true, ended: false, player: game.player, dealer: game.dealer, bet: game.bet, totalBet: game.totalBet, canDouble: false };
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
    const u = ensureUserIn(data, userId);
    if (u.balance < game.bet) {
      result = { ok: false, code: "INSUFFICIENT_FUNDS", balance: u.balance };
      return;
    }
    u.balance -= game.bet;
    u.totalWagered += game.bet;
    game.totalBet = game.bet * 2;
    game.doubled = true;
    const card = game.deck.pop();
    game.player.push(card);
    result = settle(game);
  });
  return result;
}

function settle(game, force) {
  const cfg = config.blackjack || {};
  let result;
  store.update((data) => {
    const u = ensureUserIn(data, game.userId);
    if (force === "BUST") {
      game.ended = true;
      u.totalLost += game.totalBet;
      u.lastBlackjackAt = now();
      games.delete(game.userId);
      if (game.timeoutId) { clearTimeout(game.timeoutId); game.timeoutId = null; }
      result = {
        ok: true,
        ended: true,
        result: "LOSE",
        player: game.player,
        dealer: game.dealer,
        bet: game.bet,
        totalBet: game.totalBet,
        profit: -game.totalBet,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("blackjack_loss", { userId: game.userId, bet: game.totalBet });
      return;
    }

    const dealerHitsSoft17 = cfg.dealerHitsSoft17 != null ? cfg.dealerHitsSoft17 : false;
    while (true) {
      const dv = handValue(game.dealer);
      if (dv < 17) { game.dealer.push(game.deck.pop()); continue; }
      if (dv === 17 && dealerHitsSoft17) {
        let total = 0;
        let aces = 0;
        for (let i = 0; i < game.dealer.length; i++) {
          const c = game.dealer[i];
          if (c.rank === "A") aces++;
          if (c.rank === "A") total += 11;
          else if (c.rank === "J" || c.rank === "Q" || c.rank === "K") total += 10;
          else total += parseInt(c.rank, 10);
        }
        while (total > 21 && aces > 0) { total -= 10; aces--; }
        if (aces > 0 && total === 17) { game.dealer.push(game.deck.pop()); continue; }
        break;
      }
      break;
    }

    const pv = handValue(game.player);
    const dv2 = handValue(game.dealer);
    game.ended = true;
    if (game.timeoutId) { clearTimeout(game.timeoutId); game.timeoutId = null; }

    if (dv2 > 21) {
      const profit = game.totalBet;
      u.balance += game.totalBet * 2;
      u.totalWon += profit;
      u.lastBlackjackAt = now();
      games.delete(game.userId);
      result = {
        ok: true,
        ended: true,
        result: "WIN",
        player: game.player,
        dealer: game.dealer,
        bet: game.bet,
        totalBet: game.totalBet,
        profit,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("blackjack_win", { userId: game.userId, bet: game.totalBet, profit });
      return;
    }
    if (pv > dv2) {
      const profit = game.totalBet;
      u.balance += game.totalBet * 2;
      u.totalWon += profit;
      u.lastBlackjackAt = now();
      games.delete(game.userId);
      result = {
        ok: true,
        ended: true,
        result: "WIN",
        player: game.player,
        dealer: game.dealer,
        bet: game.bet,
        totalBet: game.totalBet,
        profit,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("blackjack_win", { userId: game.userId, bet: game.totalBet, profit });
      return;
    }
    if (pv < dv2) {
      u.totalLost += game.totalBet;
      u.lastBlackjackAt = now();
      games.delete(game.userId);
      result = {
        ok: true,
        ended: true,
        result: "LOSE",
        player: game.player,
        dealer: game.dealer,
        bet: game.bet,
        totalBet: game.totalBet,
        profit: -game.totalBet,
        balance: u.balance,
        totalWagered: u.totalWagered,
        totalWon: u.totalWon,
        totalLost: u.totalLost,
      };
      logger.info("blackjack_loss", { userId: game.userId, bet: game.totalBet });
      return;
    }
    u.balance += game.totalBet;
    u.lastBlackjackAt = now();
    games.delete(game.userId);
    result = {
      ok: true,
      ended: true,
      result: "PUSH",
      player: game.player,
      dealer: game.dealer,
      bet: game.bet,
      totalBet: game.totalBet,
      profit: 0,
      balance: u.balance,
      totalWagered: u.totalWagered,
      totalWon: u.totalWon,
      totalLost: u.totalLost,
    };
    logger.info("blackjack_push", { userId: game.userId, bet: game.totalBet });
    return;
  });
  return result;
}

function getGame(userId) {
  return games.get(userId);
}

function forceStandTimeout(userId) {
  const game = games.get(userId);
  if (!game || game.ended) return null;
  return settle(game);
}

module.exports = { play: start, start, hit, stand, double: doubleDown, doubleDown, settle, getGame, forceStandTimeout, createDeck, handValue, isNaturalBlackjack, games };
