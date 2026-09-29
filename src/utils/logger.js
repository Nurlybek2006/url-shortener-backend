const path = require("path");
const fs = require("fs");
const winston = require("winston");

const sensitiveKey = /password|secret|token|authorization|cookie|database.?url|redis.?url/i;
function redact(value, key = "", seen = new WeakSet()) {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    let result = value.replace(/\b(?:postgres(?:ql)?|rediss?):\/\/[^\s"']+/gi, "[REDACTED]")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]")
      .replace(/([?&](?:token|password|secret|access_token)=)[^&\s]*/gi, "$1[REDACTED]");
    for (const name of ["JWT_SECRET", "DATABASE_URL", "TEST_DATABASE_URL", "REDIS_URL", "POSTGRES_PASSWORD"]) {
      if (process.env[name]) result = result.split(process.env[name]).join("[REDACTED]");
    }
    return result;
  }
  if (value instanceof Error) return { name: value.name, code: value.code };
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name, seen)]));
  }
  return value;
}
const sanitize = winston.format(info => {
  for (const key of Object.keys(info)) info[key] = redact(info[key], key);
  return info;
});
const transports = [new winston.transports.Console({
  format: process.env.NODE_ENV === "production" ? winston.format.json() : winston.format.simple(),
})];
if (process.env.NODE_ENV !== "test") {
  const directory = path.join(__dirname, "../../logs");
  fs.mkdirSync(directory, { recursive: true });
  for (const [filename, level] of [["error.log", "error"], ["combined.log", "info"]]) {
    transports.push(new winston.transports.File({ filename: path.join(directory, filename), level, maxsize: 5 * 1024 * 1024, maxFiles: 5, format: winston.format.json() }));
  }
}
module.exports = winston.createLogger({
  level: "info", silent: process.env.NODE_ENV === "test",
  format: winston.format.combine(sanitize(), winston.format.timestamp()), transports,
});
