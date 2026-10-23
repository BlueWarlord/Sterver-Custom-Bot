const config = require("../../config");
function now(){ return Date.now(); }
function cooldownRemaining(lastAt, cooldownMs, n = now()){ if (lastAt == null) return 0; const rem = (lastAt + cooldownMs) - n; return rem > 0 ? rem : 0; }
function randomIntervalMs(minMinutes, maxMinutes){ return (minMinutes + Math.random()*(maxMinutes-minMinutes))*60000; }
module.exports = { now, cooldownRemaining, randomIntervalMs };
