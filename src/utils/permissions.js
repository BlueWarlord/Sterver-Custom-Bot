const config = require("../../config");

function memberRoleIds(member) {
  if (!member) return [];
  if (member.roles?.cache && typeof member.roles.cache.keys === "function") {
    return [...member.roles.cache.keys()];
  }
  if (Array.isArray(member.roles)) return member.roles;
  return [];
}

function channelAllowed(channelId) {
  const allowed = Array.isArray(config.commands.allowedChannelIds)
    ? config.commands.allowedChannelIds
    : [];
  return allowed.length === 0 || allowed.includes(channelId);
}

function commandAccess(member) {
  const allowed = Array.isArray(config.commands.allowedRoleIds)
    ? config.commands.allowedRoleIds
    : [];
  const denied = Array.isArray(config.commands.deniedRoleIds)
    ? config.commands.deniedRoleIds
    : [];
  if (allowed.length === 0 && denied.length === 0) return { ok: true };

  const roles = new Set(memberRoleIds(member));
  if (denied.some((roleId) => roles.has(roleId))) {
    return { ok: false, reason: "denied" };
  }
  if (allowed.length > 0 && !allowed.some((roleId) => roles.has(roleId))) {
    return { ok: false, reason: "not_allowed" };
  }
  return { ok: true };
}

module.exports = { memberRoleIds, channelAllowed, commandAccess };
