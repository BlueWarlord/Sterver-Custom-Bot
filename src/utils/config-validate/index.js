const { isPlainObject } = require("./helpers");
const { validateCore } = require("./core");
const { validateEconomy } = require("./economy");
const { validateDrops } = require("./drops");
const { validateGames } = require("./games");
const { validateInventory } = require("./inventory");
const { validateStorage } = require("./storage");

const REQUIRED_SECTIONS = [
  "discord",
  "channels",
  "currency",
  "commands",
  "economy",
  "activity",
  "daily",
  "drops",
  "gift",
  "leaderboard",
  "storage",
  "gambling",
  "inventory",
];

function validate(cfg) {
  if (!isPlainObject(cfg)) {
    return ["config must be an object"];
  }

  const errors = [];
  const e = (message) => errors.push(message);

  // Required section checks must run first so the feature validators can
  // safely read nested properties.
  for (const section of REQUIRED_SECTIONS) {
    if (!isPlainObject(cfg[section])) {
      e(`${section} must be a configuration object`);
    }
  }

  if (errors.length > 0) return errors;

  validateCore(e, cfg);
  validateEconomy(e, cfg);
  validateDrops(e, cfg);
  validateGames(e, cfg);
  validateInventory(e, cfg);
  validateStorage(e, cfg);

  return errors;
}

module.exports = { validate };
