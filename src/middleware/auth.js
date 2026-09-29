const { verifyToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");

function auth(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      throw new AppError("Authentication required", 401);
    }

    const token = authorization.split(/\s+/)[1];

    const decoded = verifyToken(token);
    if (!decoded || typeof decoded.userId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.userId) ||
        !["USER", "ADMIN"].includes(decoded.role) || decoded.purpose || !Number.isInteger(decoded.exp)) {
      throw new AppError("Invalid token", 401);
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
      return next(new AppError("Invalid token", 401));
    }

    if (error.name === "TokenExpiredError") {
      return next(new AppError("Token expired", 401));
    }

    next(error);
  }
}

module.exports = auth;
