// Persistence, backups, and startup restore behavior.
function validateStorage(e, cfg) {
  const storage = cfg.storage;

  if (typeof storage.path !== "string" || !storage.path.trim()) {
    e("storage.path must be a non-empty string");
  }

  if (
    !Number.isInteger(storage.flushIntervalMs) ||
    storage.flushIntervalMs < 500
  ) {
    e("storage.flushIntervalMs");
  }

  if (
    !Number.isInteger(storage.backupIntervalMinutes) ||
    storage.backupIntervalMinutes <= 0
  ) {
    e("storage.backupIntervalMinutes");
  }

  if (
    !Number.isInteger(storage.backupsToKeep) ||
    storage.backupsToKeep <= 0
  ) {
    e("storage.backupsToKeep");
  }

  if (
    storage.backupsEnabled !== undefined &&
    typeof storage.backupsEnabled !== "boolean"
  ) {
    e("storage.backupsEnabled must be boolean");
  }

  if (
    storage.restoreFromBackup !== undefined &&
    typeof storage.restoreFromBackup !== "boolean"
  ) {
    e("storage.restoreFromBackup must be boolean");
  }
}

module.exports = { validateStorage };
