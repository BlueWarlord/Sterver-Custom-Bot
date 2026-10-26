const { isNumStr, isPlainObject } = require("./helpers");

function validateInventory(e, cfg) {
  const inventory = cfg.inventory;
  if (!isPlainObject(inventory)) {
    e("inventory must be a configuration object");
    return;
  }

  const seenIds = new Set();
  const seenRoleIds = new Set();
  const collections = [
    { name: "items", type: "item", entries: inventory.items },
    { name: "roles", type: "role", entries: inventory.roles },
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection.entries)) {
      e(`inventory.${collection.name} must be an array`);
      continue;
    }

    for (const entry of collection.entries) {
      validateInventoryEntry(e, collection, entry, seenIds, seenRoleIds);
    }
  }
}

function validateInventoryEntry(e, collection, entry, seenIds, seenRoleIds) {
  const label = `inventory.${collection.name} entry`;

  if (!isPlainObject(entry)) {
    e(`${label} must be an object`);
    return;
  }

  if (typeof entry.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(entry.id)) {
    e(`${label} id`);
  } else {
    if (["__proto__", "constructor", "prototype"].includes(entry.id)) {
      e(`${label} id is reserved`);
    }
    if (seenIds.has(entry.id)) {
      e(`inventory duplicate id: ${entry.id}`);
    }
    seenIds.add(entry.id);
  }

  if (typeof entry.name !== "string" || !entry.name) {
    e(`${label} name`);
  }

  if (entry.description != null && typeof entry.description !== "string") {
    e(`${label} description`);
  }

  if (!Number.isSafeInteger(entry.price) || entry.price < 0) {
    e(`${label} price`);
  }

  if (
    entry.sellPrice != null &&
    (!Number.isSafeInteger(entry.sellPrice) || entry.sellPrice < 0)
  ) {
    e(`${label} sellPrice`);
  }

  if (entry.type !== collection.type) {
    e(`${label} type must be "${collection.type}"`);
  }

  if (collection.type === "role") {
    validateRoleEntry(e, label, entry, seenRoleIds);
  } else if (entry.useEffect != null) {
    validateUseEffect(e, label, entry.useEffect);
  }
}

function validateRoleEntry(e, label, entry, seenRoleIds) {
  if (!isNumStr(entry.roleId)) {
    e(`${label} roleId`);
  } else {
    if (seenRoleIds.has(entry.roleId)) {
      e(`inventory duplicate roleId: ${entry.roleId}`);
    }
    seenRoleIds.add(entry.roleId);
  }

  if (
    entry.durationMs !== null &&
    (!Number.isSafeInteger(entry.durationMs) || entry.durationMs <= 0)
  ) {
    e(`${label} durationMs`);
  }
}

function validateUseEffect(e, label, effect) {
  if (!isPlainObject(effect)) {
    e(`${label} useEffect must be an object`);
    return;
  }

  if (effect.type !== "coins") {
    e(`${label} useEffect.type must be "coins"`);
  }

  if (!Number.isSafeInteger(effect.amount) || effect.amount <= 0) {
    e(`${label} useEffect.amount`);
  }
}

module.exports = { validateInventory };
