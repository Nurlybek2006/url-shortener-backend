const express = require("express");

const {
  redirect,
} = require("../controllers/redirectController");

const router = express.Router();

router.get("/:slug", redirect);

module.exports = router;