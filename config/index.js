// Configuration is grouped by feature area and assembled into one object.
const core = require("./core");
const economy = require("./economy");
const drops = require("./drops");
const games = require("./games");
const inventory = require("./inventory");
const storage = require("./storage");

module.exports = {
  ...core,
  ...economy,
  ...drops,
  ...games,
  ...inventory,
  ...storage,
};
