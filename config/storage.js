// JSON persistence, process locking, and backup behavior.
module.exports = {
  storage: {
    path: "data/data.json",
    flushIntervalMs: 3000,
    backupsEnabled: true,
    backupIntervalMinutes: 60,
    backupsToKeep: 24,
    restoreFromBackup: true,
  },
};
