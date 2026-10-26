const crypto = require("node:crypto");

const TWO_POW_48 = 2 ** 48;

// Cryptographically secure uniform float in [0, 1).
function randomFloat() {
  return crypto.randomInt(0, TWO_POW_48 - 1) / (TWO_POW_48 - 1);
}

// Inclusive integer range backed by the operating system CSPRNG.
function randomInt(min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new TypeError("randomInt requires integer bounds");
  }
  if (max < min) {
    throw new RangeError("randomInt max must be >= min");
  }
  return crypto.randomInt(min, max + 1);
}

// Weighted selection for integer weights. Returns null for an empty table.
function weightedPick(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isSafeInteger(total) || total <= 0) return null;
  let roll = randomInt(0, total - 1);
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
}

// Fisher-Yates shuffle using crypto randomness unless a test RNG is supplied.
function shuffle(items, rng) {
  const source = typeof rng === "function" ? rng : randomFloat;
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(source() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

function randomToken(bytes = 8) {
  return crypto.randomBytes(bytes).toString("hex");
}

module.exports = { randomFloat, randomInt, weightedPick, shuffle, randomToken };
