import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const databaseUrl = env(process.env.NODE_ENV === "test" ? "TEST_DATABASE_URL" : "DATABASE_URL");
if (process.env.NODE_ENV === "test") {
  let testDatabase;
  let developmentDatabase;
  try {
    testDatabase = new URL(databaseUrl);
    developmentDatabase = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  } catch {
    throw new Error("Invalid test/development database URL");
  }
  const name = decodeURIComponent(testDatabase.pathname.slice(1));
  if (!["postgres:", "postgresql:"].includes(testDatabase.protocol) || !/(^|[_-])test([_-]|$)/i.test(name) ||
      (developmentDatabase && decodeURIComponent(developmentDatabase.pathname.slice(1)) === name)) {
    throw new Error("TEST_DATABASE_URL must name a dedicated test database different from DATABASE_URL");
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: databaseUrl,
  },
});
