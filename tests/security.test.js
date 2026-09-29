const request = require("supertest");
const express = require("express");
const { app, db, redis, user, authorization, reset } = require("./helpers");
const { errorHandler } = require("../src/middleware/errorHandler");

beforeEach(reset);

test("health has security headers and does not advertise Express", async () => {
  const response = await request(app).get("/health").expect(200);
  expect(response.body.success).toBe(true);
  expect(response.headers["x-powered-by"]).toBeUndefined();
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
});

test("readiness checks dependencies and reports 503 without leaking errors", async () => {
  const healthy = await request(app).get("/ready").expect(200);
  expect(healthy.body.services).toEqual({ database: "ok", redis: "ok" });
  redis.ping.mockRejectedValueOnce(new Error("redis://secret:private-password@host"));
  const failure = await request(app).get("/ready").expect(503);
  expect(failure.body.success).toBe(false);
  expect(failure.text).not.toContain("private-password");
});

test("CORS accepts configured origins and rejects unlisted origins", async () => {
  const allowed = await request(app).get("/health").set("Origin", "http://localhost:5173").expect(200);
  expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  const blocked = await request(app).get("/health").set("Origin", "https://untrusted.example");
  expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
});

test("malformed and oversized JSON fail cleanly", async () => {
  await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"email":').expect(400);
  await request(app).post("/api/auth/login").send({ email: "a".repeat(110000) }).expect(413);
});

test("validation never echoes submitted passwords or token values", async () => {
  const sentinel = "private-password-".repeat(20);
  const response = await request(app).post("/api/auth/register").send({ name: "Test", email: "invalid", password: sentinel }).expect(400);
  expect(response.body).toMatchObject({ success: false, error: expect.any(String) });
  expect(response.text).not.toContain(sentinel);
});

test("unexpected internal failures never expose Prisma details or stack traces", async () => {
  const localApp = express();
  localApp.get("/failure", (req, res, next) => next(new Error("SQL password=private-secret C:\\private\\file.js")));
  localApp.use(errorHandler);
  const response = await request(localApp).get("/failure").expect(500);
  expect(response.body).toEqual({ success: false, error: "Internal Server Error" });
});

test.each([["P2002", 409], ["P2025", 404]])("maps Prisma %s into HTTP %s", async (code, status) => {
  const owner = await user();
  db.link.findMany.mockRejectedValueOnce(Object.assign(new Error("private database details"), { code }));
  const response = await request(app).get("/api/links").set("Authorization", authorization(owner)).expect(status);
  expect(response.text).not.toContain("private database details");
});

test("serves Swagger documentation", async () => {
  const response = await request(app).get("/api-docs/").expect(200);
  expect(response.text).toMatch(/swagger/i);
});

test("authentication rate limiting returns 429 after the configured allowance", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    for (let count = 0; count < 20; count++) {
      await request(app).post("/api/auth/login").send({}).expect(400);
    }
    const blocked = await request(app).post("/api/auth/login").send({}).expect(429);
    expect(blocked.body).toEqual({ success: false, error: "Too many requests, please try again later" });
  } finally { process.env.NODE_ENV = previous; }
});
