const Redis = require("ioredis");

const env = require("./env");

const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

module.exports = redis;