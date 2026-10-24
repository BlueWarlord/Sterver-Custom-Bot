const config = require("../../config");
const store = require("./store");
const wallet = require("./wallet");

let roleExpiryTimer = null;

function getCatalog() {
  return config.inventory || { items: [], roles: [] };
}

function findItem(itemId) {
  const cat = getCatalog();
  return (cat.items || []).find(i => i.id === itemId) || null;
}

function findRole(roleId) {
  const cat = getCatalog();
  return (cat.roles || []).find(r => r.id === roleId) || null;
}

function getSellPrice(entry) {
  if (entry.sellPrice != null) return entry.sellPrice;
  return Math.floor((entry.price || 0) * 0.5);
}

function buyItem(userId, itemId) {
  const item = findItem(itemId);
  if (!item) return { ok: false, code: "UNKNOWN_ITEM" };
  const price = item.price;
  if (!Number.isInteger(price) || price < 0) return { ok: false, code: "INVALID_PRICE" };
  const deb = wallet.debit(userId, price, "buy");
  if (!deb.ok) return deb;
  const u = store.ensureUser(userId);
  if (!u.inventory) u.inventory = {};
  u.inventory[itemId] = (u.inventory[itemId] || 0) + 1;
  store.update(() => {});
  return { ok: true, itemId, balance: deb.balance };
}

function buyRole(userId, roleId, member) {
  const role = findRole(roleId);
  if (!role) return { ok: false, code: "UNKNOWN_ROLE" };
  const price = role.price;
  if (!Number.isInteger(price) || price < 0) return { ok: false, code: "INVALID_PRICE" };
  const deb = wallet.debit(userId, price, "buy_role");
  if (!deb.ok) return deb;
  const u = store.ensureUser(userId);
  if (!u.ownedRoles) u.ownedRoles = {};
  const expiresAt = role.durationMs == null ? null : Date.now() + role.durationMs;
  try {
    if (member && role.roleId) {
      member.roles.add(role.roleId).catch(() => {});
    }
  } catch (e) {
    // refund on failure
    const u2 = store.ensureUser(userId);
    u2.balance += price;
    store.update(() => {});
    return { ok: false, code: "ROLE_ASSIGN_FAILED" };
  }
  u.ownedRoles[role.roleId] = { expiresAt };
  store.update(() => {});
  return { ok: true, roleId, expiresAt, balance: deb.balance };
}

function sellItem(userId, itemId, quantity) {
  const qty = quantity == null ? 1 : quantity;
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, code: "INVALID_QUANTITY" };
  const item = findItem(itemId);
  if (!item) return { ok: false, code: "UNKNOWN_ITEM" };
  const u = store.ensureUser(userId);
  if (!u.inventory) u.inventory = {};
  const have = u.inventory[itemId] || 0;
  if (have < qty) return { ok: false, code: "NOT_ENOUGH" };
  const sellPrice = getSellPrice(item);
  const total = sellPrice * qty;
  u.inventory[itemId] = have - qty;
  if (u.inventory[itemId] === 0) {
    delete u.inventory[itemId];
  }
  u.balance += total;
  store.update(() => {});
  return { ok: true, itemId, quantity: qty, total, balance: u.balance };
}

function useItem(userId, itemId) {
  const item = findItem(itemId);
  if (!item) return { ok: false, code: "UNKNOWN_ITEM" };
  const u = store.ensureUser(userId);
  if (!u.inventory) u.inventory = {};
  const have = u.inventory[itemId] || 0;
  if (have < 1) return { ok: false, code: "NOT_OWNED" };
  u.inventory[itemId] = have - 1;
  if (u.inventory[itemId] === 0) {
    delete u.inventory[itemId];
  }
  store.update(() => {});
  return { ok: true, itemId };
}

function giveItem(fromId, toId, itemId, quantity) {
  const qty = quantity == null ? 1 : quantity;
  if (fromId === toId) return { ok: false, code: "SELF_TRANSFER" };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, code: "INVALID_QUANTITY" };
  const item = findItem(itemId);
  if (!item) return { ok: false, code: "UNKNOWN_ITEM" };
  let result;
  store.update((data) => {
    if (!data.users[fromId]) data.users[fromId] = { balance: config.economy.startingBalance, inventory: {}, ownedRoles: {} };
    if (!data.users[toId]) data.users[toId] = { balance: config.economy.startingBalance, inventory: {}, ownedRoles: {} };
    const fu = data.users[fromId];
    const tu = data.users[toId];
    if (!fu.inventory) fu.inventory = {};
    if (!tu.inventory) tu.inventory = {};
    const have = fu.inventory[itemId] || 0;
    if (have < qty) { result = { ok: false, code: "NOT_ENOUGH" }; return; }
    fu.inventory[itemId] = have - qty;
    if (fu.inventory[itemId] === 0) delete fu.inventory[itemId];
    tu.inventory[itemId] = (tu.inventory[itemId] || 0) + qty;
    result = { ok: true };
  });
  return result;
}

async function cleanupExpiredRoles(guild) {
  if (!guild) return;
  const now = Date.now();
  const data = store.snapshot();
  const cat = getCatalog();
  const roleMap = {};
  (cat.roles || []).forEach(r => { if (r.roleId) roleMap[r.roleId] = r; });
  let changed = false;
  for (const [userId, user] of Object.entries(data.users || {})) {
    if (!user.ownedRoles) continue;
    for (const [roleId, info] of Object.entries(user.ownedRoles)) {
      if (info && info.expiresAt != null && info.expiresAt <= now) {
        try {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
          }
        } catch (_) {}
        delete user.ownedRoles[roleId];
        changed = true;
      }
    }
  }
  if (changed) {
    store.data = data;
    store.update(() => {});
  }
}

function startRoleExpiryTimer(client) {
  if (roleExpiryTimer) return;
  const guild = client.guilds.cache.get(config.discord.guildId);
  cleanupExpiredRoles(guild);
  roleExpiryTimer = setInterval(() => {
    const g = client.guilds.cache.get(config.discord.guildId);
    cleanupExpiredRoles(g);
  }, 60 * 1000);
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
