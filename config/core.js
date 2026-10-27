// Core bot identity, Discord wiring, command access, and presentation.
module.exports = {
  discord: { guildId: "1563216575652433993" },
  channels: { generalChatId: "1563216576378052620" },
  currency: {
    name: "SterCoin",
    plural: "SterCoins",
    emoji: "🪙",
    thousandsSeparator: ",",
  },
  commands: {
    prefix: ".",
    allowedChannelIds: ["1563239663995723897"],

    // Optional role gates. Leave both empty to allow every member.
    allowedRoleIds: [],
    deniedRoleIds: [],

    // Lightweight per-user command throttle. Set max to 0 to disable.
    rateLimit: { windowSeconds: 5, max: 10 },
  },
  appeal: { url: "https://forms.gle/BVP2c7HL7nJn7pML7" },
};
