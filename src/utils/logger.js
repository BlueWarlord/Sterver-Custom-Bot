const level = (process.env.LOG_LEVEL || "info").toLowerCase();
const order = { debug: 0, info: 1, warn: 2, error: 3 };
const SENSITIVE_KEY = /^(authorization|cookie|set-cookie|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret)$/i;
const SECRET_PATTERNS = [
  /mfa\.[A-Za-z0-9_-]{20,}/g,
  /[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,40}/g,
];
const WEBHOOK_PATTERN = /(https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/)[A-Za-z0-9_-]+/g;

function redactText(value) {
  let text = String(value);
  const secrets = [
    process.env.DISCORD_TOKEN,
    process.env.CLIENT_ID,
    process.env.DISCORD_CLIENT_SECRET,
    process.env.CLIENT_SECRET,
  ].filter((secret) => typeof secret === "string" && secret.length >= 6);
  for (const secret of secrets) {
    text = text.split(secret).join("[REDACTED]");
  }
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, "[REDACTED]");
  }
  // Preserve the webhook URL prefix while hiding the token portion.
  text = text.replace(WEBHOOK_PATTERN, (_match, prefix) => `${prefix}[REDACTED]`);
  return text;
}

function sanitize(value, seen, depth) {
  if (value == null) return value;
  if (typeof value === "string") return redactText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : undefined,
    };
  }
  if (depth >= 5) return "[TRUNCATED]";
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, seen, depth + 1));
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key)
      ? "[REDACTED]"
      : sanitize(item, seen, depth + 1);
  }
  return output;
}

function formatContext(context) {
  try {
    return ` ${JSON.stringify(sanitize(context, new WeakSet(), 0))}`;
  } catch (_) {
    return ' "[unserializable]"';
  }
}

function log(lvl, msg, ctx) {
  if ((order[lvl] || 1) < (order[level] || 1)) return;
  const line = `${new Date().toISOString()} [${lvl.toUpperCase()}] ${redactText(msg)}${ctx === undefined ? "" : formatContext(ctx)}`;
  console.log(line);
}

module.exports = {
  debug: (msg, ctx) => log("debug", msg, ctx),
  info: (msg, ctx) => log("info", msg, ctx),
  warn: (msg, ctx) => log("warn", msg, ctx),
  error: (msg, ctx) => log("error", msg, ctx),
  redactText,
};
