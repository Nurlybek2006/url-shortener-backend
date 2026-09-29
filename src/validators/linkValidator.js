const { body, param, query } = require("express-validator");

const slugPattern = /^[a-zA-Z0-9_-]{3,50}$/;
const reservedSlugs = new Set(['api', 'api-docs', 'api-docs.json', 'health', 'ready', 'uploads']);

const createLinkValidator = [
  body("originalUrl")
    .isString()
    .withMessage("URL must be a string")
    .bail()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
      require_valid_protocol: true,
      disallow_auth: true,
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
    .withMessage("Slug must be 3-50 letters, digits, underscores, or hyphens")
    .custom((value) => !reservedSlugs.has(value.toLowerCase()))
    .withMessage("Slug is reserved"),

  body("expiresAt")
    .optional({ nullable: true })
    .isString().withMessage("Expiry must be an ISO date string").bail()
    .isISO8601({ strict: true })
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
    .custom((value) => typeof value === "number" || typeof value === "string")
    .withMessage("Max clicks must be a single integer").bail()
    .isInt({ min: 1, max: 2147483647 })
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
            typeof tag === "string" && tag.length > 0 && tag.length <= 50,
        )
      ) {
        throw new Error("Each tag must be 1-50 characters");
      }

      return true;
    }),

  body("password")
    .optional({ nullable: true })
    .isString()
    .withMessage("Password must be a string")
    .bail()
    .isLength({ min: 4, max: 100 })
    .withMessage("Password must be between 4 and 100 characters")
    .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 UTF-8 bytes"),
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
      disallow_auth: true,
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
    .withMessage("Slug must be 3-50 letters, digits, underscores, or hyphens")
    .custom((value) => !reservedSlugs.has(value.toLowerCase()))
    .withMessage("Slug is reserved"),

  body("expiresAt")
    .optional({ nullable: true })
    .isString().withMessage("Expiry must be an ISO date string").bail()
    .isISO8601({ strict: true })
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
    .custom((value) => typeof value === "number" || typeof value === "string")
    .withMessage("Max clicks must be a single integer").bail()
    .isInt({ min: 1, max: 2147483647 })
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
            typeof tag === "string" && tag.length > 0 && tag.length <= 50,
        )
      ) {
        throw new Error("Each tag must be 1-50 characters");
      }

      return true;
    }),

  body("password")
    .optional({ nullable: true })
    .isString()
    .withMessage("Password must be a string")
    .bail()
    .isLength({ min: 4, max: 100 })
    .withMessage("Password must be between 4 and 100 characters")
    .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 UTF-8 bytes"),
];

const linkIdValidator = [param("id").isUUID().withMessage("Invalid link ID")];

const linkListValidator = [
  query("page")
    .optional()
    .isString().withMessage("Page must be a single value").bail()
    .isInt({ min: 1, max: 1000000 })
    .withMessage("Invalid page")
    .toInt(),

  query("limit")
    .optional()
    .isString().withMessage("Limit must be a single value").bail()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
];

const verifyPasswordValidator = [
  body("password")
    .isString()
    .withMessage("Password is required")
    .bail()
    .notEmpty()
    .withMessage("Password is required")
    .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 UTF-8 bytes"),
];

const qrValidator = [
  body("size")
    .optional()
    .custom((value) => typeof value === "number" || typeof value === "string")
    .withMessage("QR size must be a single integer").bail()
    .isInt({
      min: 128,
      max: 2048,
    })
    .withMessage("QR size must be between 128 and 2048")
    .toInt(),

  body("darkColor")
    .optional()
    .isString().withMessage("Dark color must be a string").bail()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Invalid dark color"),

  body("lightColor")
    .optional()
    .isString().withMessage("Light color must be a string").bail()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Invalid light color"),
];

const redirectValidator = [
  param("slug").matches(slugPattern).withMessage("Invalid slug"),
  query("token").optional().isString().withMessage("Token must be a string").bail().isLength({ max: 2048 }).withMessage("Token is too long"),
];

module.exports = {
  redirectValidator,
  createLinkValidator,
  updateLinkValidator,
  linkIdValidator,
  linkListValidator,
  verifyPasswordValidator,
  qrValidator,
};
