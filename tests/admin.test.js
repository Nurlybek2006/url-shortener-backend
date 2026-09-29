const request = require("supertest");
const { app, db, user, link, authorization, reset } = require("./helpers");

beforeEach(reset);

test("admin endpoints require an authenticated administrator", async () => {
  const normal = await user();
  await request(app).get("/api/admin/links").expect(401);
  await request(app).get("/api/admin/links").set("Authorization", authorization(normal)).expect(403);
  expect(db.link.findMany).not.toHaveBeenCalled();
});

test("admin lists all owners with pagination and excludes user and link passwords", async () => {
  const admin = await user({ role: "ADMIN" });
  const normal = await user({ password: "private-user-hash" });
  await link(normal, { password: "private-link-hash" });
  await link(admin);
  const response = await request(app).get("/api/admin/links?page=1&limit=10").set("Authorization", authorization(admin)).expect(200);
  expect(response.body.data.links).toHaveLength(2);
  expect(response.body.data.links.map((item) => item.user.id)).toEqual(expect.arrayContaining([admin.id, normal.id]));
  expect(response.body.data.pagination).toMatchObject({ page: 1, limit: 10, total: 2 });
  for (const item of response.body.data.links) {
    expect(item).not.toHaveProperty("password");
    expect(item.user).not.toHaveProperty("password");
  }
  expect(response.text).not.toContain("private-user-hash");
  expect(response.text).not.toContain("private-link-hash");
});

test("administrator still cannot use owner-only endpoints for another user's link", async () => {
  const admin = await user({ role: "ADMIN" });
  const normal = await user();
  const ownLink = await link(normal);
  await request(app).get(`/api/links/${ownLink.id}`).set("Authorization", authorization(admin)).expect(404);
});

test("validates admin pagination", async () => {
  const admin = await user({ role: "ADMIN" });
  await request(app).get("/api/admin/links?page=-1&limit=1000").set("Authorization", authorization(admin)).expect(400);
});
