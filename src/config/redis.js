const Redis = require("ioredis");

const env = require("./env");
const logger = require("../utils/logger");

const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
  commandTimeout: 5000,
  enableOfflineQueue: false,
});

redis.on("connect", () => {
  logger.info("Redis connected");
});

redis.on("error", (error) => {
  logger.error("Redis connection error", { name: error.name, code: error.code });
});

module.exports = redis;
