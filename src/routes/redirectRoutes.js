const express = require("express");

const {
  redirect,
  verifyPassword,
} = require("../controllers/redirectController");

const { verifyPasswordValidator, redirectValidator } = require("../validators/linkValidator");
const { redirectLimiter, passwordLimiter } = require("../middleware/rateLimiter");

const validate = require("../middleware/validate");

const router = express.Router();

router.post("/:slug/verify", redirectLimiter, passwordLimiter, redirectValidator, verifyPasswordValidator, validate, verifyPassword);

router.get("/:slug", redirectLimiter, redirectValidator, validate, redirect);

module.exports = router;
