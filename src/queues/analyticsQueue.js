const { Queue } = require("bullmq");

const redis = require("../config/redis");

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

module.exports = analyticsQueue;