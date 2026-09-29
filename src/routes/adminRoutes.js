const express = require("express");

const {
  getAllLinks,
} = require("../controllers/adminController");

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const { linkListValidator } = require("../validators/linkValidator");
const validate = require("../middleware/validate");

const router = express.Router();

router.use(auth);
router.use(admin);

router.get("/links", linkListValidator, validate, getAllLinks);

module.exports = router;
