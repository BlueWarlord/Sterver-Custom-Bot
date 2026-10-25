module.exports = {
  discord: { guildId: "1563216575652433993" },
  channels: { generalChatId: "1563216576378052620" },
  currency: { name: "SterCoin", plural: "SterCoins", emoji: "🪙", thousandsSeparator: "," },
  commands: { prefix: ".", allowedChannelIds: ["1563239663995723897"] },
  economy: { startingBalance: 0 },
  activity: { enabled: true, cooldownSeconds: 300, amountMin: 1, amountMax: 3, ignoredChannelIds: [] },
  daily: { enabled: true, amountMin: 20, amountMax: 50, cooldownHours: 24 },
  drops: {
    // Master switch
    enabled: true,

    // Put every channel that can host drops here.
    // These must be channel IDs from your configured Discord server.
    channelIds: [
      "1563216576378052620",
      // "ANOTHER_CHANNEL_ID",
      // "THIRD_CHANNEL_ID",
    ],

    // Baseline timing model
    // Each channel independently chooses a baseline interval from this range.
    // These are probability parameters, not guaranteed spawn times.
    intervalMinMinutes: 1,
    intervalMaxMinutes: 10,

    // Minimum real-time gap between drops in the same channel.
    minGapMinutes: 1,

    // How often the scheduler checks activity and drop probability.
    tickSeconds: 5,

    // Activity measurement
    // Messages are counted over a rolling window.
    densityWindowSeconds: 60,

    // The channel must meet this adjusted rate before a drop can occur.
    // 0.10 messages/second = 6 eligible messages per 60 seconds.
    minMessagesPerSecond: 0.10,

    // A single user can contribute at most this many messages
    // to the rolling activity window.
    maxMessagesPerUserPerWindow: 5,

    // Higher values make drop probability increase more sharply
    // as the message rate rises above the threshold.
    rateSensitivity: 1.5,

    // Prevent exceptionally busy channels from multiplying the
    // baseline drop probability without limit.
    maxRateMultiplier: 5,

    // How long a drop remains claimable.
    claimWindowMinutes: 5,

    // Message cleanup delays, in seconds.
    // 0 means immediate deletion.
    deleteAfterExpirySeconds: 10,
    deleteAfterClaimSeconds: 5,

    // Negative drops can deduct coins from whoever picks them.
    allowNegativeAmounts: true,

    // Absolute limits for a single drop.
    maxPositiveAmount: 100,
    maxNegativeAmount: 25,

    // Weighted amount distribution.
    // Each entry has:
    //   weight = relative probability
    //   min    = smallest possible amount
    //   max    = largest possible amount
    //
    // Negative entries are ignored when allowNegativeAmounts is false.
    // Keep each range entirely positive or entirely negative.
    table: [
      { weight: 60, min: 5, max: 15 },
      { weight: 25, min: 16, max: 40 },
      { weight: 10, min: 41, max: 100 },
      { weight: 5, min: -25, max: -5 },
    ],

    // Drop message appearance
    dropText: "A SterCoin drop of {amount} appeared! Type `.pick` to claim it.",
    imagePath: "./assests/drop.png",
    claimedText: "This drop has already been claimed.",

    // Optional direct image URL.
    // Leave empty to disable the image.
    imageUrl: "",
  },
  gift: { enabled: true, minAmount: 1, maxAmount: null, allowSelf: false, allowBots: false },
  gambling: { enabled: true, minBet: 1, maxBet: 1000, cooldownSeconds: 7 },
  blackjack: {
    minBet: 1,
    maxBet: 1000,
    cooldownSeconds: 7,
    blackjackPayout: 1.5,
    dealerHitsSoft17: false,
    timeoutMs: 60000,
  },
  leaderboard: { size: 10 },
  storage: { path: "data/data.json", flushIntervalMs: 3000, backupsEnabled: true, backupIntervalMinutes: 60, backupsToKeep: 24 },
};
