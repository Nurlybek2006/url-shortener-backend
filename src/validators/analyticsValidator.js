const { param, query } = require("express-validator");

const linkAnalyticsValidator = [
  param("id")
    .isUUID()
    .withMessage("Invalid link ID"),

  query("days")
    .optional()
    .isString().withMessage("Query parameter must be a single value").bail()
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
    .isString().withMessage("Query parameter must be a single value").bail()
    .isInt({ min: 1, max: 1000000 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isString().withMessage("Query parameter must be a single value").bail()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
];

const overviewValidator = [
  query("days")
    .optional()
    .isString().withMessage("Query parameter must be a single value").bail()
    .isInt({ min: 1, max: 365 })
    .withMessage("Days must be between 1 and 365")
    .toInt(),
];

module.exports = {
  linkAnalyticsValidator,
  clicksValidator,
  overviewValidator,
};