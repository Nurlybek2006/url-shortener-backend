const values = new Map();
const redis = {
  get: jest.fn(async (key) => values.get(key) ?? null),
  set: jest.fn(async (key, value, ...options) => {
    if (options.includes("NX") && values.has(key)) return null;
    values.set(key, String(value));
    return "OK";
  }),
  del: jest.fn(async (...keys) => keys.reduce((count, key) => count + Number(values.delete(key)), 0)),
  incr: jest.fn(async (key) => {
    const count = Number(values.get(key) || 0) + 1;
    values.set(key, String(count));
    return count;
  }),
  decr: jest.fn(async (key) => {
    const count = Number(values.get(key) || 0) - 1;
    values.set(key, String(count));
    return count;
  }),
  ping: jest.fn(async () => "PONG"),
  quit: jest.fn(async () => "OK"),
  disconnect: jest.fn(),
  on: jest.fn(),
  status: "ready",
  values,
  reset: () => values.clear(),
};
redis.duplicate = jest.fn(() => redis);
redis.eval = jest.fn(async (script, keyCount, ...args) => {
  const keys = args.slice(0, keyCount);
  const parameters = args.slice(keyCount).map(Number);
  if (keyCount === 4) {
    const current = Math.max(Number(values.get(keys[0]) || 0), parameters[0]);
    values.set(keys[1], String(current));
    for (const key of [keys[0], keys[2], keys[3]]) values.delete(key);
    return 1;
  }
  if (parameters.length === 2) {
    const current = Math.max(Number(values.get(keys[0]) || 0), parameters[0]);
    if (parameters[1] >= 0 && current >= parameters[1]) return -1;
    values.set(keys[0], String(current + 1));
    return current + 1;
  }
  const current = Number(values.get(keys[0]) || 0);
  if (current > parameters[0]) values.set(keys[0], String(current - 1));
  return Number(values.get(keys[0]) || 0);
});
module.exports = redis;
