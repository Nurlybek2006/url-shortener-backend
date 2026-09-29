function inspectEnv(overrides) {
  // Isolate both module cache and environment. Prevent dotenv from filling in
  // intentionally missing values using the developer's local configuration.
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...overrides };
  let result;
  try {
    jest.isolateModules(() => {
      jest.doMock("dotenv", () => ({ config: () => {} }));
      try { require("../src/config/env"); result = { status: 0, stdout: "VALID" }; }
      catch (error) { result = { status: 1, stdout: error.message }; }
    });
  } finally { process.env = originalEnv; }
  return result;
}

test("test mode refuses to fall back to the development database", () => {
  const result = inspectEnv({ NODE_ENV: "test", TEST_DATABASE_URL: "" });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("TEST_DATABASE_URL");
  expect(result.stdout).not.toContain(process.env.DATABASE_URL);
});

test("test mode rejects the same database even through a different host", () => {
  const result = inspectEnv({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://unused:unused@localhost:5432/shared_test",
    TEST_DATABASE_URL: "postgresql://unused:unused@127.0.0.1:5432/shared_test",
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toMatch(/different database name/i);
});

test("test mode rejects a database without a delimited test name", () => {
  const result = inspectEnv({ TEST_DATABASE_URL: "postgresql://unused:unused@localhost:5432/production" });
  expect(result.status).toBe(1);
  expect(result.stdout).toMatch(/dedicated test database/i);
});

test.each(["", "short", "change-me-change-me-change-me-change-me"])("production rejects missing or weak JWT secrets", (secret) => {
  const result = inspectEnv({ NODE_ENV: "production", JWT_SECRET: secret });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("JWT_SECRET");
  if (secret) expect(result.stdout).not.toContain(secret);
});

test.each([
  { PORT: "70000" }, { PORT: "3.5" }, { PORT: "abc" },
  { BASE_URL: "https://example.com/private/path" },
  { BASE_URL: "https://private-user:private-password@example.com" },
  { CLIENT_URL: "https://example.com/private/path" },
])("rejects invalid configuration without echoing sensitive values: %j", (overrides) => {
  const result = inspectEnv(overrides);
  expect(result.status).toBe(1);
  expect(result.stdout).not.toContain("private-password");
});
