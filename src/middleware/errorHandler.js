const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

function notFoundHandler(req, res, next) { next(new AppError("Route not found", 404)); }
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let statusCode = 500;
  let message = "Internal Server Error";
  if (error.isOperational && Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 503) {
    statusCode = error.statusCode;
    message = statusCode < 500 ? error.message : (statusCode === 503 ? "Service unavailable" : message);
  } else if (error.code === "P2002") {
    statusCode = 409; message = "A record with that unique value already exists";
  } else if (error.code === "P2025") {
    statusCode = 404; message = "Resource not found";
  } else if (error.type === "entity.parse.failed") {
    statusCode = 400; message = "Invalid JSON body";
  } else if (error.type === "entity.too.large") {
    statusCode = 413; message = "Request body is too large";
  } else if (error.name === "PrismaClientValidationError") {
    statusCode = 400; message = "Invalid request data";
  }
  if (statusCode >= 500) logger.error("Request failed", { name: error.name, code: error.code, method: req.method });
  res.status(statusCode).json({ success: false, error: message });
}
module.exports = { notFoundHandler, errorHandler };
