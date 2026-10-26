// Passive earning and player-to-player wealth transfer.
module.exports = {
  economy: { startingBalance: 0 },

  activity: {
    enabled: true,
    cooldownSeconds: 300,
    amountMin: 1,
    amountMax: 3,
    ignoredChannelIds: [],
  },

  daily: {
    enabled: true,
    amountMin: 20,
    amountMax: 50,
    cooldownHours: 24,
  },

  gift: {
    enabled: true,
    minAmount: 1,
    maxAmount: null,

    // Maximum total amount a user may gift out per UTC day.
    // Set to null to disable the cap.
    maxPerDay: 5000,

    // Sender accounts younger than this cannot gift. 0 disables the check.
    minAccountAgeDays: 1,

    allowSelf: false,
    allowBots: false,
  },

  leaderboard: { size: 10 },
};
