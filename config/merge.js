function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// Recursively merges deployment overrides over committed defaults without
// mutating either source object.
function merge(base, override) {
  if (!isPlainObject(override)) return base;

  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (BLOCKED_KEYS.has(key)) continue;
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = merge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

module.exports = { isPlainObject, merge };
