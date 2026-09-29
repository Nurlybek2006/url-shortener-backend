const request = require("supertest");
const bcrypt = require("bcryptjs");
const { app, db, redis, user, link, authorization, reset, randomUUID } = require("./helpers");

beforeEach(reset);

describe("link CRUD and access control", () => {
  test("creates a generated slug and a custom slug", async () => {
    const owner = await user();
    const generated = await request(app).post("/api/links").set("Authorization", authorization(owner))
      .send({ originalUrl: "https://example.com" }).expect(201);
    expect(generated.body.data.link.slug).toMatch(/^[a-zA-Z0-9]{7,9}$/);
    expect(generated.body.data.link.shortUrl).toBe(`${process.env.BASE_URL}/${generated.body.data.link.slug}`);
    const custom = await request(app).post("/api/links").set("Authorization", authorization(owner))
      .send({ originalUrl: "https://example.com", slug: "my-custom-slug" }).expect(201);
    expect(custom.body.data.link.slug).toBe("my-custom-slug");
  });

  test("rejects a duplicate slug", async () => {
    const owner = await user();
    const existing = await link(owner);
    await request(app).post("/api/links").set("Authorization", authorization(owner))
      .send({ originalUrl: "https://example.com", slug: existing.slug }).expect(409);
  });

  test.each([
    { originalUrl: "javascript:alert(1)" }, { originalUrl: "ftp://example.com/file" },
    { originalUrl: "example.com" }, { slug: "../escape" }, { slug: "health" },
    { maxClicks: 0 }, { maxClicks: -1 }, { maxClicks: 2.5 }, { maxClicks: [] }, { maxClicks: [1, 2] },
    { expiresAt: "2000-01-01T00:00:00.000Z" }, { expiresAt: "not-a-date" }, { expiresAt: [] },
    { tags: [123] }, { password: "a" },
  ])("rejects invalid link fields: %j", async (change) => {
    const owner = await user();
    await request(app).post("/api/links").set("Authorization", authorization(owner))
      .send({ originalUrl: "https://example.com", ...change }).expect(400);
    expect(db.link.create).not.toHaveBeenCalled();
  });

  test("requires authentication", async () => {
    await request(app).post("/api/links").send({ originalUrl: "https://example.com" }).expect(401);
  });

  test("lists only owned links with correct pagination", async () => {
    const owner = await user();
    const stranger = await user();
    await link(owner); await link(owner); await link(stranger);
    const response = await request(app).get("/api/links?page=2&limit=1").set("Authorization", authorization(owner)).expect(200);
    expect(response.body.data.links).toHaveLength(1);
    expect(response.body.data.links[0].userId).toBe(owner.id);
    expect(response.body.data.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  test.each(["page=0", "page=1.5", "limit=101", "limit=-1", "page=1&page=2"])("validates pagination %s", async (query) => {
    const owner = await user();
    await request(app).get(`/api/links?${query}`).set("Authorization", authorization(owner)).expect(400);
  });

  test("returns an owned link without its password hash", async () => {
    const owner = await user();
    const ownLink = await link(owner, { password: "bcrypt-hash-sentinel" });
    const response = await request(app).get(`/api/links/${ownLink.id}`).set("Authorization", authorization(owner)).expect(200);
    expect(response.body.data.link).toMatchObject({ id: ownLink.id, passwordProtected: true });
    expect(response.text).not.toContain("bcrypt-hash-sentinel");
  });

  test.each([
    ["get", ""], ["patch", ""], ["delete", ""], ["post", "/toggle"], ["post", "/qr"],
    ["get", "/stats"], ["get", "/clicks"], ["get", "/analytics"],
  ])("prevents foreign resource access: %s /:id%s", async (method, suffix) => {
    const owner = await user();
    const stranger = await user();
    const foreignLink = await link(stranger);
    await request(app)[method](`/api/links/${foreignLink.id}${suffix}`).set("Authorization", authorization(owner))
      .send(method === "patch" ? { title: "Unauthorized" } : undefined).expect(404);
    expect(db.rows.link[0].title).toBeNull();
    expect(db.link.update).not.toHaveBeenCalled();
    expect(db.link.delete).not.toHaveBeenCalled();
  });

  test("returns 404 for a missing UUID and 400 for an invalid ID", async () => {
    const owner = await user();
    await request(app).get(`/api/links/${randomUUID()}`).set("Authorization", authorization(owner)).expect(404);
    await request(app).get("/api/links/not-a-uuid").set("Authorization", authorization(owner)).expect(400);
  });

  test("updates fields, hashes passwords, and invalidates old and new slug caches", async () => {
    const owner = await user();
    const ownLink = await link(owner);
    await redis.set(`link:${ownLink.slug}`, "old cache");
    await redis.set("link:renamed-link", "stale cache");
    const response = await request(app).patch(`/api/links/${ownLink.id}`).set("Authorization", authorization(owner))
      .send({ title: "Updated", slug: "renamed-link", password: "new-password", originalUrl: "https://example.org/updated" }).expect(200);
    expect(response.body.data.link).toMatchObject({ title: "Updated", slug: "renamed-link", passwordProtected: true });
    expect(response.body.data.link).not.toHaveProperty("password");
    expect(await bcrypt.compare("new-password", db.rows.link[0].password)).toBe(true);
    expect(await redis.get(`link:${ownLink.slug}`)).toBeNull();
    expect(await redis.get("link:renamed-link")).toBeNull();
  });

  test("rejects a conflicting slug on update and ignores ownership injection", async () => {
    const owner = await user();
    const ownLink = await link(owner);
    const second = await link(owner);
    await request(app).patch(`/api/links/${ownLink.id}`).set("Authorization", authorization(owner)).send({ slug: second.slug }).expect(409);
    await request(app).patch(`/api/links/${ownLink.id}`).set("Authorization", authorization(owner))
      .send({ title: "Allowed", userId: randomUUID(), clickCount: 99999, status: "DISABLED" }).expect(200);
    expect(db.rows.link[0]).toMatchObject({ userId: owner.id, clickCount: 0, status: "ACTIVE" });
  });

  test("deletes an owned link and its cache/counter", async () => {
    const owner = await user();
    const ownLink = await link(owner);
    await redis.set(`link:${ownLink.slug}`, "cached");
    await redis.set(`link:${ownLink.slug}:clicks`, "2");
    await request(app).delete(`/api/links/${ownLink.id}`).set("Authorization", authorization(owner)).expect(200);
    expect(db.rows.link).toHaveLength(0);
    expect(await redis.get(`link:${ownLink.slug}`)).toBeNull();
    expect(await redis.get(`link:${ownLink.slug}:clicks`)).toBeNull();
  });

  test("toggles ACTIVE to DISABLED and back, invalidating cache", async () => {
    const owner = await user();
    const ownLink = await link(owner);
    for (const status of ["DISABLED", "ACTIVE"]) {
      await redis.set(`link:${ownLink.slug}`, "cached");
      const response = await request(app).post(`/api/links/${ownLink.id}/toggle`).set("Authorization", authorization(owner)).expect(200);
      expect(response.body.data.link.status).toBe(status);
      expect(await redis.get(`link:${ownLink.slug}`)).toBeNull();
    }
  });
});
