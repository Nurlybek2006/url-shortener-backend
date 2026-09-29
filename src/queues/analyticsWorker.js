const { Worker } = require("bullmq");
const redis = require("../config/redis");
const logger = require("../utils/logger");
const { processAnalyticsJob } = require("../utils/analyticsProcessor");

// BullMQ blocking consumers require unlimited retries; API requests do not.
const workerRedis = redis.duplicate({
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  commandTimeout: undefined,
});
workerRedis.on("error", (error) => {
  logger.error("Analytics worker Redis error", { code: error.code, name: error.name });
});

const worker = new Worker("analytics", processAnalyticsJob, {
  connection: workerRedis,
  concurrency: 20,
});

worker.on("completed", (job) => {
  logger.debug("Analytics completed", { jobId: job.id });
});
worker.on("failed", (job, error) => {
  logger.error("Analytics failed", { jobId: job?.id, code: error.code, name: error.name });
});
worker.on("error", (error) => {
  logger.error("Analytics worker error", { code: error.code, name: error.name });
});

const closeWorker = worker.close.bind(worker);
let closing;
worker.close = (force = false) => {
  if (!closing) {
    closing = (async () => {
      try {
        await closeWorker(force);
      } finally {
        // quit can wait forever while reconnecting, so disconnect in that case.
        if (workerRedis.status === "ready") await workerRedis.quit();
        else workerRedis.disconnect();
      }
    })();
  }
  return closing;
};

module.exports = worker;
