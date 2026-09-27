const express = require("express");

const {
  redirect,
  verifyPassword,
} = require("../controllers/redirectController");

const { verifyPasswordValidator } = require("../validators/linkValidator");

const validate = require("../middleware/validate");

const router = express.Router();

router.post("/:slug/verify", verifyPasswordValidator, validate, verifyPassword);

router.get("/:slug", redirect);

module.exports = router;
