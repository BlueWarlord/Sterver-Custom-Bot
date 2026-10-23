const store = require("../economy/store");

module.exports = async function shutdown(client) {
  try { store.stop(); await store.flushNow(); } catch(e){ console.error(e); }
  try { client.destroy(); } catch(_){}
  process.exit(0);
};
