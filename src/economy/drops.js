const fs = require("node:fs");
const path = require("node:path");

const config = require("../../config");
const wallet = require("./wallet");
const logger = require("../utils/logger");
const { randomInt, randomToken, weightedPick } = require("../utils/random");

const drops = new Map();
const channelActivity = new Map();
const channelClocks = new Map();
const pickCooldowns = new Map();

let clientRef = null;
let tickHandle = null;
let lastTickAt = 0;

const DROP_CONFIG = config.drops;
const ASSET_ROOT = path.resolve(process.cwd(), "assets");
const ALLOWED_IMAGE = /\.(png|jpe?g|gif|webp)$/i;

function getChannelIds() {
  return Array.isArray(DROP_CONFIG.channelIds) ? DROP_CONFIG.channelIds : [];
}

function getDropTable() {
  const table = Array.isArray(DROP_CONFIG.table) ? DROP_CONFIG.table : [];
  return table.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    if (!Number.isInteger(entry.weight) || entry.weight <= 0) return false;
    if (!Number.isInteger(entry.min) || !Number.isInteger(entry.max)) return false;
    if (entry.min > entry.max) return false;
    if (entry.min < 0 && entry.max >= 0) return false;
    if (!DROP_CONFIG.allowNegativeAmounts && entry.min < 0) return false;
    return true;
  });
}

function randomTargetSeconds() {
  return randomInt(
    DROP_CONFIG.intervalMinMinutes * 60,
    DROP_CONFIG.intervalMaxMinutes * 60
  );
}

function getRecentActivity(channelId, timestamp = Date.now()) {
  const windowMs = DROP_CONFIG.densityWindowSeconds * 1000;
  const cutoff = timestamp - windowMs;
  const entries = channelActivity.get(channelId) || [];

  const recent = entries.filter((entry) => entry.at >= cutoff);
  channelActivity.set(channelId, recent);

  // Limit how much one person can contribute to the activity rate.
  const perUserCounts = new Map();
  const allowed = [];

  for (let i = recent.length - 1; i >= 0; i--) {
    const entry = recent[i];
    const count = perUserCounts.get(entry.userId) || 0;
    if (count >= DROP_CONFIG.maxMessagesPerUserPerWindow) continue;
    perUserCounts.set(entry.userId, count + 1);
    allowed.push(entry);
  }

  return allowed.length / DROP_CONFIG.densityWindowSeconds;
}

function activityMultiplier(messagesPerSecond) {
  const threshold = DROP_CONFIG.minMessagesPerSecond;
  if (messagesPerSecond < threshold) return 0;

  return Math.min(
    DROP_CONFIG.maxRateMultiplier,
    Math.pow(messagesPerSecond / threshold, DROP_CONFIG.rateSensitivity)
  );
}

function observeMessage(message) {
  if (!DROP_CONFIG.enabled) return;
  if (!message || !message.guild || message.guild.id !== config.discord.guildId) return;
  if (message.author?.bot) return;
  if (!getChannelIds().includes(message.channelId)) return;

  // Don't let claiming a drop itself count as chat activity.
  const prefix = config.commands?.prefix || ".";
  if (message.content?.trim().toLowerCase() === `${prefix}pick`) return;

  const timestamp = Date.now();
  const entries = channelActivity.get(message.channelId) || [];
  entries.push({ at: timestamp, userId: message.author.id });
  channelActivity.set(message.channelId, entries);

  // Keep the activity collection bounded to the configured window.
  getRecentActivity(message.channelId, timestamp);
}

function getImageAttachment() {
  const imagePath = DROP_CONFIG.imagePath;
  if (typeof imagePath !== "string" || imagePath.trim() === "") return [];

  const absolutePath = path.resolve(process.cwd(), imagePath);
  if (!ALLOWED_IMAGE.test(absolutePath)) {
    logger.warn("drop image rejected: extension is not allowed", { imagePath });
    return [];
  }

  let realPath;
  try {
    realPath = fs.realpathSync(absolutePath);
  } catch (_) {
    logger.warn("drop image not found; posting text only", { imagePath });
    return [];
  }

  const relative = path.relative(ASSET_ROOT, realPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    logger.warn("drop image rejected: path is outside the assets directory", { imagePath });
    return [];
  }

  try {
    if (!fs.statSync(realPath).isFile()) return [];
  } catch (_) {
    return [];
  }

  return [{ attachment: realPath, name: path.basename(realPath) }];
}

function armDropExpiry(drop) {
  if (drop.expiryTimer) clearTimeout(drop.expiryTimer);
  const remainingMs = Math.max(0, drop.expiresAt - Date.now());
  drop.expiryTimer = setTimeout(() => expireDrop(drop), remainingMs);
}

function scheduleDelete(drop, delaySeconds) {
  const delay = Math.max(0, delaySeconds) * 1000;

  drop.deleteTimer = setTimeout(async () => {
    try {
      const channel =
        clientRef.channels.cache.get(drop.channelId) ||
        await clientRef.channels.fetch(drop.channelId).catch(() => null);

      if (channel?.isTextBased() && channel.messages) {
        await channel.messages.delete(drop.messageId).catch(() => {});
      }
    } catch (error) {
      logger.warn("could not delete drop message", {
        messageId: drop.messageId,
        error,
      });
    } finally {
      drops.delete(drop.id);
    }
  }, delay);
}

async function expireDrop(drop) {
  if (drop.claimed || drop.expired) return;
  drop.expired = true;

  try {
    const channel =
      clientRef.channels.cache.get(drop.channelId) ||
      await clientRef.channels.fetch(drop.channelId).catch(() => null);

    if (channel?.isTextBased() && channel.messages) {
      const message = await channel.messages.fetch(drop.messageId).catch(() => null);
      if (message) {
        await message.edit({
          content: DROP_CONFIG.expiredText || "This drop has expired.",
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }
    }
  } catch (error) {
    logger.warn("could not update expired drop", {
      messageId: drop.messageId,
      error,
    });
  }

  scheduleDelete(drop, DROP_CONFIG.deleteAfterExpirySeconds);
}

function pickDropAmount(entry) {
  let amount = randomInt(entry.min, entry.max);
  if (amount > 0) {
    amount = Math.min(amount, DROP_CONFIG.maxPositiveAmount);
  } else if (amount < 0) {
    amount = -Math.min(-amount, DROP_CONFIG.maxNegativeAmount);
  }
  return amount;
}

async function postDrop(channelId, messagesPerSecond, multiplier) {
  try {
    const channel =
      clientRef.channels.cache.get(channelId) ||
      await clientRef.channels.fetch(channelId).catch(() => null);

    if (!channel || !channel.isTextBased() || !channel.send) {
      logger.warn("drop channel unavailable", { channelId });
      return;
    }

    const table = getDropTable();
    const entry = weightedPick(table);
    if (!entry) {
      logger.error("drop table has no usable entries");
      return;
    }

    const amount = pickDropAmount(entry);
    const id = `${Date.now().toString(36)}-${randomToken(4)}`;
    const content =
      DROP_CONFIG.dropText?.replace("{amount}", amount.toString()) ||
      `A SterCoin drop of ${amount} appeared! Type \`.pick\` to claim it.`;

    const message = await channel.send({
      content,
      files: getImageAttachment(),
      allowedMentions: { parse: [] },
    });

    const drop = {
      id,
      channelId,
      messageId: message.id,
      amount,
      createdAt: Date.now(),
      expiresAt: Date.now() + DROP_CONFIG.claimWindowMinutes * 60_000,
      claimed: false,
      expired: false,
      expiryTimer: null,
      deleteTimer: null,
    };
    drops.set(id, drop);
    armDropExpiry(drop);

    logger.info("drop posted", {
      channelId,
      amount,
      messagesPerSecond: Number(messagesPerSecond.toFixed(3)),
      multiplier: Number(multiplier.toFixed(2)),
    });
  } catch (error) {
    logger.error("drop post failed", { error });
  }
}

async function pick(message) {
  if (!message?.guild || message.guild.id !== config.discord.guildId) return;
  if (message.author?.bot) return;
  if (!getChannelIds().includes(message.channelId)) return;

  const now = Date.now();
  const cooldownMs = Math.max(0, Number(DROP_CONFIG.pickCooldownSeconds) || 0) * 1000;
  if (cooldownMs > 0) {
    const lastPickAt = pickCooldowns.get(message.author.id) || 0;
    if (now - lastPickAt < cooldownMs) return;
    pickCooldowns.set(message.author.id, now);

    if (pickCooldowns.size > 5000) {
      const cutoff = now - cooldownMs;
      for (const [userId, timestamp] of pickCooldowns) {
        if (timestamp < cutoff) pickCooldowns.delete(userId);
      }
    }
  }

  // Find the first available drop in the channel.
  const drop = [...drops.values()].find(
    (candidate) =>
      candidate.channelId === message.channelId &&
      !candidate.claimed &&
      !candidate.expired &&
      now < candidate.expiresAt
  );

  if (!drop) {
    await message.reply({
      content: "There isn't an available drop in this channel.",
      allowedMentions: { parse: [], repliedUser: false },
    }).catch(() => {});
    return;
  }

  // Mark it claimed before any asynchronous work, preventing double claims.
  drop.claimed = true;
  if (drop.expiryTimer) clearTimeout(drop.expiryTimer);

  let actualChange = 0;
  let resultText = "";

  if (drop.amount > 0) {
    const result = wallet.credit(message.author.id, drop.amount, "drop");
    if (!result.ok) {
      drop.claimed = false;
      armDropExpiry(drop);
      await message.reply({
        content: "I couldn't credit your wallet. Please try again.",
        allowedMentions: { parse: [], repliedUser: false },
      }).catch(() => {});
      return;
    }
    actualChange = drop.amount;
    resultText = `You claimed **${actualChange} SterCoins**!`;
  } else if (drop.amount === 0) {
    resultText = "You claimed the drop, but it contained no SterCoins.";
  } else {
    // A negative drop can take only what the user currently has.
    const balance = Math.max(0, wallet.getBalance(message.author.id));
    const actualLoss = Math.min(balance, Math.abs(drop.amount));

    if (actualLoss > 0) {
      const result = wallet.debit(message.author.id, actualLoss, "drop");
      if (!result.ok) {
        drop.claimed = false;
        armDropExpiry(drop);
        await message.reply({
          content: "I couldn't update your wallet. Please try again.",
          allowedMentions: { parse: [], repliedUser: false },
        }).catch(() => {});
        return;
      }
    }

    actualChange = -actualLoss;
    resultText = actualLoss > 0
      ? `You claimed the drop and lost **${actualLoss} SterCoins**.`
      : "You claimed the negative drop, but you had no SterCoins to lose.";
  }

  logger.info("drop claimed", {
    dropId: drop.id,
    userId: message.author.id,
    rolledAmount: drop.amount,
    actualChange,
  });

  try {
    const channel =
      clientRef.channels.cache.get(drop.channelId) ||
      await clientRef.channels.fetch(drop.channelId).catch(() => null);

    if (channel?.isTextBased() && channel.messages) {
      const dropMessage = await channel.messages.fetch(drop.messageId).catch(() => null);
      if (dropMessage) {
        await dropMessage.edit({
          content: `Drop claimed by <@${message.author.id}>!`,
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }
    }
  } catch (_) {}

  await message.reply({
    content: resultText,
    allowedMentions: { parse: [], repliedUser: false },
  }).catch(() => {});
  scheduleDelete(drop, DROP_CONFIG.deleteAfterClaimSeconds);
}

function tick() {
  try {
    const now = Date.now();
    const elapsedSeconds = Math.min(
      Math.max(0, (now - lastTickAt) / 1000),
      DROP_CONFIG.tickSeconds * 3
    );
    lastTickAt = now;

    for (const channelId of getChannelIds()) {
      let clock = channelClocks.get(channelId);
      if (!clock) {
        clock = {
          effectiveSeconds: 0,
          targetSeconds: randomTargetSeconds(),
          lastDropAt: 0,
          posting: false,
        };
        channelClocks.set(channelId, clock);
      }

      if (clock.posting) continue;

      const messagesPerSecond = getRecentActivity(channelId, now);
      const multiplier = activityMultiplier(messagesPerSecond);

      // Quiet channels do not progress toward a drop.
      if (multiplier === 0) continue;

      clock.effectiveSeconds += elapsedSeconds * multiplier;
      if (clock.effectiveSeconds < clock.targetSeconds) continue;

      const minimumGapMs = DROP_CONFIG.minGapMinutes * 60_000;
      if (now - clock.lastDropAt < minimumGapMs) continue;

      clock.effectiveSeconds = 0;
      clock.targetSeconds = randomTargetSeconds();
      clock.lastDropAt = now;
      clock.posting = true;

      postDrop(channelId, messagesPerSecond, multiplier)
        .finally(() => {
          clock.posting = false;
        });
    }
  } catch (error) {
    logger.error("drop tick failed", { error });
  }
}

function init(client) {
  if (tickHandle) clearInterval(tickHandle);
  clientRef = client;

  if (!DROP_CONFIG.enabled) {
    logger.info("random drops are disabled");
    return;
  }

  const timestamp = Date.now();
  for (const channelId of getChannelIds()) {
    channelClocks.set(channelId, {
      effectiveSeconds: 0,
      targetSeconds: randomTargetSeconds(),
      lastDropAt: timestamp,
      posting: false,
    });
  }

  lastTickAt = timestamp;
  tickHandle = setInterval(tick, DROP_CONFIG.tickSeconds * 1000);

  logger.info("random drops initialized", {
    channels: getChannelIds().length,
  });
}

function stop() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  for (const drop of drops.values()) {
    if (drop.expiryTimer) clearTimeout(drop.expiryTimer);
    if (drop.deleteTimer) clearTimeout(drop.deleteTimer);
  }
  drops.clear();
  channelActivity.clear();
  channelClocks.clear();
  pickCooldowns.clear();
  clientRef = null;
}

function verifyChannel(client) {
  for (const channelId of getChannelIds()) {
    if (!client.channels.cache.has(channelId)) {
      logger.warn("drop channel not cached; it will be fetched when needed", {
        channelId,
      });
    }
  }
}

module.exports = {
  init,
  stop,
  verifyChannel,
  observeMessage,
  pick,
};
