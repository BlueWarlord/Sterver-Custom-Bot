const config = require("../../config");

const cfg = config.drops.density;
const events = new Map(); // channelId -> [{ t: timestampMs, u: userId }], oldest first

function channelIds() {
  const ids = config.drops.eligibleChannelIds;
  return ids && ids.length ? ids : [config.channels.generalChatId];
}
const eligible = new Set(channelIds());

function prune(arr, now) {
  const cutoff = now - cfg.windowSeconds * 1000;
  let i = 0;
  while (i < arr.length && arr[i].t < cutoff) i++;
  if (i > 0) arr.splice(0, i);
}

// Call for every incoming message. Only eligible channels are tracked.
function record(message, now = Date.now()) {
  if (!eligible.has(message.channel.id)) return;
  if (message.author.bot || message.webhookId || message.system) return;
  let arr = events.get(message.channel.id);
  if (!arr) { arr = []; events.set(message.channel.id, arr); }
  arr.push({ t: now, u: message.author.id });
  prune(arr, now);
}

// Messages per second over the sliding window, with each person's contribution capped.
function getDensity(channelId, now = Date.now()) {
  const arr = events.get(channelId);
  if (!arr) return 0;
  prune(arr, now);
  if (arr.length === 0) { events.delete(channelId); return 0; }
  let count = arr.length;
  if (cfg.perUserCap > 0) {
    const perUser = new Map();
    for (const e of arr) perUser.set(e.u, (perUser.get(e.u) || 0) + 1);
    count = 0;
    for (const n of perUser.values()) count += Math.min(n, cfg.perUserCap);
  }
  return count / cfg.windowSeconds;
}

// How fast a channel's drop clock runs: 0 below the threshold, 1x at refDensity, capped at maxMultiplier.
function multiplier(d) {
  if (d < cfg.minDensity) return 0;
  return Math.min(cfg.maxMultiplier, d / cfg.refDensity);
}

module.exports = { record, getDensity, multiplier, channelIds };
