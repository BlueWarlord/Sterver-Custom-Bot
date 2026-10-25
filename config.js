/**
 * Sterbot configuration
 * 
 * This file controls Discord IDs, economy, gambling, drops, inventory, storage, and more.
 * Edit values to fit your server. IDs are Discord snowflakes (strings).
 */

// Discord
const discord = {
  guildId: "1563216575652433993",
};

// Channels
const channels = {
  generalChatId: "1563789802401173534",
};

// Currency display
const currency = {
  name: "SterCoin",
  plural: "SterCoins",
  emoji: "🪙",
  thousandsSeparator: ",",
};

// Command settings
const commands = {
  prefix: ".", // Prefix for legacy/message commands
  // If empty, commands are allowed in any channel. Otherwise restricted to these IDs.
  allowedChannelIds: ["1563789802401173534"],
};

// Economy
const economy = {
  startingBalance: 0,
};

// Activity rewards (passive earning)
const activity = {
  enabled: true,
  cooldownSeconds: 300, // Min seconds between activity rewards per user
  amountMin: 1,
  amountMax: 3,
  ignoredChannelIds: [], // Channels excluded from activity rewards
};

// Daily rewards
const daily = {
  enabled: true,
  amountMin: 20,
  amountMax: 50,
  cooldownHours: 24,
};

// Coin drops
const drops = {
  // Master switch
  enabled: true,

  // Channels that can spawn drops (must be valid channel IDs)
  channelIds: [
    "1563789802401173534",
    // "ANOTHER_CHANNEL_ID",
    // "THIRD_CHANNEL_ID",
  ],

  // Drop interval range (baseline) - each channel picks independently
  intervalMinMinutes: 3,
  intervalMaxMinutes: 25,

  // Minimum real-time gap between drops in the same channel
  minGapMinutes: 2,

  // How often the scheduler checks for drop opportunities
  tickSeconds: 5,

  // Activity measurement (rolling window)
  densityWindowSeconds: 60,
  // Minimum adjusted message rate required to allow drops (messages/sec)
  minMessagesPerSecond: 0.10, // ~6 messages/minute
  // Max messages counted per user in the rolling window (prevents spam domination)
  maxMessagesPerUserPerWindow: 3,
  // Drop probability increases more sharply above threshold with higher sensitivity
  rateSensitivity: 1.5,
  // Cap on rate multiplier to avoid runaway probability
  maxRateMultiplier: 5,

  // Claim window
  claimWindowMinutes: 10,

  // Cleanup delays (seconds). 0 = delete immediately
  deleteAfterExpirySeconds: 10,
  deleteAfterClaimSeconds: 5,

  // Negative drops
  allowNegativeAmounts: true,
  maxPositiveAmount: 100,
  maxNegativeAmount: 25,

  // Weighted drop amounts
  // weight: relative probability; min/max define range
  // Negative ranges only used if allowNegativeAmounts is true
  table: [
    { weight: 60, min: 5, max: 15 },      // Common small
    { weight: 25, min: 16, max: 40 },     // Uncommon
    { weight: 10, min: 41, max: 100 },    // Rare
    { weight: 5, min: -25, max: -5 },     // Rare negative
  ],

  // Drop messages
  embedTitle: "A SterCoin drop appeared!",
  embedDescription: "Type `.pick` to claim this drop.",
  expiredText: "This drop has expired.",
  claimedText: "This drop has already been claimed.",

  // Optional image URL (leave empty to disable)
  imageUrl: "",
};

// Gifts
const gift = {
  enabled: true,
  minAmount: 1,
  maxAmount: null, // null = no upper limit
  allowSelf: false,
  allowBots: false,
};

// Coinflip

// Gambling (general)
const gambling = {
  enabled: true,
  minBet: 1,
  maxBet: 1000,
  cooldownSeconds: 3,
};

const coinflip = {
  minBet: 1,
  maxBet: 1000,
  cooldownSeconds: 3,
};

// Blackjack
const blackjack = {
  minBet: 1,
  maxBet: 1000,
  cooldownSeconds: 3,
  blackjackPayout: 1.5,      // Payout multiplier for natural blackjack (1.5 = 3:2)
  dealerHitsSoft17: false,   // If true, dealer hits on soft 17 (A-6)
  timeoutMs: 60000,          // Auto-stand timeout for active games (ms)
};

// Leaderboard
const leaderboard = {
  size: 10,
};

// Inventory & Store
const inventory = {
  // Buyable items
  items: [
    {
      id: "wooden_sword",
      name: "Wooden Sword",
      description: "A basic wooden sword.",
      price: 50,
      sellPrice: 25,
      type: "item",
    },
  ],
  // Buyable roles
  roles: [
    {
      id: "vip",
      name: "VIP",
      description: "VIP status role.",
      price: 100000,
      sellPrice: null,      // Roles cannot be sold if null
      type: "role",
      roleId: "1563638653685604536",
      durationMs: null,     // null = permanent role
    },
    {
      id: "temp_supporter",
      name: "Temp Supporter",
      description: "Temporary supporter role (1 hour).",
      price: 500,
      sellPrice: null,
      type: "role",
      roleId: "1563638719678910594",
      durationMs: 60000,    // 60 seconds
    },
  ],
};

// Storage
const storage = {
  path: "data/data.json",
  flushIntervalMs: 3000,      // How often to write changes to disk
  backupsEnabled: true,
  backupIntervalMinutes: 60,  // Create backup every hour
  backupsToKeep: 24,          // Keep last 24 backups
};

module.exports = {
  discord,
  channels,
  currency,
  commands,
  economy,
  activity,
  daily,
  drops,
  gift,
  gambling,
  coinflip,
  blackjack,
  leaderboard,
  inventory,
  storage,
};
