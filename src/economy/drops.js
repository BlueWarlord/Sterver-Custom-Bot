const { EmbedBuilder } = require("discord.js");

const config = require("../../config");
const wallet = require("./wallet");
const logger = require("../utils/logger");
const { randomInt, weightedPick } = require("../utils/random");
const { randomIntervalMs } = require("../utils/time");

// Active drops, indexed by their unique ID.
const activeDrops = new Map();

// channelId -> userId -> array of eligible message timestamps
const messageActivity = new Map();

// Per-channel scheduling state.
const lastDropAt = new Map();
const baselineIntervals = new Map();
const pendingChannels = new Set();

let clientRef = null;
let tickHandle = null;
let lastTickAt = 0;

const DROP_WINDOW_MS = () => config.drops.densityWindowSeconds * 1000;

function configuredChannelIds() {
  return [...new Set(config.drops.channelIds)];
}

function isDropChannel(channelId) {
  return configuredChannelIds().includes(channelId);
}

// --------------------------------------------------
// Message activity and spam prevention
// --------------------------------------------------

function pruneActivity(channelId, now = Date.now()) {
  const users = messageActivity.get(channelId);

  if (!users) return 0;

  const cutoff = now - DROP_WINDOW_MS();
  let total = 0;

  for (const [userId, timestamps] of users) {
    const recent = timestamps.filter((timestamp) => timestamp > cutoff);

    if (recent.length === 0) {
      users.delete(userId);
      continue;
    }

    users.set(userId, recent);
    total += recent.length;
  }

  if (users.size === 0) {
    messageActivity.delete(channelId);
    return 0;
  }

  return total;
}

/**
 * Called for incoming messages.
 *
 * A user can contribute only a limited number of messages within
 * the configured rolling window. Commands do not contribute.
 */
function observeMessage(message) {
  if (!config.drops.enabled) return;
  if (!message.guild) return;
  if (message.guild.id !== config.discord.guildId) return;
  if (message.author.bot || message.webhookId || message.system) return;
  if (!isDropChannel(message.channel.id)) return;

  const prefix = config.commands.prefix;

  // Prevent command spam, including repeated ".pick", from
  // artificially increasing the drop probability.
  if (message.content.startsWith(prefix)) return;

  const channelId = message.channel.id;
  const userId = message.author.id;
  const now = Date.now();

  pruneActivity(channelId, now);

  if (!messageActivity.has(channelId)) {
    messageActivity.set(channelId, new Map());
  }

  const users = messageActivity.get(channelId);

  if (!users.has(userId)) {
    users.set(userId, []);
  }

  const timestamps = users.get(userId);
  const perUserLimit = config.drops.maxMessagesPerUserPerWindow;

  if (timestamps.length >= perUserLimit) return;

  timestamps.push(now);
}

/**
 * Returns the adjusted eligible message rate in messages/second.
 */
function getMessageRate(channelId, now = Date.now()) {
  const count = pruneActivity(channelId, now);
  return count / config.drops.densityWindowSeconds;
}

// --------------------------------------------------
// Probability model
// --------------------------------------------------

function getBaselineIntervalMs(channelId) {
  if (!baselineIntervals.has(channelId)) {
    baselineIntervals.set(
      channelId,
      randomIntervalMs(
        config.drops.intervalMinMinutes,
        config.drops.intervalMaxMinutes
      )
    );
  }

  return baselineIntervals.get(channelId);
}

/**
 * Probability of a drop during this scheduler tick.
 *
 * The baseline interval determines the underlying rate.
 * Activity above the configured threshold increases that rate.
 *
 * The exponential hazard model gives:
 *
 * P(drop in dt) = 1 - exp(-dt / interval * activityMultiplier)
 *
 * This is a probability per tick, not a guaranteed timer.
 */
function getDropProbability(channelId, rate, elapsedSeconds) {
  const threshold = config.drops.minMessagesPerSecond;

  if (rate < threshold) return 0;

  const relativeRate = rate / threshold;

  const multiplier = Math.min(
    Math.pow(relativeRate, config.drops.rateSensitivity),
    config.drops.maxRateMultiplier
  );

  const intervalSeconds = getBaselineIntervalMs(channelId) / 1000;

  return 1 - Math.exp(
    -(elapsedSeconds / intervalSeconds) * multiplier
  );
}

// --------------------------------------------------
// Amount distribution
// --------------------------------------------------

function rollDropAmount() {
  let table = config.drops.table;

  if (!config.drops.allowNegativeAmounts) {
    table = table.filter((entry) => entry.min >= 0);
  }

  if (table.length === 0) {
    throw new Error(
      "No usable drop amount entries. Check drops.table and allowNegativeAmounts."
    );
  }

  const entry = weightedPick(table);
  let amount = randomInt(entry.min, entry.max);

  // Apply hard caps even if the distribution is misconfigured.
  if (amount > 0) {
    amount = Math.min(amount, config.drops.maxPositiveAmount);
  } else if (amount < 0) {
    amount = Math.max(amount, -config.drops.maxNegativeAmount);
  }

  return amount;
}

// --------------------------------------------------
// Drop message helpers
// --------------------------------------------------

function makeEmbed(description) {
  const embed = new EmbedBuilder()
    .setTitle(config.drops.embedTitle)
    .setDescription(description);

  if (config.drops.imageUrl) {
    embed.setImage(config.drops.imageUrl);
  }

  return embed;
}

function amountDescription(amount) {
  if (amount > 0) {
    return `**Reward:** +${amount} ${config.currency.plural}`;
  }

  if (amount < 0) {
    return `**Penalty:** ${amount} ${config.currency.plural}`;
  }

  return "**Amount:** 0";
}

async function fetchDropMessage(drop) {
  if (!clientRef) return null;

  const channel =
    clientRef.channels.cache.get(drop.channelId) ||
    await clientRef.channels.fetch(drop.channelId).catch(() => null);

  if (!channel || !channel.isTextBased() || !channel.messages) {
    return null;
  }

  const message = await channel.messages
    .fetch(drop.messageId)
    .catch(() => null);

  return message;
}

async function deleteDropMessage(drop) {
  const message = await fetchDropMessage(drop);

  if (message) {
    await message.delete().catch((error) => {
      logger.warn("drop message deletion failed", {
        dropId: drop.id,
        error: error.message,
      });
    });
  }

  activeDrops.delete(drop.id);
}

function scheduleCleanup(drop, delaySeconds) {
  if (drop.cleanupTimer) {
    clearTimeout(drop.cleanupTimer);
  }

  drop.cleanupTimer = setTimeout(() => {
    deleteDropMessage(drop).catch((error) => {
      logger.error("drop cleanup failed", {
        dropId: drop.id,
        error: error.message,
      });
      activeDrops.delete(drop.id);
    });
  }, delaySeconds * 1000);
}

// --------------------------------------------------
// Expiration
// --------------------------------------------------

async function expireDrop(drop) {
  if (drop.claimed || drop.expired) return;

  drop.expired = true;

  if (drop.expiryTimer) {
    clearTimeout(drop.expiryTimer);
    drop.expiryTimer = null;
  }

  const message = await fetchDropMessage(drop);

  if (message) {
    await message.edit({
      embeds: [makeEmbed(config.drops.expiredText)],
      components: [],
    }).catch(() => {});
  }

  scheduleCleanup(drop, config.drops.deleteAfterExpirySeconds);
}

// --------------------------------------------------
// Posting drops
// --------------------------------------------------

async function postDrop(channelId) {
  try {
    if (!clientRef) return;

    const channel =
      clientRef.channels.cache.get(channelId) ||
      await clientRef.channels.fetch(channelId).catch(() => null);

    if (!channel || !channel.isTextBased() || !channel.send) {
      logger.error("drop channel unavailable", { channelId });
      return;
    }

    const amount = rollDropAmount();
    const id = `${Date.now().toString(36)}-${randomInt(100000, 999999)}`;
    const expiresAt =
      Date.now() + config.drops.claimWindowMinutes * 60 * 1000;

    const description = [
      config.drops.embedDescription,
      "",
      amountDescription(amount),
      "",
      `Type \`${config.commands.prefix}pick\` in this channel to claim it.`,
    ].join("\n");

    const message = await channel.send({
      embeds: [makeEmbed(description)],
      components: [],
    });

    const drop = {
      id,
      amount,
      channelId,
      messageId: message.id,
      createdAt: Date.now(),
      expiresAt,
      claimed: false,
      expired: false,
      expiryTimer: null,
      cleanupTimer: null,
    };

    drop.expiryTimer = setTimeout(() => {
      expireDrop(drop).catch((error) => {
        logger.error("drop expiration failed", {
          dropId: drop.id,
          error: error.message,
        });
      });
    }, config.drops.claimWindowMinutes * 60 * 1000);

    activeDrops.set(id, drop);

    logger.info("drop_posted", {
      dropId: id,
      channelId,
      amount,
      expiresAt,
    });
  } catch (error) {
    logger.error("drop post failed", {
      channelId,
      error: error.message,
    });
  } finally {
    pendingChannels.delete(channelId);

    // Choose a fresh baseline interval for the next drop attempt.
    baselineIntervals.set(
      channelId,
      randomIntervalMs(
        config.drops.intervalMinMinutes,
        config.drops.intervalMaxMinutes
      )
    );
  }
}

function hasUnclaimedDrop(channelId) {
  for (const drop of activeDrops.values()) {
    if (
      drop.channelId === channelId &&
      !drop.claimed &&
      !drop.expired
    ) {
      return true;
    }
  }

  return false;
}

// --------------------------------------------------
// Scheduler
// --------------------------------------------------

function tick() {
  if (!config.drops.enabled || !clientRef) return;

  const now = Date.now();

  // Limit elapsed time so a delayed event loop does not cause
  // an enormous artificial probability spike.
  const maxElapsed = config.drops.tickSeconds * 3;

  const elapsedSeconds = Math.min(
    Math.max((now - lastTickAt) / 1000, 0),
    maxElapsed
  );

  lastTickAt = now;

  for (const channelId of configuredChannelIds()) {
    if (pendingChannels.has(channelId)) continue;
    if (hasUnclaimedDrop(channelId)) continue;

    const previousDropAt = lastDropAt.get(channelId) || 0;
    const minGapMs = config.drops.minGapMinutes * 60 * 1000;

    if (now - previousDropAt < minGapMs) continue;

    const rate = getMessageRate(channelId, now);

    // No activity threshold, no drop probability.
    if (rate < config.drops.minMessagesPerSecond) continue;

    const probability = getDropProbability(
      channelId,
      rate,
      elapsedSeconds
    );

    if (Math.random() >= probability) continue;

    // Reserve this channel before starting the asynchronous send.
    // This prevents two ticks from posting duplicate drops.
    pendingChannels.add(channelId);
    lastDropAt.set(channelId, now);

    postDrop(channelId);
  }
}

// --------------------------------------------------
// Picking up drops with ".pick"
// --------------------------------------------------

async function pick(message) {
  if (!config.drops.enabled) return;

  if (!isDropChannel(message.channel.id)) {
    await message.reply({
      content: "Drops cannot be picked up in this channel.",
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  // A channel can have only one unclaimed drop at a time.
  const drop = [...activeDrops.values()].find((candidate) =>
    candidate.channelId === message.channel.id &&
    !candidate.claimed &&
    !candidate.expired
  );

  if (!drop) {
    await message.reply({
      content: "There is no active drop to pick up in this channel.",
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  if (Date.now() >= drop.expiresAt) {
    await expireDrop(drop);

    await message.reply({
      content: config.drops.expiredText,
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  // Set the claim flag before any await, preventing simultaneous
  // ".pick" messages from claiming the same drop.
  drop.claimed = true;

  if (drop.expiryTimer) {
    clearTimeout(drop.expiryTimer);
    drop.expiryTimer = null;
  }

  const userId = message.author.id;
  let resultMessage;

  if (drop.amount > 0) {
    const result = wallet.credit(userId, drop.amount, "drop");

    if (!result.ok) {
      drop.claimed = false;

      await message.reply({
        content: "The drop could not be claimed. Please try again.",
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    resultMessage =
      `${message.author} picked up the drop and received ` +
      `**${drop.amount} ${config.currency.plural}**!`;
  } else if (drop.amount < 0) {
    // Penalties cannot push a balance below zero.
    const balance = wallet.getBalance(userId);
    const loss = Math.min(Math.abs(drop.amount), balance);

    if (loss > 0) {
      const result = wallet.debit(userId, loss, "drop_penalty");

      if (!result.ok) {
        drop.claimed = false;

        await message.reply({
          content: "The drop could not be claimed. Please try again.",
          allowedMentions: { repliedUser: false },
        });
        return;
      }
    }

    resultMessage = loss > 0
      ? `${message.author} picked up the drop and lost ` +
        `**${loss} ${config.currency.plural}**.`
      : `${message.author} picked up a penalty drop, but had no ` +
        `${config.currency.plural} to lose.`;
  } else {
    resultMessage = `${message.author} picked up a drop worth 0.`;
  }

  const dropMessage = await fetchDropMessage(drop);

  if (dropMessage) {
    await dropMessage.edit({
      embeds: [
        makeEmbed(
          `Claimed by ${message.author}.\n\n${amountDescription(drop.amount)}`
        ),
      ],
      components: [],
    }).catch(() => {});
  }

  logger.info("drop_claimed", {
    dropId: drop.id,
    userId,
    amount: drop.amount,
  });

  await message.reply({
    content: resultMessage,
    allowedMentions: { repliedUser: false },
  });

  scheduleCleanup(drop, config.drops.deleteAfterClaimSeconds);
}

// --------------------------------------------------
// Initialization
// --------------------------------------------------

function init(client) {
  clientRef = client;

  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }

  if (!config.drops.enabled) {
    logger.info("random drops disabled");
    return;
  }

  lastTickAt = Date.now();

  for (const channelId of configuredChannelIds()) {
    baselineIntervals.set(
      channelId,
      randomIntervalMs(
        config.drops.intervalMinMinutes,
        config.drops.intervalMaxMinutes
      )
    );
  }

  tickHandle = setInterval(tick, config.drops.tickSeconds * 1000);

  logger.info("random drop scheduler started", {
    channels: configuredChannelIds().length,
    tickSeconds: config.drops.tickSeconds,
  });
}

function verifyChannel(client) {
  for (const channelId of configuredChannelIds()) {
    const channel = client.channels.cache.get(channelId);

    if (!channel) {
      logger.warn("drop channel not cached; it will be fetched when needed", {
        channelId,
      });
    } else if (!channel.isTextBased() || !channel.send) {
      logger.error("configured drop channel is not text-based", {
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
