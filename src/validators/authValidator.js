const { body } = require("express-validator");

const registerValidator = [
  body("name")
    .isString().withMessage("Name must be a string").bail()
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("email")
    .isString().withMessage("Email must be a string").bail()
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email")
    .normalizeEmail(),

  body("password")
    .isString().withMessage("Password must be a string").bail()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 UTF-8 bytes"),
];

const loginValidator = [
  body("email")
    .isString().withMessage("Email must be a string").bail()
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email")
    .normalizeEmail(),

  body("password")
    .isString().withMessage("Password must be a string").bail()
    .notEmpty()
    .withMessage("Password is required")
    .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 UTF-8 bytes"),
];

module.exports = {
  registerValidator,
  loginValidator,
};
