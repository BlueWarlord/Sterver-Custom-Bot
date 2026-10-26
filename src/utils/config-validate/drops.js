const { isNumStr } = require("./helpers");

// Random drop scheduling, activity thresholds, and reward table safety.
function validateDrops(e, cfg) {
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

  if (!Number.isInteger(d.pickCooldownSeconds) || d.pickCooldownSeconds < 0) {
    e("drops.pickCooldownSeconds must be a non-negative integer");
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

  if (typeof d.imagePath !== "string") {
    e("drops.imagePath must be a string");
  } else if (d.imagePath.trim()) {
    const normalized = d.imagePath.replace(/\\/g, "/");
    if (normalized.split("/").includes("..")) {
      e("drops.imagePath must stay inside the assets directory");
    }
    if (!/\.(png|jpe?g|gif|webp)$/i.test(normalized)) {
      e("drops.imagePath must point to a png/jpeg/gif/webp image");
    }
  }

  if (!Array.isArray(d.table) || d.table.length === 0) {
    e("drops.table must be a non-empty array");
  } else {
    validateDropTable(e, d);
  }
}

function validateDropTable(e, d) {
  let totalWeight = 0;
  let usableWeight = 0;

  for (const entry of d.table) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      e("drops.table entries must be objects");
      continue;
    }

    const validMin = Number.isInteger(entry.min);
    const validMax = Number.isInteger(entry.max);
    const validWeight = Number.isInteger(entry.weight) && entry.weight > 0;

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

    if (!validMin || !validMax) continue;

    if (entry.min > entry.max) {
      e("drops.table entry min cannot exceed max");
      continue;
    }

    if (entry.min < 0 && entry.max >= 0) {
      e("drops.table ranges must not cross zero");
    }

    if (!d.allowNegativeAmounts && entry.min < 0) {
      e("drops.table negative entries require drops.allowNegativeAmounts=true");
    }

    const isNegativeEntry = entry.min < 0;
    if ((d.allowNegativeAmounts || !isNegativeEntry) && validWeight) {
      usableWeight += entry.weight;
    }

    if (
      entry.min >= 0 &&
      Number.isInteger(d.maxPositiveAmount) &&
      d.maxPositiveAmount >= 1 &&
      entry.max > d.maxPositiveAmount
    ) {
      e("drops.table positive range exceeds drops.maxPositiveAmount");
    }

    if (
      entry.min < 0 &&
      Number.isInteger(d.maxNegativeAmount) &&
      d.maxNegativeAmount >= 0 &&
      entry.min < -d.maxNegativeAmount
    ) {
      e("drops.table negative range exceeds drops.maxNegativeAmount");
    }
  }

  if (totalWeight <= 0) {
    e("drops.table total weight must be positive");
  }

  if (usableWeight <= 0) {
    e("drops.table must have at least one usable entry");
  }
}

module.exports = { validateDrops };
