// Shop catalog for items and purchasable roles.
module.exports = {
  inventory: {
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
    roles: [
      {
        id: "vip",
        name: "VIP",
        description: "VIP status role.",
        price: 100000,
        sellPrice: null, // Roles cannot be sold if null.
        type: "role",
        roleId: "1563638653685604536",
        durationMs: null, // null = permanent role.
      },
      {
        id: "temp_supporter",
        name: "Temp Supporter",
        description: "Temporary supporter role (1 hour).",
        price: 500,
        sellPrice: null,
        type: "role",
        roleId: "1563638719678910594",
        durationMs: 60000, // 60 seconds.
      },
    ],
  },
};
