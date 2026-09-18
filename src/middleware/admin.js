const AppError = require("../utils/AppError");

function admin(req, res, next) {
  if (!req.user) {
    return next(new AppError("Authentication required", 401));
  }

  if (req.user.role !== "ADMIN") {
    return next(new AppError("Admin access required", 403));
  }

  next();
}

module.exports = admin;