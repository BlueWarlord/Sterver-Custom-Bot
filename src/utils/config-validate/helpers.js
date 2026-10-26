function isNumStr(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

module.exports = { isNumStr, isPlainObject, isFiniteNumber };
