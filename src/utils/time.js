const { randomFloat } = require("./random");

function now() {
  return Date.now();
}

function cooldownRemaining(lastAt, cooldownMs, current = now()) {
  if (lastAt == null) return 0;
  const remaining = (lastAt + cooldownMs) - current;
  return remaining > 0 ? remaining : 0;
}

function randomIntervalMs(minMinutes, maxMinutes) {
  return (minMinutes + randomFloat() * (maxMinutes - minMinutes)) * 60000;
}

module.exports = { now, cooldownRemaining, randomIntervalMs };
