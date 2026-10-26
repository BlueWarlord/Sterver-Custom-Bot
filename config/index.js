// Committed defaults are grouped by feature area. Deployment-specific
// Discord IDs and shop overrides live in the gitignored config.local.js.
const { merge } = require("./merge");
const core = require("./core");
const economy = require("./economy");
const drops = require("./drops");
const games = require("./games");
const inventory = require("./inventory");
const storage = require("./storage");

const defaults = {
  ...core,
  ...economy,
  ...drops,
  ...games,
  ...inventory,
  ...storage,
};

function loadLocalOverrides() {
  try {
    return require("../config.local");
  } catch (error) {
    if (
      error.code === "MODULE_NOT_FOUND" &&
      String(error.message).includes("config.local")
    ) {
      return {};
    }
    throw error;
  }
}

module.exports = merge(defaults, loadLocalOverrides());
