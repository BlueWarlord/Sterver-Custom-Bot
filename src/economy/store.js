const fs = require("fs");
const path = require("path");
const config = require("../../config");
const logger = require("../utils/logger");

const store = {
  data: null,
  dirty: false,
  timer: null,
  flushing: null,
  backupTimer: null,
  lastBackupUpdatedAt: null,
  started: false,
};

function ensureDirs() {
  const dir = path.dirname(config.storage.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const bdir = path.join(dir, "backups");
  if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
}

function fresh() {
  return { schemaVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), users: {} };
}

function validateStructure(d) {
  return d && typeof d === "object" && d.users && typeof d.users === "object" && typeof d.schemaVersion === "number";
}

async function load() {
  ensureDirs();
  const tmp = config.storage.path + ".tmp";
  if (fs.existsSync(tmp)) { try { fs.unlinkSync(tmp); } catch(e){} }
  if (!fs.existsSync(config.storage.path)) {
    store.data = fresh();
    await flushNow();
    return;
  }
  let raw;
  try { raw = fs.readFileSync(config.storage.path, "utf8"); }
  catch (e) { logger.error("read failed", { e: e.message }); process.exit(1); }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) {
    const ts = Date.now();
    const corruptPath = `data/backups/corrupt-${ts}.json`;
    try { fs.copyFileSync(config.storage.path, corruptPath); } catch(_){}
    logger.error("data.json unparseable; copied to " + corruptPath);
    process.exit(1);
  }
  if (!validateStructure(parsed)) {
    logger.error("invalid structure");
    process.exit(1);
  }
  if (parsed.schemaVersion > 1) { logger.error("newer schema"); process.exit(1); }
  store.data = parsed;
}

function scheduleFlush() {
  store.dirty = true;
  if (store.timer) return;
  store.timer = setTimeout(() => { store.timer = null; flush(); }, config.storage.flushIntervalMs);
}

async function flush() {
  if (store.flushing) { await store.flushing; if (store.dirty) scheduleFlush(); return; }
  if (!store.dirty) return;
  store.dirty = false;
  const p = (async () => {
    try {
      store.data.updatedAt = new Date().toISOString();
      const tmp = config.storage.path + ".tmp";
      const str = JSON.stringify(store.data, null, 2);
      fs.writeFileSync(tmp, str);
      try { const fd = fs.openSync(tmp, "r+"); fs.fsyncSync(fd); fs.closeSync(fd); } catch(_){}
      fs.renameSync(tmp, config.storage.path);
    } catch (e) {
      store.dirty = true;
      logger.error("save failed", { e: e.message });
    }
  })();
  store.flushing = p;
  await p;
  store.flushing = null;
}

async function flushNow() {
  if (store.timer) { clearTimeout(store.timer); store.timer = null; }
  store.dirty = true;
  await flush();
}

function getUser(userId) {
  return store.data.users[userId];
}

function ensureUser(userId) {
  let u = store.data.users[userId];
  if (!u) {
    u = { balance: config.economy.startingBalance, lastDailyAt: null, lastActivityRewardAt: null, totalEarned: 0, totalGifted: 0, totalReceived: 0, totalWagered: 0, totalWon: 0, totalLost: 0, lastFlipAt: null, createdAt: Date.now() };
    store.data.users[userId] = u;
    scheduleFlush();
  } else {
    if (u.totalWagered == null) u.totalWagered = 0;
    if (u.totalWon == null) u.totalWon = 0;
    if (u.totalLost == null) u.totalLost = 0;
    if (u.lastFlipAt == null) u.lastFlipAt = null;
  }
  return u;
}

function update(fn) {
  fn(store.data);
  scheduleFlush();
}

function snapshot() {
  return JSON.parse(JSON.stringify(store.data));
}

function start() {
  store.started = true;
}

function stop() {
  if (store.timer) { clearTimeout(store.timer); store.timer = null; }
}

function startBackupTimer() {
  if (!config.storage.backupsEnabled) return;
  store.backupTimer = setInterval(() => {
    try {
      if (!fs.existsSync(config.storage.path)) return;
      const cur = JSON.parse(fs.readFileSync(config.storage.path, "utf8"));
      if (store.lastBackupUpdatedAt === cur.updatedAt) return;
      const dir = path.dirname(config.storage.path);
      const bdir = path.join(dir, "backups");
      if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(config.storage.path, path.join(bdir, `data-${ts}.json`));
      // prune
      const files = fs.readdirSync(bdir).filter(f=>f.startsWith("data-")).sort();
      const keep = config.storage.backupsToKeep;
      if (files.length > keep) {
        for (const f of files.slice(0, files.length - keep)) {
          try { fs.unlinkSync(path.join(bdir, f)); } catch(_){}
        }
      }
      store.lastBackupUpdatedAt = cur.updatedAt;
    } catch (e) { logger.error("backup failed", { e: e.message }); }
  }, config.storage.backupIntervalMinutes * 60000);
}

store.load = load;
store.flush = flush;
store.flushNow = flushNow;
store.getUser = getUser;
store.ensureUser = ensureUser;
store.update = update;
store.snapshot = snapshot;
store.start = start;
store.stop = stop;
store.startBackupTimer = startBackupTimer;

module.exports = store;
