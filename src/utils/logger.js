const level = (process.env.LOG_LEVEL || "info").toLowerCase();
const order = { debug:0, info:1, warn:2, error:3 };
function log(lvl, msg, ctx){ if ((order[lvl]||1) < (order[level]||1)) return; const line = `${new Date().toISOString()} [${lvl.toUpperCase()}] ${msg}${ctx ? " " + JSON.stringify(ctx) : ""}`; console.log(line); }
module.exports = { debug:(m,c)=>log("debug",m,c), info:(m,c)=>log("info",m,c), warn:(m,c)=>log("warn",m,c), error:(m,c)=>log("error",m,c) };
