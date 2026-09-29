const { randomUUID } = require("crypto");
const bcrypt = require("bcryptjs");

jest.mock("../src/config/database", () => require("./support/database"));
jest.mock("../src/config/redis", () => require("./support/redis"));
jest.mock("../src/queues/analyticsQueue", () => ({
  add: jest.fn(async () => ({ id: "test-job" })),
  close: jest.fn(async () => {}),
}));
jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  stream: { write: jest.fn() },
}));

const db = require("../src/config/database");
const redis = require("../src/config/redis");
const queue = require("../src/queues/analyticsQueue");
const app = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const password = "correct-horse-test-password";
const passwordHash = bcrypt.hashSync(password, 4);

async function user(overrides = {}) {
  return db.user.create({ data: { name: "Test User", email: `${randomUUID()}@example.test`, password: passwordHash, ...overrides } });
}
async function link(owner, overrides = {}) {
  return db.link.create({ data: { userId: owner.id, slug: `test-${randomUUID()}`, originalUrl: "https://example.com/article", ...overrides } });
}
function authorization(owner) { return `Bearer ${generateToken(owner.id, owner.role)}`; }
function reset() { db.reset(); redis.reset(); jest.clearAllMocks(); }

module.exports = { app, db, redis, queue, user, link, authorization, reset, password, passwordHash, randomUUID };
