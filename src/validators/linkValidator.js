const { body, param, query } = require("express-validator");

const slugPattern = /^[a-zA-Z0-9_-]{3,50}$/;

const createLinkValidator = [
  body("originalUrl")
    .isString()
    .withMessage("URL must be a string")
    .bail()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
      require_valid_protocol: true,
    })
    .withMessage("Valid HTTP or HTTPS URL is required"),

  body("title")
    .optional({ nullable: true })
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Title must not exceed 200 characters"),

  body("slug")
    .optional()
    .isString()
    .withMessage("Slug must be a string")
    .bail()
    .matches(slugPattern)
    .withMessage("Slug must be 3-50 characters"),

  body("expiresAt")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Invalid expiry date")
    .bail()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Expiry date must be in the future");
      }

      return true;
    }),

  body("maxClicks")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("Max clicks must be a positive integer")
    .toInt(),

  body("tags")
    .optional()
    .isArray({ max: 20 })
    .withMessage("Tags must be an array with at most 20 items")
    .bail()
    .custom((tags) => {
      if (
        !tags.every(
          (tag) =>
            typeof tag === "string" &&
            tag.length > 0 &&
            tag.length <= 50
        )
      ) {
        throw new Error("Each tag must be 1-50 characters");
      }

      return true;
    }),
];

const updateLinkValidator = [
  body("originalUrl")
    .optional()
    .isString()
    .withMessage("URL must be a string")
    .bail()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
      require_valid_protocol: true,
    })
    .withMessage("Valid HTTP or HTTPS URL is required"),

  body("title")
    .optional({ nullable: true })
    .isString()
    .withMessage("Title must be a string")
    .bail()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Title must not exceed 200 characters"),

  body("slug")
    .optional()
    .isString()
    .withMessage("Slug must be a string")
    .bail()
    .matches(slugPattern)
    .withMessage("Slug must be 3-50 characters"),

  body("expiresAt")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Invalid expiry date")
    .bail()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Expiry date must be in the future");
      }

      return true;
    }),

  body("maxClicks")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("Max clicks must be a positive integer")
    .toInt(),

  body("tags")
    .optional()
    .isArray({ max: 20 })
    .withMessage("Tags must be an array with at most 20 items")
    .bail()
    .custom((tags) => {
      if (
        !tags.every(
          (tag) =>
            typeof tag === "string" &&
            tag.length > 0 &&
            tag.length <= 50
        )
      ) {
        throw new Error("Each tag must be 1-50 characters");
      }

      return true;
    }),
];

const linkIdValidator = [
  param("id")
    .isUUID()
    .withMessage("Invalid link ID"),
];

const linkListValidator = [
  query("page")
    .optional()
    .isInt({ min: 1, max: 1000000 })
    .withMessage("Invalid page")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
];

module.exports = {
  createLinkValidator,
  updateLinkValidator,
  linkIdValidator,
  linkListValidator,
};