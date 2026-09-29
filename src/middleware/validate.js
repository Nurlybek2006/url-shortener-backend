const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      errors: errors.array().map(({ path, location, msg }) => ({ path, location, msg })),
    });
  }

  next();
}

module.exports = validate;
