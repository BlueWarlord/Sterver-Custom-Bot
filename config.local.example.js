// Copy this file to config.local.js and fill in your deployment-specific IDs.
// It overrides the committed defaults in config/, and is gitignored so live
// guild/channel/role IDs stay out of git.
module.exports = {
  discord: { guildId: "YOUR_GUILD_ID" },
  channels: { generalChatId: "YOUR_GENERAL_CHANNEL_ID" },
  commands: { allowedChannelIds: ["YOUR_COMMAND_CHANNEL_ID"] },
  drops: {
    enabled: true,
    channelIds: ["YOUR_DROP_CHANNEL_ID"],
  },
  inventory: {
    roles: [
      {
        id: "vip",
        name: "VIP",
        description: "VIP status role.",
        price: 100000,
        sellPrice: null,
        type: "role",
        roleId: "YOUR_VIP_ROLE_ID",
        durationMs: null,
      },
      {
        id: "temp_supporter",
        name: "Temp Supporter",
        description: "Temporary supporter role (1 hour).",
        price: 500,
        sellPrice: null,
        type: "role",
        roleId: "YOUR_TEMP_SUPPORTER_ROLE_ID",
        durationMs: 60000,
      },
    ],
  },
  appeal: { url: "https://example.com/your-appeal-form" },

  // Optional: tune the shared gambling house edge (0-0.25).
  // gambling: { houseEdge: 0.05 },
};
