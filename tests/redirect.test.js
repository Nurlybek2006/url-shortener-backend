const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, db, redis, queue, user, link, authorization, reset, password, passwordHash, randomUUID } = require("./helpers");
const { generateRedirectToken } = require("../src/utils/jwt");

beforeEach(reset);

describe("public redirects", () => {
  test("redirects with 302, caches the target and queues a click", async () => {
    const owner = await user();
    const target = await link(owner);
    const response = await request(app).get(`/${target.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=launch`).expect(302);
    expect(response.headers.location).toBe(target.originalUrl);
    expect(await redis.get(`link:${target.slug}`)).toBeTruthy();
    expect(await redis.get(`link:${target.slug}:clicks`)).toBe("1");
    expect(queue.add).toHaveBeenCalledWith("track-click", expect.objectContaining({
      linkId: target.id, slug: target.slug,
      query: { utm_source: "newsletter", utm_medium: "email", utm_campaign: "launch" },
    }), expect.anything());
    db.link.findUnique.mockClear();
    await request(app).get(`/${target.slug}`).expect(302);
    expect(db.link.findUnique).not.toHaveBeenCalled();
  });

  test("unknown slug returns 404 without queueing work", async () => {
    await request(app).get("/unknown-slug").expect(404);
    expect(queue.add).not.toHaveBeenCalled();
  });

  test.each([
    ["disabled", { status: "DISABLED" }],
    ["expired date", { expiresAt: new Date(Date.now() - 60000) }],
    ["expired status", { status: "EXPIRED" }],
    ["exhausted clicks", { maxClicks: 2, clickCount: 2 }],
  ])("rejects %s links with 410", async (_, overrides) => {
    const owner = await user();
    const target = await link(owner, overrides);
    await request(app).get(`/${target.slug}`).expect(410);
    expect(queue.add).not.toHaveBeenCalled();
  });

  test("a parallel redirect burst cannot exceed maxClicks", async () => {
    const owner = await user();
    const target = await link(owner, { maxClicks: 3, clickCount: 1 });
    const responses = await Promise.all(Array.from({ length: 12 }, () => request(app).get(`/${target.slug}`)));
    expect(responses.filter((response) => response.status === 302)).toHaveLength(2);
    expect(responses.filter((response) => response.status === 410)).toHaveLength(10);
    expect(await redis.get(`link:${target.slug}:clicks`)).toBe("3");
    expect(queue.add).toHaveBeenCalledTimes(2);
  });

  test("renaming cannot reset an existing live click budget", async () => {
    const owner = await user();
    const target = await link(owner, { maxClicks: 1 });
    await request(app).get(`/${target.slug}`).expect(302);
    await request(app).patch(`/api/links/${target.id}`).set("Authorization", authorization(owner)).send({ slug: "renamed-limit" }).expect(200);
    await request(app).get("/renamed-limit").expect(410);
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  test("rejects a protected link without a token or with a wrong password", async () => {
    const owner = await user();
    const target = await link(owner, { password: passwordHash });
    await request(app).get(`/${target.slug}`).expect(401);
    await request(app).post(`/${target.slug}/verify`).send({ password: "wrong-password" }).expect(401);
    expect(queue.add).not.toHaveBeenCalled();
  });

  test("password verification issues a short-lived redirect-only JWT and permits the redirect", async () => {
    const owner = await user();
    const target = await link(owner, { password: passwordHash });
    const verified = await request(app).post(`/${target.slug}/verify`).send({ password }).expect(200);
    const claims = jwt.verify(verified.body.data.token, process.env.JWT_SECRET);
    expect(claims).toMatchObject({ linkId: target.id, purpose: "redirect" });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(300);
    await request(app).get(`/${target.slug}`).query({ token: verified.body.data.token }).expect(302);
  });

  test("rejects invalid, expired, foreign-link and access-purpose tokens", async () => {
    const owner = await user();
    const target = await link(owner, { password: passwordHash });
    const expired = jwt.sign({ linkId: target.id, purpose: "redirect" }, process.env.JWT_SECRET, { expiresIn: -1 });
    const accessToken = authorization(owner).replace("Bearer ", "");
    for (const token of ["bad-token", expired, generateRedirectToken(randomUUID()), accessToken]) {
      await request(app).get(`/${target.slug}`).query({ token }).expect(401);
    }
    expect(queue.add).not.toHaveBeenCalled();
  });

  test("never includes token/private query data in the analytics job or referrer", async () => {
    const owner = await user();
    const target = await link(owner, { password: passwordHash });
    const token = generateRedirectToken(target.id);
    await request(app).get(`/${target.slug}`).query({ token, utm_source: "newsletter", secret: "private-query" })
      .set("Referer", `https://example.com/landing?token=${token}#private-fragment`).expect(302);
    const payload = queue.add.mock.calls[0][1];
    expect(payload.query).toEqual({ utm_source: "newsletter", utm_medium: null, utm_campaign: null });
    expect(JSON.stringify(payload)).not.toContain(token);
    expect(JSON.stringify(payload)).not.toContain("private-query");
    expect(payload.referer).toBe("https://example.com/landing");
  });

  test("retains the click reservation after an ambiguous queue failure", async () => {
    const owner = await user();
    const target = await link(owner, { maxClicks: 1 });
    queue.add.mockRejectedValueOnce(new Error("Queue unavailable"));
    const response = await request(app).get(`/${target.slug}`);
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(await redis.get(`link:${target.slug}:clicks`)).toBe("1");
    await request(app).get(`/${target.slug}`).expect(410);
  });
});
