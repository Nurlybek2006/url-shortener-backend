const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const env = require("./env");

const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;
