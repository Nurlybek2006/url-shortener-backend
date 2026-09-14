const prisma = require("./src/config/database");
const redis = require("./src/config/redis");

async function testConnections() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL connected");

    await redis.set("test", "working");

    const value = await redis.get("test");

    console.log("Redis test:", value);
  } catch (error) {
    console.error("Connection error:", error);
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

testConnections();