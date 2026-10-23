const config = require("../../config");
function formatAmount(n){ const sep = config.currency.thousandsSeparator; const s = sep ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep) : n.toString(); const label = n === 1 ? config.currency.name : config.currency.plural; return `${config.currency.emoji} ${s} ${label}`; }
function formatDuration(ms){ if (ms < 1000) return `${ms}ms`; const s = Math.floor(ms/1000); if (s < 60) return `${s}s`; const m = Math.floor(s/60); const remS = s % 60; if (m < 60) return remS ? `${m}m ${remS}s` : `${m}m`; const h = Math.floor(m/60); const remM = m % 60; return remM ? `${h}h ${remM}m` : `${h}h`; }
module.exports = { formatAmount, formatDuration };
