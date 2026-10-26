const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
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
  closed: false,
  revision: 0,
  lockPath: null,
  lockHeld: false,
  exitHookInstalled: false,
};

function storageDir() {
  return path.dirname(config.storage.path);
}

function backupDir() {
  return path.join(storageDir(), "backups");
}

function ensureDirs() {
  const dir = storageDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const bdir = backupDir();
  if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
}

function fresh() {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    users: {},
  };
}

function validateStructure(data) {
  return Boolean(
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data.users &&
    typeof data.users === "object" &&
    !Array.isArray(data.users) &&
    typeof data.schemaVersion === "number"
  );
}

function releaseLock() {
  if (!store.lockHeld || !store.lockPath) return;
  try {
    fs.unlinkSync(store.lockPath);
  } catch (_) {
    // The lock may already have been removed by the OS or a crash cleanup.
  }
  store.lockHeld = false;
  store.lockPath = null;
}

function acquireLock() {
  const lockPath = `${config.storage.path}.lock`;
  const writeLock = () => {
    fs.writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, startedAt: Date.now() }),
      { flag: "wx" }
    );
  };

  try {
    writeLock();
  } catch (error) {
    if (error.code !== "EEXIST") throw error;

    let owner = null;
    try {
      owner = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    } catch (_) {
      owner = null;
    }

    if (owner && Number.isSafeInteger(owner.pid) && owner.pid !== process.pid) {
      let alive = false;
      try {
        process.kill(owner.pid, 0);
        alive = true;
      } catch (killError) {
        alive = killError.code === "EPERM";
      }
      if (alive) {
        logger.error("data store is locked by another running process", {
          lockPath,
          ownerPid: owner.pid,
        });
        process.exit(1);
      }
    }

    // Stale lock (crashed process or same PID): remove and retry once.
    try {
      fs.unlinkSync(lockPath);
    } catch (_) {}
    writeLock();
  }

  store.lockPath = lockPath;
  store.lockHeld = true;

  if (!store.exitHookInstalled) {
    store.exitHookInstalled = true;
    process.once("exit", releaseLock);
  }
}

function checksum(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function listBackups() {
  try {
    return fs
      .readdirSync(backupDir())
      .filter((name) => name.startsWith("data-") && name.endsWith(".json"))
      .sort()
      .reverse();
  } catch (_) {
    return [];
  }
}

function verifyBackup(filePath) {
  try {
    const raw = fs.readFileSync(filePath);
    const sidecar = `${filePath}.sha256`;
    if (fs.existsSync(sidecar)) {
      const expected = fs.readFileSync(sidecar, "utf8").trim().split(/\s+/)[0];
      const actual = checksum(raw);
      if (!expected || expected !== actual) {
        logger.warn("backup checksum mismatch; skipping", { file: path.basename(filePath) });
        return null;
      }
    }
    const parsed = JSON.parse(raw.toString("utf8"));
    if (!validateStructure(parsed) || parsed.schemaVersion > 1) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function restoreFromBackup() {
  if (config.storage.restoreFromBackup === false) return false;
  for (const name of listBackups()) {
    const parsed = verifyBackup(path.join(backupDir(), name));
    if (!parsed) continue;
    store.data = parsed;
    store.dirty = true;
    logger.warn("data.json was corrupt; restored newest valid backup", { backup: name });
    return true;
  }
  return false;
}

async function load() {
  store.closed = false;
  ensureDirs();
  acquireLock();

  const tmp = `${config.storage.path}.tmp`;
  if (fs.existsSync(tmp)) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) {}
  }

  if (!fs.existsSync(config.storage.path)) {
    store.data = fresh();
    await flushNow();
    return;
  }

  let raw;
  try {
    raw = fs.readFileSync(config.storage.path, "utf8");
  } catch (error) {
    logger.error("read failed", { error });
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const corruptPath = path.join(backupDir(), `corrupt-${Date.now()}.json`);
    try {
      fs.copyFileSync(config.storage.path, corruptPath);
      logger.error("data.json unparseable; corrupt copy saved", { corruptPath });
    } catch (_) {
      logger.error("data.json unparseable and corrupt copy failed", { error });
    }
    if (restoreFromBackup()) {
      await flushNow();
      return;
    }
    logger.error("no valid backup available; refusing to start");
    process.exit(1);
  }

  if (!validateStructure(parsed)) {
    logger.error("invalid data structure");
    process.exit(1);
  }
  if (parsed.schemaVersion > 1) {
    logger.error("data schema is newer than this bot supports");
    process.exit(1);
  }
  store.data = parsed;
}

function scheduleFlush() {
  store.dirty = true;
  if (store.closed || store.timer) return;
  store.timer = setTimeout(() => {
    store.timer = null;
    flush().catch((error) => logger.error("scheduled flush failed", { error }));
  }, config.storage.flushIntervalMs);
}

async function flush() {
  if (store.flushing) {
    await store.flushing.catch(() => {});
    if (store.dirty && !store.timer && !store.closed) return flush();
    return;
  }
  if (!store.dirty || !store.data) return;

  store.dirty = false;
  const task = (async () => {
    try {
      store.data.updatedAt = new Date().toISOString();
      const tmp = `${config.storage.path}.tmp`;
      const serialized = JSON.stringify(store.data, null, 2);
      const handle = await fsp.open(tmp, "w");
      try {
        await handle.writeFile(serialized, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fsp.rename(tmp, config.storage.path);
    } catch (error) {
      store.dirty = true;
      if (!store.closed) scheduleFlush();
      logger.error("save failed", { error });
    } finally {
      store.flushing = null;
    }
  })();

  store.flushing = task;
  await task;

  if (store.dirty && !store.timer && !store.closed) {
    return flush();
  }
}

async function flushNow() {
  if (store.timer) {
    clearTimeout(store.timer);
    store.timer = null;
  }
  store.dirty = true;
  await flush();
}

function getUser(userId) {
  return store.data ? store.data.users[userId] : undefined;
}

function createUserRecord() {
  return {
    balance: config.economy.startingBalance,
    lastDailyAt: null,
    lastActivityRewardAt: null,
    totalEarned: 0,
    totalGifted: 0,
    totalReceived: 0,
    totalWagered: 0,
    totalWon: 0,
    totalLost: 0,
    lastFlipAt: null,
    lastBlackjackAt: null,
    giftDay: null,
    giftSentToday: 0,
    createdAt: Date.now(),
    inventory: {},
    ownedRoles: {},
  };
}

function ensurePlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

// Shared by store.ensureUser and every transactional update. Passing the data
// object explicitly keeps mutations atomic inside a single store.update call.
function ensureUserIn(data, userId) {
  let user = data.users[userId];
  let changed = false;

  if (!ensurePlainObject(user)) {
    user = createUserRecord();
    data.users[userId] = user;
    return { user, changed: true };
  }

  if (!Number.isSafeInteger(user.balance) || user.balance < 0) {
    user.balance = 0;
    changed = true;
  }

  for (const key of ["lastDailyAt", "lastActivityRewardAt", "lastFlipAt", "lastBlackjackAt"]) {
    if (user[key] === undefined) {
      user[key] = null;
      changed = true;
    }
  }

  for (const key of [
    "totalEarned",
    "totalGifted",
    "totalReceived",
    "totalWagered",
    "totalWon",
    "totalLost",
    "giftSentToday",
  ]) {
    if (!Number.isFinite(user[key]) || user[key] < 0) {
      user[key] = 0;
      changed = true;
    } else if (!Number.isInteger(user[key])) {
      user[key] = Math.floor(user[key]);
      changed = true;
    }
  }

  if (user.giftDay === undefined) {
    user.giftDay = null;
    changed = true;
  }

  if (user.createdAt == null || !Number.isFinite(user.createdAt)) {
    user.createdAt = Date.now();
    changed = true;
  }

  if (!ensurePlainObject(user.inventory)) {
    user.inventory = {};
    changed = true;
  }

  if (!ensurePlainObject(user.ownedRoles)) {
    user.ownedRoles = {};
    changed = true;
  }

  return { user, changed };
}

function ensureUser(userId) {
  const result = ensureUserIn(store.data, userId);
  if (result.changed) {
    store.revision += 1;
    scheduleFlush();
  }
  return result.user;
}

function update(fn) {
  fn(store.data);
  store.revision += 1;
  scheduleFlush();
}

function snapshot() {
  return JSON.parse(JSON.stringify(store.data));
}

function start() {
  store.started = true;
  store.closed = false;
}

async function createBackup() {
  if (!fs.existsSync(config.storage.path)) return;
  const raw = await fsp.readFile(config.storage.path);
  let parsed;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (_) {
    return;
  }
  if (store.lastBackupUpdatedAt === parsed.updatedAt) return;

  const bdir = backupDir();
  if (!fs.existsSync(bdir)) await fsp.mkdir(bdir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(bdir, `data-${timestamp}.json`);
  await fsp.writeFile(backupPath, raw);
  await fsp.writeFile(`${backupPath}.sha256`, `${checksum(raw)}\n`);

  const files = fs
    .readdirSync(bdir)
    .filter((name) => name.startsWith("data-") && name.endsWith(".json"))
    .sort();
  const keep = config.storage.backupsToKeep;
  if (files.length > keep) {
    for (const name of files.slice(0, files.length - keep)) {
      const full = path.join(bdir, name);
      try {
        fs.unlinkSync(full);
      } catch (_) {}
      try {
        fs.unlinkSync(`${full}.sha256`);
      } catch (_) {}
    }
  }

  store.lastBackupUpdatedAt = parsed.updatedAt;
}

function startBackupTimer() {
  if (!config.storage.backupsEnabled || store.backupTimer) return;
  store.backupTimer = setInterval(() => {
    createBackup().catch((error) => logger.error("backup failed", { error }));
  }, config.storage.backupIntervalMinutes * 60000);
}

function stopBackupTimer() {
  if (store.backupTimer) {
    clearInterval(store.backupTimer);
    store.backupTimer = null;
  }
}

function stop() {
  store.closed = true;
  store.dirty = false;
  if (store.timer) {
    clearTimeout(store.timer);
    store.timer = null;
  }
  stopBackupTimer();
  releaseLock();
}

store.load = load;
store.flush = flush;
store.flushNow = flushNow;
store.getUser = getUser;
store.ensureUser = ensureUser;
store.ensureUserIn = ensureUserIn;
store.createUserRecord = createUserRecord;
store.update = update;
store.snapshot = snapshot;
store.start = start;
store.stop = stop;
store.startBackupTimer = startBackupTimer;
store.stopBackupTimer = stopBackupTimer;

module.exports = store;
