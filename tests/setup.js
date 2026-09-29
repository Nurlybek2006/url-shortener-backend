// Load local configuration only to preserve the safety comparison between the
// development URL and an explicitly configured, separate integration database.
require("dotenv").config({ quiet: true });

global.integrationDatabaseUrl = process.env.TEST_DATABASE_URL || null;
global.integrationRedisUrl = process.env.TEST_REDIS_URL || null;
process.env.NODE_ENV = "test";
process.env.TEST_DATABASE_URL = global.integrationDatabaseUrl ||
  "postgresql://unused:unused@127.0.0.1:1/url_shortener_unit_test";
process.env.DATABASE_URL ||= "postgresql://unused:unused@127.0.0.1:1/development_placeholder";
process.env.REDIS_URL = "redis://127.0.0.1:1";
process.env.JWT_SECRET = "deterministic-test-only-secret-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.BASE_URL = "http://localhost:3000";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.PORT = "3000";
