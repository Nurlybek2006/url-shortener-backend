const express = require("express");

const {
  createLink,
  getLinks,
  getLinkById,
  updateLink,
  deleteLink,
  toggleLink,
  generateQR,
} = require("../controllers/linkController");

const {
  createLinkValidator,
  updateLinkValidator,
  linkIdValidator,
  linkListValidator,
  qrValidator,
} = require("../validators/linkValidator");

const auth = require("../middleware/auth");

const validate = require("../middleware/validate");

const router = express.Router();

router.use(auth);

router.post("/", createLinkValidator, validate, createLink);

router.get("/", linkListValidator, validate, getLinks);

router.get("/:id", linkIdValidator, validate, getLinkById);

router.patch(
  "/:id",
  linkIdValidator,
  updateLinkValidator,
  validate,
  updateLink,
);

router.post("/:id/toggle", linkIdValidator, validate, toggleLink);

router.post("/:id/qr", linkIdValidator, qrValidator, validate, generateQR);

router.delete("/:id", linkIdValidator, validate, deleteLink);

module.exports = router;
