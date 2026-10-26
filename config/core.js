// Core bot identity, Discord wiring, command access, and presentation.
// Committed defaults only: deployment-specific IDs belong in config.local.js.
module.exports = {
  discord: { guildId: "000000000000000000" },
  channels: { generalChatId: "000000000000000000" },
  currency: {
    name: "SterCoin",
    plural: "SterCoins",
    emoji: "🪙",
    thousandsSeparator: ",",
  },
  commands: {
    prefix: ".",
    allowedChannelIds: [],

    // Optional role gates. Leave both empty to allow every member.
    allowedRoleIds: [],
    deniedRoleIds: [],

    // Lightweight per-user command throttle. Set max to 0 to disable.
    rateLimit: { windowSeconds: 5, max: 10 },
  },
  appeal: { url: "" },
};
