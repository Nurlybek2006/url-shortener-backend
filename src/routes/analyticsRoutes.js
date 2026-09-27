const express = require("express");

const {
  getLinkStats,
  getLinkClicks,
  getLinkAnalytics,
  getOverview,
} = require(
  "../controllers/analyticsController"
);

const {
  linkAnalyticsValidator,
  clicksValidator,
  overviewValidator,
} = require(
  "../validators/analyticsValidator"
);

const auth = require("../middleware/auth");
const validate = require("../middleware/validate");

const router = express.Router();

router.get(
  "/links/:id/stats",
  auth,
  linkAnalyticsValidator,
  validate,
  getLinkStats
);

router.get(
  "/links/:id/clicks",
  auth,
  clicksValidator,
  validate,
  getLinkClicks
);

router.get(
  "/links/:id/analytics",
  auth,
  linkAnalyticsValidator,
  validate,
  getLinkAnalytics
);

router.get(
  "/analytics/overview",
  auth,
  overviewValidator,
  validate,
  getOverview
);

module.exports = router;