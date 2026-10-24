const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../../config");
const store = require("./store");
const wallet = require("./wallet");
const density = require("./density");
const logger = require("../utils/logger");
const { randomInt, weightedPick, skewedFloat } = require("../utils/random");

const drops = new Map();   // live drops by id (rebuilt from the saved copy after a restart)
const clocks = new Map();  // channelId -> { effectiveSec, targetSec, lastDropAt }
let pending = 0;           // drops currently being posted; they count against the cap
let tickHandle = null;
let lastTickAt = 0;
let clientRef = null;

// ---------- persistence (so a restart can't orphan a drop message) ----------
function persist(drop) {
  store.update((data) => {
    if (!data.drops) data.drops = {};
    data.drops[drop.id] = { id: drop.id, channelId: drop.channelId, messageId: drop.messageId, amount: drop.amount, createdAt: drop.createdAt, expiresAt: drop.expiresAt };
  });
}
function unpersist(id) {
  if (!store.data.drops || !store.data.drops[id]) return;
  store.update((data) => { delete data.drops[id]; });
}

// ---------- cap on simultaneous drops (all channels combined) ----------
function activeCount() {
  let n = pending;
  for (const d of drops.values()) if (!d.claimed && !d.expired) n++;
  return n;
}

// Base delay for the next drop, in "active-chat seconds". Longer delays are more likely than shorter ones.
function newTargetSec() {
  const { intervalMinMinutes, intervalMaxMinutes, delaySkew } = config.drops;
  return skewedFloat(intervalMinMinutes, intervalMaxMinutes, delaySkew) * 60;
}

// Runs every tickSeconds. Each channel has its own clock that only advances while people are chatting,
// and advances faster the busier the chat is. When it reaches its target, a drop is posted -
// unless the global cap is full, in which case the most overdue channel gets the next free slot.
function tick() {
  const now = Date.now();
  const dt = Math.min((now - lastTickAt) / 1000, config.drops.tickSeconds * 3); // cap so a stall/sleep can't skip ahead
  lastTickAt = now;

  const due = [];
  for (const [channelId, clock] of clocks) {
    const d = density.getDensity(channelId, now);
    const m = density.multiplier(d);
    if (m === 0) continue; // too quiet: clock paused, no drop possible
    clock.effectiveSec += dt * m;
    if (clock.effectiveSec < clock.targetSec) continue;
    if (now - clock.lastDropAt < config.drops.minGapMinutes * 60000) continue; // hard real-time floor
    due.push({ channelId, clock, d, m });
  }

  due.sort((a, b) => (b.clock.effectiveSec - b.clock.targetSec) - (a.clock.effectiveSec - a.clock.targetSec));
  const cap = config.drops.maxActiveDrops;
  for (const { channelId, clock, d, m } of due) {
    if (cap != null && activeCount() >= cap) break; // cap full: these clocks stay "due" and fire when a slot frees up
    clock.effectiveSec = 0;
    clock.targetSec = newTargetSec();
    clock.lastDropAt = now;
    pending++;
    postDrop(channelId, d, m);
  }
}

async function postDrop(channelId, d, m) {
  try {
    const channel = clientRef.channels.cache.get(channelId) || await clientRef.channels.fetch(channelId).catch(() => null);
    if (!channel) { logger.error("drop channel not found", { channelId }); return; }
    const entry = weightedPick(config.drops.table);
    const amount = randomInt(entry.min, entry.max);
    const id = Math.random().toString(36).slice(2, 10);
    const embed = new EmbedBuilder().setTitle(config.drops.embedTitle).setDescription(config.drops.embedDescription);
    const btn = new ButtonBuilder().setCustomId(`drop:${id}`).setLabel(config.drops.claimButtonLabel).setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(btn);
    const msg = await channel.send({ embeds: [embed], components: [row] });
    const expiresAt = Date.now() + config.drops.claimWindowMinutes * 60000;
    const drop = { id, amount, messageId: msg.id, channelId: channel.id, createdAt: Date.now(), expiresAt, claimed: false, claimedBy: null, expired: false, timer: null };
    drop.timer = setTimeout(() => expire(drop), config.drops.claimWindowMinutes * 60000);
    drops.set(id, drop);
    persist(drop);
    logger.info("drop posted", { channelId, amount, density: Number(d.toFixed(3)), speed: Number(m.toFixed(2)), active: activeCount() });
  } catch (e) {
    logger.error("drop post failed", { e: e.message });
  } finally {
    pending--;
  }
}

async function deleteDropMessage(channelId, messageId) {
  try {
    const channel = await clientRef.channels.fetch(channelId).catch(() => null);
    if (channel) await channel.messages.delete(messageId).catch(() => {});
  } catch (_) {}
}

async function expire(drop) {
  if (drop.claimed || drop.expired) return;
  drop.expired = true;
  await deleteDropMessage(drop.channelId, drop.messageId);
  unpersist(drop.id);
  setTimeout(() => drops.delete(drop.id), 60000);
}

async function claim(interaction) {
  const id = interaction.customId.split(":")[1];
  const drop = drops.get(id);
  if (!drop) {
    return interaction.reply({ content: "This drop is no longer active.", ephemeral: true });
  }
  if (drop.claimed) {
    return interaction.reply({ content: "Already claimed.", ephemeral: true });
  }
  if (Date.now() >= drop.expiresAt || drop.expired) {
    drop.expired = true;
    return interaction.reply({ content: config.drops.expiredText, ephemeral: true });
  }
  // atomic
  drop.claimed = true;
  drop.claimedBy = interaction.user.id;
  if (drop.timer) { clearTimeout(drop.timer); drop.timer = null; }
  unpersist(drop.id);
  await interaction.deferUpdate().catch(() => {});
  wallet.credit(drop.claimedBy, drop.amount, "drop");
  // edit message
  try {
    const embed = new EmbedBuilder().setTitle(config.drops.embedTitle).setDescription(`Claimed by <@${drop.claimedBy}> (+${drop.amount})`);
    const btn = new ButtonBuilder().setCustomId(`drop:${drop.id}`).setLabel(config.drops.claimButtonLabel).setStyle(ButtonStyle.Primary).setDisabled(true);
    const row = new ActionRowBuilder().addComponents(btn);
    await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});
  } catch (_) {}
  await interaction.followUp({ content: `You claimed ${drop.amount} 🪙 SterCoins!`, ephemeral: true }).catch(() => {});
  setTimeout(() => drops.delete(drop.id), 60000);
}

// After a restart: drops that are still inside their claim window come back to life (buttons keep working,
// they still expire on schedule); drops whose window ended while the bot was down get their message deleted.
function restoreDrops() {
  const saved = Object.values((store.data && store.data.drops) || {});
  if (!saved.length) return;
  const now = Date.now();
  const stale = [];
  for (const rec of saved) {
    if (rec.expiresAt <= now) { stale.push(rec); continue; }
    const drop = { ...rec, claimed: false, claimedBy: null, expired: false, timer: null };
    drop.timer = setTimeout(() => expire(drop), rec.expiresAt - now);
    drops.set(drop.id, drop);
  }
  logger.info("restored drops after restart", { live: saved.length - stale.length, expiredWhileDown: stale.length });
  (async () => {
    for (const rec of stale) {
      await deleteDropMessage(rec.channelId, rec.messageId);
      unpersist(rec.id);
    }
  })().catch((e) => logger.error("drop sweep failed", { e: e.message }));
}

function init(client) {
  clientRef = client;
  restoreDrops(); // always, even if drops are now disabled, so no old drop message is left behind
  if (!config.drops.enabled) return;
  const now = Date.now();
  for (const channelId of density.channelIds()) {
    clocks.set(channelId, { effectiveSec: 0, targetSec: newTargetSec(), lastDropAt: now });
  }
  lastTickAt = now;
  tickHandle = setInterval(tick, config.drops.tickSeconds * 1000);
}

function verifyChannel(client) {
  for (const channelId of density.channelIds()) {
    if (!client.channels.cache.get(channelId)) logger.warn("drop channel not cached; will fetch on post", { channelId });
  }
}

module.exports = { init, verifyChannel, claim };
