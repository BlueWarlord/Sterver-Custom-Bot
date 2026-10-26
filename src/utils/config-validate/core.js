const { isNumStr } = require("./helpers");

// Discord identity, presentation, command access, and the appeal link.
function validateCore(e, cfg) {
  if (!isNumStr(cfg.discord.guildId)) {
    e("discord.guildId must be numeric string");
  }

  if (
    !isNumStr(cfg.channels.generalChatId) ||
    cfg.channels.generalChatId === "PASTE_CHANNEL_ID"
  ) {
    e("channels.generalChatId invalid");
  }

  if (typeof cfg.currency.name !== "string" || !cfg.currency.name) {
    e("currency.name");
  }

  if (typeof cfg.currency.plural !== "string" || !cfg.currency.plural) {
    e("currency.plural");
  }

  if (
    typeof cfg.commands.prefix !== "string" ||
    !cfg.commands.prefix ||
    /\s/.test(cfg.commands.prefix)
  ) {
    e("commands.prefix");
  }

  if (
    cfg.commands.allowedChannelIds !== undefined &&
    (
      !Array.isArray(cfg.commands.allowedChannelIds) ||
      !cfg.commands.allowedChannelIds.every(isNumStr)
    )
  ) {
    e("commands.allowedChannelIds");
  }

  for (const key of ["allowedRoleIds", "deniedRoleIds"]) {
    if (
      cfg.commands[key] !== undefined &&
      (
        !Array.isArray(cfg.commands[key]) ||
        !cfg.commands[key].every(isNumStr)
      )
    ) {
      e(`commands.${key}`);
    }
  }

  if (
    Array.isArray(cfg.commands.allowedRoleIds) &&
    Array.isArray(cfg.commands.deniedRoleIds)
  ) {
    const denied = new Set(cfg.commands.deniedRoleIds);
    if (cfg.commands.allowedRoleIds.some((id) => denied.has(id))) {
      e("commands.allowedRoleIds and commands.deniedRoleIds must not overlap");
    }
  }

  if (cfg.commands.rateLimit !== undefined) {
    const limit = cfg.commands.rateLimit;
    if (!limit || typeof limit !== "object" || Array.isArray(limit)) {
      e("commands.rateLimit must be an object");
    } else {
      if (!Number.isInteger(limit.windowSeconds) || limit.windowSeconds <= 0) {
        e("commands.rateLimit.windowSeconds");
      }
      if (!Number.isInteger(limit.max) || limit.max < 0) {
        e("commands.rateLimit.max");
      }
    }
  }

  if (cfg.appeal !== undefined) {
    if (!cfg.appeal || typeof cfg.appeal !== "object" || Array.isArray(cfg.appeal)) {
      e("appeal must be an object");
    } else if (typeof cfg.appeal.url !== "string") {
      e("appeal.url must be a string");
    } else if (cfg.appeal.url.length > 0 && !/^https?:\/\//i.test(cfg.appeal.url)) {
      e("appeal.url must be an http(s) URL");
    }
  }
}

module.exports = { validateCore };
