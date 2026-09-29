const { Queue } = require("bullmq");

const redis = require("../config/redis");
const logger = require("../utils/logger");

const analyticsQueue = new Queue("analytics", {
  connection: redis,

  defaultJobOptions: {
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 1000,
    },

    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

analyticsQueue.on("error", (error) => {
  logger.error("Analytics queue error", { code: error.code, name: error.name });
});

module.exports = analyticsQueue;
