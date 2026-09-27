const { param, query } = require("express-validator");

const linkAnalyticsValidator = [
  param("id")
    .isUUID()
    .withMessage("Invalid link ID"),

  query("days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Days must be between 1 and 365")
    .toInt(),
];

const clicksValidator = [
  param("id")
    .isUUID()
    .withMessage("Invalid link ID"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
];

const overviewValidator = [
  query("days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Days must be between 1 and 365")
    .toInt(),
];

module.exports = {
  linkAnalyticsValidator,
  clicksValidator,
  overviewValidator,
};