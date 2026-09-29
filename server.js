const { once } = require("events");
const { withTimeout } = require("./src/utils/withTimeout");

let server, app, prisma, redis, worker, queue, logger;
let shuttingDown;
async function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return shuttingDown;
  process.exitCode = exitCode;
  if (app) app.locals.shuttingDown = true;
  logger?.info("Server shutting down", { reason });
  shuttingDown = (async () => {
    const deadline = setTimeout(() => {
      logger?.error("Shutdown deadline exceeded");
      redis?.disconnect();
      server?.closeAllConnections();
      process.exit(1);
    }, 15000);
    deadline.unref();
    try {
      if (server) {
        const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        server.closeIdleConnections();
        try { await withTimeout(closed, 5000); } catch { server.closeAllConnections(); }
      }
      // Drain active jobs before disconnecting their database/Redis connections.
      const jobResults = await Promise.allSettled([worker?.close(), queue?.close()]);
      const connectionResults = await Promise.allSettled([
        prisma?.$disconnect(),
        redis?.status === "ready" ? redis.quit() : redis?.disconnect(),
      ]);
      if ([...jobResults, ...connectionResults].some(result => result.status === "rejected")) {
        process.exitCode = 1;
        logger?.error("One or more resources failed to close cleanly");
      }
      logger?.info("Shutdown complete");
    } finally { clearTimeout(deadline); }
  })();
  return shuttingDown;
}

async function startServer() {
  try {
    const env = require("./src/config/env");
    logger = require("./src/utils/logger");
    prisma = require("./src/config/database");
    redis = require("./src/config/redis");
    await prisma.$connect();
    if (shuttingDown) { await prisma.$disconnect(); return; }
    logger.info("PostgreSQL connected");
    if (redis.status !== "ready") await withTimeout(once(redis, "ready"), 10000);
    if (shuttingDown) return;
    await redis.ping();
    if (shuttingDown) return;
    logger.info("Redis ready");
    app = require("./src/app");
    queue = require("./src/queues/analyticsQueue");
    worker = require("./src/queues/analyticsWorker");
    await withTimeout(Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]), 10000);
    if (shuttingDown) return;
    logger.info("Analytics worker ready");
    server = app.listen(env.port, "0.0.0.0");
    await once(server, "listening");
    if (shuttingDown) { server.close(); return; }
    logger.info("Server started", { port: env.port, environment: env.nodeEnv });
    server.on("error", () => { void shutdown("HTTP server error", 1); });
    return server;
  } catch (error) {
    if (logger) logger.error("Failed to start server", { name: error.name, code: error.code });
    else process.stderr.write(`Configuration error: ${error.message}\n`);
    await shutdown("startup failure", 1);
  }
}
if (require.main === module) {
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.once("uncaughtException", error => {
    logger?.error("Uncaught exception", { name: error.name, code: error.code });
    void shutdown("uncaughtException", 1);
  });
  process.once("unhandledRejection", error => {
    logger?.error("Unhandled rejection", { name: error?.name, code: error?.code });
    void shutdown("unhandledRejection", 1);
  });
  void startServer();
}
module.exports = { startServer, shutdown };
