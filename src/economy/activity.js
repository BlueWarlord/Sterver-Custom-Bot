const config = require("../../config");
const store = require("./store");
const wallet = require("./wallet");
const { now } = require("../utils/time");
const { randomInt } = require("../utils/random");

function tryReward(message) {
  if (!config.activity.enabled) return;
  if (!message.guild || message.guild.id !== config.discord.guildId) return;
  if (message.author.bot) return;
  if (message.webhookId) return;
  if (config.activity.ignoredChannelIds.includes(message.channel.id)) return;
  if (message.system) return;
  const userId = message.author.id;
  const u = store.getUser(userId);
  const last = u ? u.lastActivityRewardAt : null;
  const cooldownMs = config.activity.cooldownSeconds * 1000;
  const t = now();
  if (last != null && t - last < cooldownMs) return;
  const amount = randomInt(config.activity.amountMin, config.activity.amountMax);
  const rec = store.ensureUser(userId);
  rec.balance += amount;
  rec.totalEarned += amount;
  rec.lastActivityRewardAt = t;
  store.update(() => {});
}

module.exports = { tryReward };
