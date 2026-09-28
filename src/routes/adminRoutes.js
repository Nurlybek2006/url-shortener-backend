const express = require("express");

const {
  getAllLinks,
} = require("../controllers/adminController");

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

router.use(auth);
router.use(admin);

router.get("/links", getAllLinks);

module.exports = router;