const store = require("../economy/store");
const inventory = require("../economy/inventory");

module.exports = async function shutdown(client) {
  try { inventory.stopRoleExpiryTimer(); } catch(e){ console.error(e); }
  try { store.stop(); await store.flushNow(); } catch(e){ console.error(e); }
  try { client.destroy(); } catch(_){}
  process.exit(0);
};
