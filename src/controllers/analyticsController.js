const analyticsService = require(
  "../services/analyticsService"
);

async function getLinkStats(req, res, next) {
  try {
    const stats =
      await analyticsService.getLinkStats(
        req.params.id,
        req.user.userId
      );

    res.status(200).json({
      success: true,
      data: {
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getLinkClicks(req, res, next) {
  try {
    const result =
      await analyticsService.getLinkClicks(
        req.params.id,
        req.user.userId,
        req.query
      );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getLinkAnalytics(req, res, next) {
  try {
    const days = Number(req.query.days) || 30;

    const analytics =
      await analyticsService.getLinkAnalytics(
        req.params.id,
        req.user.userId,
        days
      );

    res.status(200).json({
      success: true,
      data: {
        analytics,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getOverview(req, res, next) {
  try {
    const days = Number(req.query.days) || 30;

    const overview =
      await analyticsService.getOverview(
        req.user.userId,
        days
      );

    res.status(200).json({
      success: true,
      data: {
        overview,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getLinkStats,
  getLinkClicks,
  getLinkAnalytics,
  getOverview,
};