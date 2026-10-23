const config = require("../../config");
const store = require("./store");
const wallet = require("./wallet");
const logger = require("../utils/logger");
const { randomInt, weightedPick } = require("../utils/random");
const { randomIntervalMs } = require("../utils/time");

const drops = new Map();
let schedulerHandle = null;
let clientRef = null;
let channelRef = null;

function scheduleNext() {
  if (!config.drops.enabled) return;
  const delay = randomIntervalMs(config.drops.intervalMinMinutes, config.drops.intervalMaxMinutes);
  schedulerHandle = setTimeout(() => postDrop(), delay);
}

async function postDrop() {
  try {
    const channel = clientRef.channels.cache.get(config.channels.generalChatId) || await clientRef.channels.fetch(config.channels.generalChatId).catch(()=>null);
    if (!channel) { logger.error("drop channel not found"); scheduleNext(); return; }
    const entry = weightedPick(config.drops.table);
    const amount = randomInt(entry.min, entry.max);
    const id = Math.random().toString(36).slice(2, 10);
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    const embed = new EmbedBuilder().setTitle(config.drops.embedTitle).setDescription(config.drops.embedDescription);
    const btn = new ButtonBuilder().setCustomId(`drop:${id}`).setLabel(config.drops.claimButtonLabel).setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(btn);
    const msg = await channel.send({ embeds: [embed], components: [row] });
    const expiresAt = Date.now() + config.drops.claimWindowMinutes * 60000;
    const drop = { id, amount, messageId: msg.id, channelId: channel.id, createdAt: Date.now(), expiresAt, claimed: false, claimedBy: null, expired: false, timer: null };
    drop.timer = setTimeout(() => expire(drop), config.drops.claimWindowMinutes * 60000);
    drops.set(id, drop);
  } catch (e) {
    logger.error("drop post failed", { e: e.message });
  }
  scheduleNext();
}

async function expire(drop) {
  if (drop.claimed || drop.expired) return;
  drop.expired = true;
  try {
    const channel = await clientRef.channels.fetch(drop.channelId).catch(()=>null);
    const msg = channel ? await channel.messages.fetch(drop.messageId).catch(()=>null) : null;
    if (msg) {
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      const embed = new EmbedBuilder().setTitle(config.drops.embedTitle).setDescription(config.drops.expiredText);
      const btn = new ButtonBuilder().setCustomId(`drop:${drop.id}`).setLabel(config.drops.claimButtonLabel).setStyle(ButtonStyle.Primary).setDisabled(true);
      const row = new ActionRowBuilder().addComponents(btn);
      await msg.edit({ embeds: [embed], components: [row] }).catch(()=>{});
    }
  } catch(_){}
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
  await interaction.deferUpdate().catch(()=>{});
  wallet.credit(drop.claimedBy, drop.amount, "drop");
  // edit message
  try {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    const embed = new EmbedBuilder().setTitle(config.drops.embedTitle).setDescription(`Claimed by <@${drop.claimedBy}> (+${drop.amount})`);
    const btn = new ButtonBuilder().setCustomId(`drop:${drop.id}`).setLabel(config.drops.claimButtonLabel).setStyle(ButtonStyle.Primary).setDisabled(true);
    const row = new ActionRowBuilder().addComponents(btn);
    await interaction.message.edit({ embeds: [embed], components: [row] }).catch(()=>{});
  } catch(_){}
  await interaction.followUp({ content: `You claimed ${drop.amount} 🪙 SterCoins!`, ephemeral: true }).catch(()=>{});
  setTimeout(() => drops.delete(drop.id), 60000);
}

function init(client) {
  clientRef = client;
  if (config.drops.enabled) scheduleNext();
}

function verifyChannel(client) {
  const ch = client.channels.cache.get(config.channels.generalChatId);
  if (!ch) logger.warn("drop channel not cached; will fetch on post");
}

module.exports = { init, verifyChannel, claim, scheduleNext };
