const express = require("express");

const {
  register,
  login,
  me,
  logout,
} = require("../controllers/authController");

const {
  registerValidator,
  loginValidator,
} = require("../validators/authValidator");

const validate = require("../middleware/validate");
const auth = require("../middleware/auth");

const router = express.Router();

router.post(
  "/register",
  registerValidator,
  validate,
  register
);

router.post(
  "/login",
  loginValidator,
  validate,
  login
);

router.get(
  "/me",
  auth,
  me
);

router.post(
  "/logout",
  auth,
  logout
);

module.exports = router;