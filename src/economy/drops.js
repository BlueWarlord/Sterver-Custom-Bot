const fs = require("node:fs");
const path = require("node:path");

const config = require("../../config");
const wallet = require("./wallet");
const logger = require("../utils/logger");

const drops = new Map();
const channelActivity = new Map();
const channelClocks = new Map();

let clientRef = null;
let tickHandle = null;
let lastTickAt = 0;

const DROP_CONFIG = config.drops;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(table) {
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of table) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }

  return table[table.length - 1];
}

function randomTargetSeconds() {
  return randomInt(
    DROP_CONFIG.intervalMinMinutes * 60,
    DROP_CONFIG.intervalMaxMinutes * 60
  );
}

function getChannelIds() {
  return Array.isArray(DROP_CONFIG.channelIds)
    ? DROP_CONFIG.channelIds
    : [];
}

function getRecentActivity(channelId, now = Date.now()) {
  const windowMs = DROP_CONFIG.densityWindowSeconds * 1000;
  const cutoff = now - windowMs;
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

  const sensitivity = DROP_CONFIG.rateSensitivity;
  const maxMultiplier = DROP_CONFIG.maxRateMultiplier;

  return Math.min(
    maxMultiplier,
    Math.pow(messagesPerSecond / threshold, sensitivity)
  );
}

function observeMessage(message) {
  if (!DROP_CONFIG.enabled) return;
  if (!message || !message.guild || message.author?.bot) return;
  if (!getChannelIds().includes(message.channelId)) return;

  // Don't let claiming a drop itself count as chat activity.
  const prefix = config.commands?.prefix || ".";
  if (message.content?.trim().toLowerCase() === `${prefix}pick`) return;

  const now = Date.now();
  const entries = channelActivity.get(message.channelId) || [];

  entries.push({
    at: now,
    userId: message.author.id,
  });

  channelActivity.set(message.channelId, entries);

  // Keep the activity collection bounded to the configured window.
  getRecentActivity(message.channelId, now);
}

function getImageAttachment() {
  const imagePath = DROP_CONFIG.imagePath;

  if (typeof imagePath !== "string" || imagePath.trim() === "") {
    return [];
  }

  const absolutePath = path.resolve(process.cwd(), imagePath);

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    logger.warn("drop image not found; posting text only", {
      imagePath: absolutePath,
    });
    return [];
  }

  return [{
    attachment: absolutePath,
    name: path.basename(absolutePath),
  }];
}

function scheduleDelete(drop, delaySeconds) {
  const delay = Math.max(0, delaySeconds) * 1000;

  setTimeout(async () => {
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
        error: error.message,
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
      const message = await channel.messages
        .fetch(drop.messageId)
        .catch(() => null);

      if (message) {
        await message.edit({
          content: DROP_CONFIG.expiredText || "This drop has expired.",
        }).catch(() => {});
      }
    }
  } catch (error) {
    logger.warn("could not update expired drop", {
      messageId: drop.messageId,
      error: error.message,
    });
  }

  scheduleDelete(drop, DROP_CONFIG.deleteAfterExpirySeconds);
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

    const entry = weightedPick(DROP_CONFIG.table);
    const amount = randomInt(entry.min, entry.max);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const content =
      DROP_CONFIG.dropText ||
      "A SterCoin drop appeared! Type `.pick` to claim it.";

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
    };

    drops.set(id, drop);

    drop.expiryTimer = setTimeout(
      () => expireDrop(drop),
      DROP_CONFIG.claimWindowMinutes * 60_000
    );

    logger.info("drop posted", {
      channelId,
      amount,
      messagesPerSecond: Number(messagesPerSecond.toFixed(3)),
      multiplier: Number(multiplier.toFixed(2)),
    });
  } catch (error) {
    logger.error("drop post failed", { error: error.message });
  }
}

async function pick(message) {
  if (!message?.guild || message.author?.bot) return;

  const now = Date.now();

  // Find the first available drop in the channel.
  const drop = [...drops.values()].find(
    (candidate) =>
      candidate.channelId === message.channelId &&
      !candidate.claimed &&
      !candidate.expired &&
      now < candidate.expiresAt
  );

  if (!drop) {
    await message.reply("There isn't an available drop in this channel.").catch(() => {});
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
      await message.reply("I couldn't credit your wallet. Please try again.").catch(() => {});
      return;
    }

    actualChange = drop.amount;
    resultText = `You claimed **${actualChange} SterCoins**!`;
  } else {
    // A negative drop can take only what the user currently has.
    // The balance can never go below zero.
    const balance = Math.max(0, wallet.getBalance(message.author.id));
    const requestedLoss = Math.abs(drop.amount);
    const actualLoss = Math.min(balance, requestedLoss);

    if (actualLoss > 0) {
      const result = wallet.debit(message.author.id, actualLoss, "drop");

      if (!result.ok) {
        drop.claimed = false;
        await message.reply("I couldn't update your wallet. Please try again.").catch(() => {});
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
      const dropMessage = await channel.messages
        .fetch(drop.messageId)
        .catch(() => null);

      if (dropMessage) {
        await dropMessage.edit({
          content: `Drop claimed by <@${message.author.id}>!`,
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }
    }
  } catch (_) {}

  await message.reply(resultText).catch(() => {});
  scheduleDelete(drop, DROP_CONFIG.deleteAfterClaimSeconds);
}

function tick() {
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
}

function init(client) {
  if (tickHandle) clearInterval(tickHandle);

  clientRef = client;

  if (!DROP_CONFIG.enabled) {
    logger.info("random drops are disabled");
    return;
  }

  const now = Date.now();

  for (const channelId of getChannelIds()) {
    channelClocks.set(channelId, {
      effectiveSeconds: 0,
      targetSeconds: randomTargetSeconds(),
      lastDropAt: now,
      posting: false,
    });
  }

  lastTickAt = now;
  tickHandle = setInterval(tick, DROP_CONFIG.tickSeconds * 1000);

  logger.info("random drops initialized", {
    channels: getChannelIds().length,
  });
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
  verifyChannel,
  observeMessage,
  pick,
};
