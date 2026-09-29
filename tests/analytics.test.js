const request = require("supertest");
const { app, db, redis, user, link, authorization, reset, randomUUID } = require("./helpers");

beforeEach(reset);

async function analyticsFixture() {
  const owner = await user();
  const target = await link(owner, { clickCount: 3 });
  for (const [index, ip] of ["192.0.2.1", "192.0.2.1", "192.0.2.2"].entries()) {
    await db.click.create({ data: {
      id: randomUUID(), linkId: target.id, ip, clickedAt: new Date(Date.now() - index * 1000),
      browser: "Chrome", os: "Windows", device: "Desktop", country: "Unknown",
      utmSource: "newsletter", utmMedium: "email", utmCampaign: "launch",
    } });
  }
  return { owner, target };
}

test("stats use distinct visitor SQL and include the live counter", async () => {
  const { owner, target } = await analyticsFixture();
  await redis.set(`link:${target.slug}:clicks`, 5);
  const response = await request(app).get(`/api/links/${target.id}/stats`).set("Authorization", authorization(owner)).expect(200);
  expect(response.body.data.stats).toMatchObject({ linkId: target.id, totalClicks: 5, uniqueVisitors: 2 });
  expect(response.body.data.stats.lastClickedAt).toEqual(expect.any(String));
  expect(db.$queryRaw.mock.calls.some(([parts]) => parts.join("").includes('COUNT(DISTINCT "ip")'))).toBe(true);
  expect(db.click.count.mock.calls.every(([args]) => !args.distinct)).toBe(true);
});

test("click history paginates and retains UTM values", async () => {
  const { owner, target } = await analyticsFixture();
  const response = await request(app).get(`/api/links/${target.id}/clicks?page=2&limit=2`).set("Authorization", authorization(owner)).expect(200);
  expect(response.body.data.clicks).toHaveLength(1);
  expect(response.body.data.clicks[0]).toMatchObject({ utmSource: "newsletter", utmMedium: "email", utmCampaign: "launch" });
  expect(response.body.data.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
});

test("aggregation returns browser/OS/device/country/day/hour groups", async () => {
  const { owner, target } = await analyticsFixture();
  const response = await request(app).get(`/api/links/${target.id}/analytics?days=7`).set("Authorization", authorization(owner)).expect(200);
  const analytics = response.body.data.analytics;
  expect(analytics).toMatchObject({ totalClicks: 3, uniqueVisitors: 2, period: { days: 7 } });
  for (const group of ["byBrowser", "byOS", "byDevice", "byCountry", "byDay", "byHour"]) {
    expect(analytics[group]).toEqual(expect.any(Array));
    expect(analytics[group].length).toBeGreaterThan(0);
  }
});

test("overview counts only the authenticated owner's links and clicks", async () => {
  const { owner } = await analyticsFixture();
  const stranger = await user();
  await link(stranger, { clickCount: 10000 });
  const response = await request(app).get("/api/analytics/overview?days=30").set("Authorization", authorization(owner)).expect(200);
  expect(response.body.data.overview).toMatchObject({ totalLinks: 1, activeLinks: 1, totalClicks: 3, period: { days: 30 } });
  expect(response.body.data.overview.topLinks).toHaveLength(1);
});

test.each(["days=0", "days=366", "days=abc", "days=2.5"])("rejects invalid analytics period %s", async (query) => {
  const owner = await user();
  await request(app).get(`/api/analytics/overview?${query}`).set("Authorization", authorization(owner)).expect(400);
});

test("processes click metadata once when an analytics job is retried", async () => {
  const { processAnalyticsJob } = require("../src/utils/analyticsProcessor");
  const owner = await user();
  const target = await link(owner);
  const clickId = randomUUID();
  const job = { name: "track-click", id: clickId, data: {
    clickId, linkId: target.id, slug: target.slug, clickedAt: new Date().toISOString(),
    ip: "127.0.0.1", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    query: { utm_source: "newsletter", utm_medium: "email", utm_campaign: "launch", token: "must-not-persist" },
  } };
  await processAnalyticsJob(job);
  await processAnalyticsJob(job);
  expect(db.rows.click).toHaveLength(1);
  expect(db.rows.link[0].clickCount).toBe(1);
  expect(db.rows.click[0]).toMatchObject({ id: clickId, browser: "Chrome", os: "Windows", device: "Desktop", country: "Unknown", utmSource: "newsletter" });
  expect(JSON.stringify(db.rows.click)).not.toContain("must-not-persist");
});
