require("dotenv").config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || "development";
if (!["development", "test", "production"].includes(nodeEnv)) throw new Error("Invalid NODE_ENV");
function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
function parseUrl(name, value, protocols) {
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol) || !parsed.hostname) throw new Error();
    return parsed;
  } catch { throw new Error(`Invalid ${name}`); }
}
const databaseVariable = nodeEnv === "test" ? "TEST_DATABASE_URL" : "DATABASE_URL";
const databaseUrl = required(databaseVariable);
const database = parseUrl(databaseVariable, databaseUrl, ["postgres:", "postgresql:"]);
if (nodeEnv === "test") {
  const name = decodeURIComponent(database.pathname.slice(1));
  if (!/(^|[_-])test([_-]|$)/i.test(name)) throw new Error("TEST_DATABASE_URL must name a dedicated test database (for example url_shortener_test)");
  if (process.env.DATABASE_URL) {
    const development = parseUrl("DATABASE_URL", process.env.DATABASE_URL, ["postgres:", "postgresql:"]);
    if (decodeURIComponent(development.pathname) === decodeURIComponent(database.pathname)) throw new Error("TEST_DATABASE_URL must use a different database name from DATABASE_URL");
  }
}
const redisUrl = required("REDIS_URL");
parseUrl("REDIS_URL", redisUrl, ["redis:", "rediss:"]);
const base = parseUrl("BASE_URL", required("BASE_URL"), ["http:", "https:"]);
if (base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("BASE_URL must be an HTTP(S) origin without credentials, path, or query");
const jwtSecret = required("JWT_SECRET");
if (nodeEnv === "production" && (jwtSecret.length < 32 || /your-secret|change.?me|example/i.test(jwtSecret))) throw new Error("JWT_SECRET must be a strong secret of at least 32 characters in production");
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535");
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
if (!/^\d+(ms|s|m|h|d|w|y)$/.test(jwtExpiresIn) || parseInt(jwtExpiresIn, 10) < 1) throw new Error("JWT_EXPIRES_IN must be a positive duration such as 7d");
const durationUnits = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31557600 };
const durationSeconds = parseInt(jwtExpiresIn, 10) * durationUnits[jwtExpiresIn.match(/[a-z]+$/)[0]];
if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 315576000) throw new Error("JWT_EXPIRES_IN must be between one second and ten years");
const clientOrigins = (process.env.CLIENT_URL || "").split(",").map(value => value.trim()).filter(Boolean).map(value => {
  const origin = parseUrl("CLIENT_URL", value, ["http:", "https:"]);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error("CLIENT_URL must contain comma-separated HTTP(S) origins");
  return origin.origin;
});
const proxy = process.env.TRUST_PROXY || "false";
const trustProxy = proxy === "false" ? false : proxy.split(",").map(value => value.trim());
if (proxy === "true" || /^\d+$/.test(proxy)) throw new Error("TRUST_PROXY must be false or a trusted proxy address/subnet");
module.exports = { port, nodeEnv, databaseUrl, redisUrl, jwtSecret, jwtExpiresIn, baseUrl: base.origin, clientOrigins, trustProxy };
