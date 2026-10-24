function isNumStr(v) {
  return typeof v === "string" && /^\d+$/.test(v);
}

function validate(cfg) {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    return ["config must be an object"];
  }

  const errors = [];
  const e = (msg) => errors.push(msg);

  // Required configuration sections
  const requiredSections = [
    "discord",
    "channels",
    "currency",
    "commands",
    "economy",
    "activity",
    "daily",
    "drops",
    "gift",
    "leaderboard",
    "storage",
    "gambling",
  ];

  for (const section of requiredSections) {
    if (
      !cfg[section] ||
      typeof cfg[section] !== "object" ||
      Array.isArray(cfg[section])
    ) {
      e(`${section} must be a configuration object`);
    }
  }

  // Prevent property-access errors when required sections are missing.
  if (errors.length > 0) {
    return errors;
  }

  // Discord configuration
  if (!isNumStr(cfg.discord.guildId)) {
    e("discord.guildId must be numeric string");
  }

  if (
    !isNumStr(cfg.channels.generalChatId) ||
    cfg.channels.generalChatId === "PASTE_CHANNEL_ID"
  ) {
    e("channels.generalChatId invalid");
  }

  // Currency configuration
  if (typeof cfg.currency.name !== "string" || !cfg.currency.name) {
    e("currency.name");
  }

  if (typeof cfg.currency.plural !== "string" || !cfg.currency.plural) {
    e("currency.plural");
  }

  // Command configuration
  if (
    typeof cfg.commands.prefix !== "string" ||
    !cfg.commands.prefix ||
    /\s/.test(cfg.commands.prefix)
  ) {
    e("commands.prefix");
  }

  // Economy configuration
  if (
    !Number.isInteger(cfg.economy.startingBalance) ||
    cfg.economy.startingBalance < 0
  ) {
    e("economy.startingBalance");
  }

  // Activity rewards
  if (
    !Number.isInteger(cfg.activity.cooldownSeconds) ||
    cfg.activity.cooldownSeconds <= 0
  ) {
    e("activity.cooldownSeconds");
  }

  if (
    !Number.isInteger(cfg.activity.amountMin) ||
    cfg.activity.amountMin < 0
  ) {
    e("activity.amountMin");
  }

  if (
    !Number.isInteger(cfg.activity.amountMax) ||
    cfg.activity.amountMax < 0
  ) {
    e("activity.amountMax");
  }

  if (cfg.activity.amountMin > cfg.activity.amountMax) {
    e("activity amountMin>amountMax");
  }

  if (
    !Array.isArray(cfg.activity.ignoredChannelIds) ||
    !cfg.activity.ignoredChannelIds.every(isNumStr)
  ) {
    e("activity.ignoredChannelIds");
  }

  // Daily rewards
  if (!Number.isInteger(cfg.daily.amountMin) || cfg.daily.amountMin < 0) {
    e("daily.amountMin");
  }

  if (!Number.isInteger(cfg.daily.amountMax) || cfg.daily.amountMax < 0) {
    e("daily.amountMax");
  }

  if (cfg.daily.amountMin > cfg.daily.amountMax) {
    e("daily amountMin>amountMax");
  }

  if (
    typeof cfg.daily.cooldownHours !== "number" ||
    !Number.isFinite(cfg.daily.cooldownHours) ||
    cfg.daily.cooldownHours <= 0
  ) {
    e("daily.cooldownHours");
  }

  // Random drops
  const d = cfg.drops;

  if (typeof d.enabled !== "boolean") {
    e("drops.enabled must be boolean");
  }

  if (
    !Array.isArray(d.channelIds) ||
    !d.channelIds.every(isNumStr)
  ) {
    e("drops.channelIds must be an array of numeric channel ID strings");
  } else if (d.enabled && d.channelIds.length === 0) {
    e("drops.channelIds must contain at least one channel when drops are enabled");
  }

  if (
    !Number.isInteger(d.intervalMinMinutes) ||
    d.intervalMinMinutes <= 0
  ) {
    e("drops.intervalMinMinutes must be a positive integer");
  }

  if (
    !Number.isInteger(d.intervalMaxMinutes) ||
    d.intervalMaxMinutes <= 0
  ) {
    e("drops.intervalMaxMinutes must be a positive integer");
  }

  if (
    Number.isInteger(d.intervalMinMinutes) &&
    Number.isInteger(d.intervalMaxMinutes) &&
    d.intervalMinMinutes > d.intervalMaxMinutes
  ) {
    e("drops.intervalMinMinutes cannot exceed intervalMaxMinutes");
  }

  if (!Number.isInteger(d.minGapMinutes) || d.minGapMinutes <= 0) {
    e("drops.minGapMinutes must be a positive integer");
  }

  if (!Number.isInteger(d.tickSeconds) || d.tickSeconds <= 0) {
    e("drops.tickSeconds must be a positive integer");
  }

  if (
    !Number.isInteger(d.densityWindowSeconds) ||
    d.densityWindowSeconds <= 0
  ) {
    e("drops.densityWindowSeconds must be a positive integer");
  }

  if (
    typeof d.minMessagesPerSecond !== "number" ||
    !Number.isFinite(d.minMessagesPerSecond) ||
    d.minMessagesPerSecond <= 0
  ) {
    e("drops.minMessagesPerSecond must be a positive number");
  }

  if (
    !Number.isInteger(d.maxMessagesPerUserPerWindow) ||
    d.maxMessagesPerUserPerWindow <= 0
  ) {
    e("drops.maxMessagesPerUserPerWindow must be a positive integer");
  }

  if (
    typeof d.rateSensitivity !== "number" ||
    !Number.isFinite(d.rateSensitivity) ||
    d.rateSensitivity <= 0
  ) {
    e("drops.rateSensitivity must be a positive number");
  }

  if (
    typeof d.maxRateMultiplier !== "number" ||
    !Number.isFinite(d.maxRateMultiplier) ||
    d.maxRateMultiplier < 1
  ) {
    e("drops.maxRateMultiplier must be at least 1");
  }

  if (
    !Number.isInteger(d.claimWindowMinutes) ||
    d.claimWindowMinutes <= 0
  ) {
    e("drops.claimWindowMinutes must be a positive integer");
  }

  if (
    !Number.isInteger(d.deleteAfterExpirySeconds) ||
    d.deleteAfterExpirySeconds < 0
  ) {
    e("drops.deleteAfterExpirySeconds must be a non-negative integer");
  }

  if (
    !Number.isInteger(d.deleteAfterClaimSeconds) ||
    d.deleteAfterClaimSeconds < 0
  ) {
    e("drops.deleteAfterClaimSeconds must be a non-negative integer");
  }

  if (typeof d.allowNegativeAmounts !== "boolean") {
    e("drops.allowNegativeAmounts must be boolean");
  }

  if (!Number.isInteger(d.maxPositiveAmount) || d.maxPositiveAmount < 1) {
    e("drops.maxPositiveAmount must be a positive integer");
  }

  if (!Number.isInteger(d.maxNegativeAmount) || d.maxNegativeAmount < 0) {
    e("drops.maxNegativeAmount must be a non-negative integer");
  }

  if (
    d.allowNegativeAmounts &&
    Number.isInteger(d.maxNegativeAmount) &&
    d.maxNegativeAmount < 1
  ) {
    e("drops.maxNegativeAmount must be positive when negative drops are enabled");
  }

  if (typeof d.imageUrl !== "string") {
    e("drops.imageUrl must be a string");
  }

  if (!Array.isArray(d.table) || d.table.length === 0) {
    e("drops.table must be a non-empty array");
  } else {
    let totalWeight = 0;
    let usableWeight = 0;

    for (const entry of d.table) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        e("drops.table entries must be objects");
        continue;
      }

      const validMin = Number.isInteger(entry.min);
      const validMax = Number.isInteger(entry.max);
      const validWeight =
        Number.isInteger(entry.weight) && entry.weight > 0;

      if (!validWeight) {
        e("drops.table entries must have positive integer weights");
      } else {
        totalWeight += entry.weight;
      }

      if (!validMin) {
        e("drops.table entry min must be an integer");
      }

      if (!validMax) {
        e("drops.table entry max must be an integer");
      }

      if (validMin && validMax) {
        if (entry.min > entry.max) {
          e("drops.table entry min cannot exceed max");
          continue;
        }

        if (entry.min < 0 && entry.max >= 0) {
          e("drops.table ranges must not cross zero");
        }

        const isNegativeEntry = entry.min < 0;

        if (d.allowNegativeAmounts || !isNegativeEntry) {
          if (validWeight) {
            usableWeight += entry.weight;
          }
        }

        // Enforce positive amount cap.
        if (
          entry.min >= 0 &&
          Number.isInteger(d.maxPositiveAmount) &&
          d.maxPositiveAmount >= 1 &&
          entry.max > d.maxPositiveAmount
        ) {
          e("drops.table positive range exceeds drops.maxPositiveAmount");
        }

        // Enforce negative amount cap.
        if (
          entry.min < 0 &&
          Number.isInteger(d.maxNegativeAmount) &&
          d.maxNegativeAmount >= 0 &&
          entry.min < -d.maxNegativeAmount
        ) {
          e("drops.table negative range exceeds drops.maxNegativeAmount");
        }
      }
    }

    if (totalWeight <= 0) {
      e("drops.table total weight must be positive");
    }

    if (usableWeight <= 0) {
      e("drops.table must have at least one usable entry");
    }
  }

  // Gifts
  if (!Number.isInteger(cfg.gift.minAmount) || cfg.gift.minAmount <= 0) {
    e("gift.minAmount");
  }

  if (
    cfg.gift.maxAmount !== null &&
    (
      !Number.isInteger(cfg.gift.maxAmount) ||
      cfg.gift.maxAmount < cfg.gift.minAmount
    )
  ) {
    e("gift.maxAmount");
  }

  // Leaderboard
  if (
    !Number.isInteger(cfg.leaderboard.size) ||
    cfg.leaderboard.size < 1 ||
    cfg.leaderboard.size > 25
  ) {
    e("leaderboard.size");
  }

  // Storage
  if (
    !Number.isInteger(cfg.storage.flushIntervalMs) ||
    cfg.storage.flushIntervalMs < 500
  ) {
    e("storage.flushIntervalMs");
  }

  if (
    !Number.isInteger(cfg.storage.backupIntervalMinutes) ||
    cfg.storage.backupIntervalMinutes <= 0
  ) {
    e("storage.backupIntervalMinutes");
  }

  if (
    !Number.isInteger(cfg.storage.backupsToKeep) ||
    cfg.storage.backupsToKeep <= 0
  ) {
    e("storage.backupsToKeep");
  }

  // Gambling
  if (typeof cfg.gambling.enabled !== "boolean") {
    e("gambling.enabled");
  }

  if (!Number.isInteger(cfg.gambling.minBet) || cfg.gambling.minBet < 1) {
    e("gambling.minBet");
  }

  if (
    !Number.isInteger(cfg.gambling.maxBet) ||
    cfg.gambling.maxBet < cfg.gambling.minBet
  ) {
    e("gambling.maxBet");
  }

  if (
    !Number.isInteger(cfg.gambling.cooldownSeconds) ||
    cfg.gambling.cooldownSeconds <= 0
  ) {
    e("gambling.cooldownSeconds");
  }

  // Blackjack configuration is optional.
  if (cfg.blackjack !== undefined) {
    if (
      !cfg.blackjack ||
      typeof cfg.blackjack !== "object" ||
      Array.isArray(cfg.blackjack)
    ) {
      e("blackjack must be a configuration object");
    } else {
      if (
        !Number.isInteger(cfg.blackjack.minBet) ||
        cfg.blackjack.minBet < 1
      ) {
        e("blackjack.minBet");
      }

      if (
        !Number.isInteger(cfg.blackjack.maxBet) ||
        cfg.blackjack.maxBet < cfg.blackjack.minBet
      ) {
        e("blackjack.maxBet");
      }

      if (
        !Number.isInteger(cfg.blackjack.cooldownSeconds) ||
        cfg.blackjack.cooldownSeconds <= 0
      ) {
        e("blackjack.cooldownSeconds");
      }

      if (
        typeof cfg.blackjack.blackjackPayout !== "number" ||
        !Number.isFinite(cfg.blackjack.blackjackPayout) ||
        cfg.blackjack.blackjackPayout <= 0
      ) {
        e("blackjack.blackjackPayout");
      }

      if (typeof cfg.blackjack.dealerHitsSoft17 !== "boolean") {
        e("blackjack.dealerHitsSoft17");
      }

      if (
        !Number.isInteger(cfg.blackjack.timeoutMs) ||
        cfg.blackjack.timeoutMs <= 0
      ) {
        e("blackjack.timeoutMs");
      }
    }
  }

  return errors;
}

module.exports = { validate };
