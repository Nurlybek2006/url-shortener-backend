const app = require("./src/app");

const prisma = require("./src/config/database");
const redis = require("./src/config/redis");
const env = require("./src/config/env");

async function startServer() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL connected");

    await redis.ping();

    console.log("Redis ready");

    app.listen(env.port, () => {
      console.log(
        `Server running on http://localhost:${env.port}`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);

    process.exit(1);
  }
}

startServer();