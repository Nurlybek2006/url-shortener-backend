const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const env = require("./config/env");
const prisma = require("./config/database");
const redis = require("./config/redis");
const logger = require("./utils/logger");
const { apiLimiter, authLimiter } = require("./middleware/rateLimiter");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { withTimeout } = require("./utils/withTimeout");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);
app.use(helmet({
  contentSecurityPolicy: { directives: { "upgrade-insecure-requests": env.nodeEnv === "production" ? [] : null } },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    let local = false;
    try { local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname); } catch {}
    callback(null, env.clientOrigins.includes(origin) || origin === env.baseUrl || (env.nodeEnv === "development" && local));
  },
}));
if (env.nodeEnv !== "test") {
  morgan.token("safe-path", req => req.route ? `${req.baseUrl || ""}${req.route.path}` : "[unmatched]");
  app.use(morgan(":method :safe-path :status :response-time ms", {
    stream: { write: message => logger.info(message.trim()) },
  }));
}
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "URL Shortener API is running" });
});
app.get("/ready", async (req, res) => {
  const checks = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, 3000),
    withTimeout(redis.ping(), 3000),
  ]);
  const services = {
    database: checks[0].status === "fulfilled" ? "ok" : "unavailable",
    redis: checks[1].status === "fulfilled" ? "ok" : "unavailable",
  };
  const success = !app.locals.shuttingDown && Object.values(services).every(value => value === "ok");
  res.set("Cache-Control", "no-store").status(success ? 200 : 503).json({ success, services });
});
const openapi = require("./docs/openapi");
app.get("/api-docs.json", (req, res) => res.json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { persistAuthorization: false } }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/links", require("./routes/linkRoutes"));
app.use("/api", require("./routes/analyticsRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/uploads/qr", express.static(path.join(__dirname, "../uploads/qr"), { dotfiles: "deny", index: false }));
app.use("/", require("./routes/redirectRoutes"));
app.use(notFoundHandler);
app.use(errorHandler);
module.exports = app;
