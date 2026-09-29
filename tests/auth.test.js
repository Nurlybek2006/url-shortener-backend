const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { app, db, user, authorization, reset, password } = require("./helpers");
const { generateRedirectToken } = require("../src/utils/jwt");

beforeEach(reset);

describe("authentication HTTP API", () => {
  const registration = { name: "Alice Example", email: "alice@example.test", password };

  test("registers a user, hashes the password, and returns a usable token without the hash", async () => {
    const response = await request(app).post("/api/auth/register").send(registration).expect(201);
    expect(response.body.data.user).toMatchObject({ name: registration.name, email: registration.email, role: "USER" });
    expect(response.body.data.user).not.toHaveProperty("password");
    expect(db.rows.user[0].password).not.toBe(password);
    expect(await bcrypt.compare(password, db.rows.user[0].password)).toBe(true);
    const profile = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${response.body.data.token}`).expect(200);
    expect(profile.body.data.user.email).toBe(registration.email);
    expect(profile.body.data.user).not.toHaveProperty("password");
  });

  test("rejects duplicate email", async () => {
    await user({ email: registration.email });
    await request(app).post("/api/auth/register").send(registration).expect(409);
    expect(db.rows.user).toHaveLength(1);
  });

  test.each([
    ["invalid email", { email: "invalid" }],
    ["short password", { password: "abc" }],
    ["missing password", { password: undefined }],
    ["invalid name", { name: "" }],
  ])("rejects %s before persisting", async (_, change) => {
    await request(app).post("/api/auth/register").send({ ...registration, ...change }).expect(400);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  test("login accepts the correct password without exposing a hash", async () => {
    const owner = await user();
    const response = await request(app).post("/api/auth/login").send({ email: owner.email, password }).expect(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).not.toHaveProperty("password");
  });

  test("wrong password and unknown email both return the same authentication error", async () => {
    const owner = await user();
    const wrongPassword = await request(app).post("/api/auth/login").send({ email: owner.email, password: "incorrect" }).expect(401);
    const unknownUser = await request(app).post("/api/auth/login").send({ email: "unknown@example.test", password }).expect(401);
    expect(wrongPassword.body.error).toBe(unknownUser.body.error);
  });

  test.each([undefined, "Bearer invalid.jwt.value", "Basic abc"])("rejects missing or malformed authorization: %s", async (header) => {
    const pending = request(app).get("/api/auth/me");
    if (header) pending.set("Authorization", header);
    await pending.expect(401);
  });

  test("rejects expired and redirect-purpose JWTs at private endpoints", async () => {
    const owner = await user();
    const expired = jwt.sign({ userId: owner.id, role: owner.role }, process.env.JWT_SECRET, { expiresIn: -1 });
    for (const token of [expired, generateRedirectToken(owner.id)]) {
      await request(app).get("/api/links").set("Authorization", `Bearer ${token}`).expect(401);
    }
  });

  test("logout preserves the existing successful API response", async () => {
    const owner = await user();
    await request(app).post("/api/auth/logout").set("Authorization", authorization(owner)).expect(200);
  });
});
