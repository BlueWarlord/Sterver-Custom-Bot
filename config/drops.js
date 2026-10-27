// Random chat-driven currency drops.
module.exports = {
  drops: {
    // Master switch.
    enabled: true,

    // Put every channel that can host drops here.
    // These must be channel IDs from your configured Discord server.
    channelIds: ["1563216576378052620"],

    // Baseline timing model.
    // Each channel independently chooses a baseline interval from this range.
    // These are probability parameters, not guaranteed spawn times.
    intervalMinMinutes: 1,
    intervalMaxMinutes: 10,

    // Minimum real-time gap between drops in the same channel.
    minGapMinutes: 1,

    // How often the scheduler checks activity and drop probability.
    tickSeconds: 5,

    // Activity measurement: messages are counted over a rolling window.
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

    // Minimum delay between `.pick` attempts from the same user.
    pickCooldownSeconds: 3,

    // Message cleanup delays, in seconds. 0 means immediate deletion.
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

    // Drop message appearance.
    dropText: "A SterCoin drop of {amount} appeared! Type `.pick` to claim it.",
    imagePath: "./assets/drop.png",
    claimedText: "This drop has already been claimed.",

    // Optional direct image URL. Leave empty to disable the image.
    imageUrl: "",
  },
};
