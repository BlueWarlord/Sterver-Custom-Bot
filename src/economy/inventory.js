const { PermissionFlagsBits } = require("discord.js");
const config = require("../../config");
const store = require("./store");
const wallet = require("./wallet");
const logger = require("../utils/logger");

let roleExpiryTimer = null;
let roleCleanupRunning = false;

const roleLocks = new Map();

// Serialize role mutations per user so a purchase cannot race an expiry removal.
async function withRoleLock(userId, task) {
  while (roleLocks.has(userId)) {
    await roleLocks.get(userId).catch(() => {});
  }

  let release;
  const lock = new Promise((resolve) => {
    release = resolve;
  });
  roleLocks.set(userId, lock);

  try {
    return await task();
  } finally {
    roleLocks.delete(userId);
    release();
  }
}

function getCatalog() {
  return config.inventory || { items: [], roles: [] };
}

function findItem(itemId) {
  const catalog = getCatalog();
  return (catalog.items || []).find((item) => item.id === itemId) || null;
}

function findRole(roleId) {
  const catalog = getCatalog();
  return (catalog.roles || []).find((role) => role.id === roleId) || null;
}

function getSellPrice(entry) {
  if (entry.sellPrice != null) return entry.sellPrice;
  return Math.floor((entry.price || 0) * 0.5);
}

function buyItem(userId, itemId) {
  const item = findItem(itemId);
  if (!item) return { ok: false, code: "UNKNOWN_ITEM" };
  const price = item.price;
  if (!Number.isSafeInteger(price) || price < 0) {
    return { ok: false, code: "INVALID_PRICE" };
  }

  let result;
  store.update((data) => {
    const { user } = store.ensureUserIn(data, userId);
    const current = Number.isSafeInteger(user.inventory[itemId]) && user.inventory[itemId] > 0
      ? user.inventory[itemId]
      : 0;
    if (!Number.isSafeInteger(current + 1)) {
      result = { ok: false, code: "INVENTORY_OVERFLOW" };
      return;
    }
    if (price > 0 && user.balance < price) {
      result = { ok: false, code: "INSUFFICIENT_FUNDS", balance: user.balance };
      return;
    }

    if (price > 0) user.balance -= price;
    user.inventory[itemId] = current + 1;
    result = { ok: true, itemId, balance: user.balance };
  });

  return result;
}

async function resolveTargetRole(member, role) {
  if (!member || !member.guild) return { ok: true, targetRole: null };
  const guild = member.guild;

  let me = guild.members?.me || null;
  if (!me && typeof guild.members?.fetchMe === "function") {
    me = await guild.members.fetchMe().catch(() => null);
  }
  if (!me || !me.permissions?.has?.(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, code: "MANAGE_ROLES_REQUIRED" };
  }

  let targetRole = guild.roles?.cache?.get?.(role.roleId) || null;
  if (!targetRole && typeof guild.roles?.fetch === "function") {
    targetRole = await guild.roles.fetch(role.roleId).catch(() => null);
  }
  if (!targetRole) return { ok: false, code: "ROLE_NOT_FOUND" };
  if (targetRole.managed) return { ok: false, code: "ROLE_MANAGED" };
  if (
    me.roles?.highest &&
    typeof me.roles.highest.comparePositionTo === "function" &&
    me.roles.highest.comparePositionTo(targetRole) <= 0
  ) {
    return { ok: false, code: "ROLE_HIERARCHY" };
  }

  return { ok: true, targetRole };
}

async function buyRole(userId, roleId, member) {
  return withRoleLock(userId, async () => {
    const role = findRole(roleId);
    if (!role) return { ok: false, code: "UNKNOWN_ROLE" };
    if (typeof role.roleId !== "string" || !/^\d+$/.test(role.roleId)) {
      return { ok: false, code: "ROLE_NOT_CONFIGURED" };
    }
    if (!member || !member.roles || typeof member.roles.add !== "function") {
      return { ok: false, code: "ROLE_ASSIGN_FAILED" };
    }

    const price = role.price;
    if (!Number.isSafeInteger(price) || price < 0) {
      return { ok: false, code: "INVALID_PRICE" };
    }
    if (role.durationMs != null && (!Number.isSafeInteger(role.durationMs) || role.durationMs <= 0)) {
      return { ok: false, code: "INVALID_DURATION" };
    }
    const expiresAt = role.durationMs == null ? null : Date.now() + role.durationMs;
    if (expiresAt != null && !Number.isSafeInteger(expiresAt)) {
      return { ok: false, code: "INVALID_DURATION" };
    }

    const preflight = await resolveTargetRole(member, role);
    if (!preflight.ok) return preflight;

    if (member.roles.cache?.has?.(role.roleId)) {
      return { ok: false, code: "ALREADY_OWNED" };
    }

    const live = store.getUser(userId);
    const existing = live?.ownedRoles?.[role.roleId];
    if (existing && (existing.expiresAt == null || existing.expiresAt > Date.now())) {
      return { ok: false, code: "ALREADY_OWNED" };
    }

    let charged = false;
    if (price > 0) {
      const debit = wallet.debit(userId, price, "buy_role");
      if (!debit.ok) return debit;
      charged = true;
    }

    try {
      await member.roles.add(role.roleId);
    } catch (error) {
      if (charged) wallet.credit(userId, price, "role_refund");
      logger.warn("role grant failed; purchase refunded", {
        userId,
        roleId: role.roleId,
        error,
      });
      return { ok: false, code: "ROLE_ASSIGN_FAILED" };
    }

    let result;
    store.update((data) => {
      const { user } = store.ensureUserIn(data, userId);
      user.ownedRoles[role.roleId] = { expiresAt, grantedByBot: true };
      result = { ok: true, roleId, expiresAt, balance: user.balance };
    });
    return result;
  });
}

function sellItem(userId, itemId, quantity) {
  const qty = quantity == null ? 1 : quantity;
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    return { ok: false, code: "INVALID_QUANTITY" };
  }

  const item = findItem(itemId);
  if (!item) return { ok: false, code: "UNKNOWN_ITEM" };

  const sellPrice = getSellPrice(item);
  if (!Number.isSafeInteger(sellPrice) || sellPrice < 0) {
    return { ok: false, code: "INVALID_PRICE" };
  }

  let result;
  store.update((data) => {
    const { user } = store.ensureUserIn(data, userId);
    const have = Number.isSafeInteger(user.inventory[itemId]) ? user.inventory[itemId] : 0;
    if (have < qty) {
      result = { ok: false, code: "NOT_ENOUGH" };
      return;
    }

    const total = sellPrice * qty;
    if (!Number.isSafeInteger(total) || !Number.isSafeInteger(user.balance + total)) {
      result = { ok: false, code: "AMOUNT_OVERFLOW" };
      return;
    }

    user.inventory[itemId] = have - qty;
    if (user.inventory[itemId] === 0) delete user.inventory[itemId];
    user.balance += total;
    result = { ok: true, itemId, quantity: qty, total, balance: user.balance };
  });

  return result;
}

function useItem(userId, itemId) {
  const item = findItem(itemId);
  if (!item) return { ok: false, code: "UNKNOWN_ITEM" };

  const effect = item.useEffect;
  if (!effect) return { ok: false, code: "NOT_USABLE" };
  if (effect.type !== "coins" || !Number.isSafeInteger(effect.amount) || effect.amount <= 0) {
    return { ok: false, code: "INVALID_EFFECT" };
  }

  let result;
  store.update((data) => {
    const { user } = store.ensureUserIn(data, userId);
    const have = Number.isSafeInteger(user.inventory[itemId]) ? user.inventory[itemId] : 0;
    if (have < 1) {
      result = { ok: false, code: "NOT_OWNED" };
      return;
    }
    if (!Number.isSafeInteger(user.balance + effect.amount)) {
      result = { ok: false, code: "AMOUNT_OVERFLOW" };
      return;
    }

    user.inventory[itemId] = have - 1;
    if (user.inventory[itemId] === 0) delete user.inventory[itemId];
    user.balance += effect.amount;
    result = { ok: true, itemId, amount: effect.amount, balance: user.balance };
  });

  return result;
}

function giveItem(fromId, toId, itemId, quantity) {
  const qty = quantity == null ? 1 : quantity;
  if (fromId === toId) return { ok: false, code: "SELF_TRANSFER" };
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    return { ok: false, code: "INVALID_QUANTITY" };
  }

  const item = findItem(itemId);
  if (!item) return { ok: false, code: "UNKNOWN_ITEM" };

  let result;
  store.update((data) => {
    const from = store.ensureUserIn(data, fromId).user;
    const to = store.ensureUserIn(data, toId).user;

    const have = Number.isSafeInteger(from.inventory[itemId]) ? from.inventory[itemId] : 0;
    if (have < qty) {
      result = { ok: false, code: "NOT_ENOUGH" };
      return;
    }

    const received = Number.isSafeInteger(to.inventory[itemId]) ? to.inventory[itemId] : 0;
    if (!Number.isSafeInteger(received + qty)) {
      result = { ok: false, code: "INVENTORY_OVERFLOW" };
      return;
    }

    from.inventory[itemId] = have - qty;
    if (from.inventory[itemId] === 0) delete from.inventory[itemId];
    to.inventory[itemId] = received + qty;
    result = { ok: true };
  });

  return result;
}

function removeOwnedRoleRecord(userId, roleId, cutoff) {
  store.update((data) => {
    const user = data.users[userId];
    const record = user?.ownedRoles?.[roleId];
    if (record && record.expiresAt != null && record.expiresAt <= cutoff) {
      delete user.ownedRoles[roleId];
    }
  });
}

async function cleanupExpiredRoles(guild) {
  if (!guild) return;

  const nowTs = Date.now();
  const expired = [];

  // This loop is synchronous; collect first, then perform the Discord calls.
  for (const [userId, user] of Object.entries(store.data.users || {})) {
    for (const [roleId, info] of Object.entries(user.ownedRoles || {})) {
      if (info && info.expiresAt != null && info.expiresAt <= nowTs) {
        expired.push({ userId, roleId });
      }
    }
  }

  for (const { userId, roleId } of expired) {
    await withRoleLock(userId, async () => {
      // Re-check live state: the role may have been repurchased while an
      // earlier iteration was waiting on Discord.
      const live = store.getUser(userId)?.ownedRoles?.[roleId];
      if (!live || live.expiresAt == null || live.expiresAt > Date.now()) return;

      let member;
      try {
        member = await guild.members.fetch(userId);
      } catch (error) {
        if (error.code === 10007 || error.code === 10013) {
          // Unknown member/user: the Discord role is already gone.
          removeOwnedRoleRecord(userId, roleId, nowTs);
          return;
        }
        logger.warn("role expiry fetch failed; will retry", {
          userId,
          roleId,
          error,
        });
        return;
      }

      if (!member) {
        removeOwnedRoleRecord(userId, roleId, nowTs);
        return;
      }

      if (member.roles?.cache?.has?.(roleId)) {
        try {
          await member.roles.remove(roleId);
        } catch (error) {
          logger.warn("role removal failed; will retry", { userId, roleId, error });
          return;
        }
      }

      removeOwnedRoleRecord(userId, roleId, nowTs);
    });
  }
}

async function runRoleCleanup(guild) {
  if (roleCleanupRunning) return;
  roleCleanupRunning = true;
  try {
    await cleanupExpiredRoles(guild);
  } catch (error) {
    logger.error("role expiry cleanup failed", { error });
  } finally {
    roleCleanupRunning = false;
  }
}

function startRoleExpiryTimer(client) {
  if (roleExpiryTimer) return;

  const run = () => {
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) {
      logger.warn("role expiry skipped: configured guild is not cached");
      return;
    }
    runRoleCleanup(guild);
  };

  run();
  roleExpiryTimer = setInterval(run, 60 * 1000);
}

function stopRoleExpiryTimer() {
  if (roleExpiryTimer) {
    clearInterval(roleExpiryTimer);
    roleExpiryTimer = null;
  }
}

module.exports = {
  getCatalog,
  findItem,
  findRole,
  getSellPrice,
  buyItem,
  buyRole,
  sellItem,
  useItem,
  giveItem,
  cleanupExpiredRoles,
  startRoleExpiryTimer,
  stopRoleExpiryTimer,
};
