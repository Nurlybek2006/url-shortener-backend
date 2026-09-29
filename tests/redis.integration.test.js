const { randomUUID } = require("crypto");
const configured = Boolean(global.integrationRedisUrl);
const integration = configured ? describe : describe.skip;

integration(configured ? "real Redis atomic reservations" : "Redis integration skipped: set TEST_REDIS_URL (only UUID fixture keys are touched)", () => {
  let redis, db, resolveRedirect, incrementClickCount;
  const keys = new Set();

  beforeAll(async () => {
    const Redis = require("ioredis");
    redis = new Redis(global.integrationRedisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 2000, retryStrategy: () => null });
    redis.on("error", () => {});
    await redis.connect();
    jest.doMock("../src/config/redis", () => redis);
    jest.doMock("../src/config/database", () => require("./support/database"));
    db = require("../src/config/database");
    ({ resolveRedirect, incrementClickCount } = require("../src/services/redirectService"));
  });

  afterAll(async () => {
    if (!redis) return;
    try {
      if (keys.size && redis.status === "ready") await redis.del(...keys);
    } finally { redis.disconnect(); }
  });

  async function target(overrides = {}) {
    const slug = `test-${randomUUID()}`;
    keys.add(`link:${slug}`);
    keys.add(`link:${slug}:clicks`);
    return db.link.create({ data: { id: randomUUID(), slug, userId: randomUUID(), originalUrl: "https://example.com", ...overrides } });
  }

  test("Lua admits exactly the remaining budget under 50 concurrent requests", async () => {
    const link = await target({ clickCount: 4, maxClicks: 10 });
    const results = await Promise.allSettled(Array.from({ length: 50 }, () => resolveRedirect(link.slug)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(6);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(44);
    expect(rejected.every((result) => result.reason.statusCode === 410)).toBe(true);
    expect(await redis.get(`link:${link.slug}:clicks`)).toBe("10");
  });

  test("Lua initializes from the current database count after a counter is lost", async () => {
    const link = await target({ clickCount: 3, maxClicks: 4 });
    await db.link.update({ where: { id: link.id }, data: { clickCount: 4 } });
    await expect(incrementClickCount(link)).rejects.toMatchObject({ statusCode: 410 });
  });
});
