const { rateLimit } = require("express-rate-limit");

function createLimiter(windowMs, limit) {
  return rateLimit({
    windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    message: { success: false, error: "Too many requests, please try again later" },
  });
}
module.exports = {
  apiLimiter: createLimiter(15 * 60 * 1000, 300),
  authLimiter: createLimiter(15 * 60 * 1000, 20),
  redirectLimiter: createLimiter(60 * 1000, 200),
  passwordLimiter: createLimiter(15 * 60 * 1000, 20),
};
