const redirectService = require("../services/redirectService");

const analyticsQueue = require("../queues/analyticsQueue");

const { randomUUID } = require("crypto");
const { analyticsQuery, sanitizeReferer } = require("../utils/analyticsProcessor");

async function redirect(req, res, next) {
  try {
    const { slug } = req.params;

    const redirectToken = req.query.token || null;

    const { link } = await redirectService.resolveRedirect(slug, redirectToken);

    const clickId = randomUUID();
    // A timeout may occur after Redis accepted the job. Keep the reservation on
    // failure so an ambiguous enqueue cannot reopen a maxClicks slot.
    await analyticsQueue.add("track-click", {
      clickId,
      clickedAt: new Date().toISOString(),
      linkId: link.id,
      slug: link.slug,
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 2048) || null,
      referer: sanitizeReferer(req.headers.referer || req.headers.referrer),
      query: analyticsQuery(req.query),
    }, { jobId: clickId });

    return res.redirect(302, link.originalUrl);
  } catch (error) {
    next(error);
  }
}

async function verifyPassword(req, res, next) {
  try {
    const { slug } = req.params;
    const { password } = req.body;

    const { link, token } = await redirectService.verifyLinkPassword(
      slug,
      password,
    );

    res.status(200).json({
      success: true,

      data: {
        redirectUrl: link.originalUrl,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  redirect,
  verifyPassword,
};
