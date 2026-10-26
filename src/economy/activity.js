const config = require("../../config");
const store = require("./store");
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
  const timestamp = now();
  const cooldownMs = config.activity.cooldownSeconds * 1000;

  // Avoid dirtying the store on every chat message while the user is on
  // cooldown. The check is repeated inside the transaction below.
  const existing = store.getUser(userId);
  if (
    existing &&
    existing.lastActivityRewardAt != null &&
    timestamp - existing.lastActivityRewardAt < cooldownMs
  ) {
    return;
  }

  store.update((data) => {
    const { user } = store.ensureUserIn(data, userId);
    if (user.lastActivityRewardAt != null && timestamp - user.lastActivityRewardAt < cooldownMs) {
      return;
    }
    const amount = randomInt(config.activity.amountMin, config.activity.amountMax);
    if (!Number.isSafeInteger(user.balance + amount)) return;
    user.balance += amount;
    user.totalEarned += amount;
    user.lastActivityRewardAt = timestamp;
  });
}

module.exports = { tryReward };
