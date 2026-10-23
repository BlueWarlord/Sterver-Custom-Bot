function randomInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function weightedPick(entries){ const total = entries.reduce((s,e)=>s+e.weight,0); let r = Math.floor(Math.random()*total)+1; for (const e of entries){ r -= e.weight; if (r <= 0) return e; } return entries[entries.length-1]; }
module.exports = { randomInt, weightedPick };
