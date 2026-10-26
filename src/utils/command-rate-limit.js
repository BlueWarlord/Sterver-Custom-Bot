const config = require("../../config");

const buckets = new Map();
let lastSweepAt = 0;

function windowMs() {
  const limit = config.commands.rateLimit || {};
  const seconds = Number.isFinite(limit.windowSeconds) && limit.windowSeconds > 0
    ? limit.windowSeconds
    : 5;
  return seconds * 1000;
}

function allowed(userId) {
  const limit = config.commands.rateLimit;
  if (!limit || !Number.isSafeInteger(limit.max) || limit.max <= 0) return true;

  const timestamp = Date.now();
  const window = windowMs();
  if (timestamp - lastSweepAt > 60000) {
    for (const [id, bucket] of buckets) {
      if (timestamp - bucket.start >= window) buckets.delete(id);
    }
    lastSweepAt = timestamp;
  }

  let bucket = buckets.get(userId);
  if (!bucket || timestamp - bucket.start >= window) {
    bucket = { start: timestamp, count: 0 };
    buckets.set(userId, bucket);
  }

  if (bucket.count >= limit.max) return false;
  bucket.count += 1;
  return true;
}

function reset() {
  buckets.clear();
  lastSweepAt = 0;
}

module.exports = { allowed, reset };
