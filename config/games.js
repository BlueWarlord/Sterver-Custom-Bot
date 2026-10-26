// Wagering games. Payouts are expressed as gross returns before the house edge.
module.exports = {
  gambling: {
    enabled: true,

    // Integer payouts round down, so micro-bets would feel a much larger edge
    // than houseEdge. Keep this high enough for the configured edge to matter.
    minBet: 10,
    maxBet: 1000,
    cooldownSeconds: 7,

    // Fraction of every winning total return withheld by the house.
    // 0.05 = 5% edge, so a fair 2x coinflip returns 1.9x instead of 2x.
    // Valid range: 0 to 0.25.
    houseEdge: 0.05,

    // Gross total return on a winning coinflip before houseEdge (1-2).
    coinflipPayout: 2,
  },

  blackjack: {
    // Keep aligned with gambling.minBet so integer rounding does not erase
    // the configured edge on small wagers.
    minBet: 10,
    maxBet: 1000,
    cooldownSeconds: 7,

    // Gross profit on a natural blackjack, in multiples of the stake
    // (1.5 = 3:2). The stake itself is returned separately.
    blackjackPayout: 1.5,

    // Optional per-game override. null falls back to gambling.houseEdge.
    houseEdge: null,

    dealerHitsSoft17: false,
    timeoutMs: 60000,
  },
};
