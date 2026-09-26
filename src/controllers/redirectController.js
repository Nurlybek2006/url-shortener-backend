const redirectService = require(
  "../services/redirectService"
);

const analyticsQueue = require(
  "../queues/analyticsQueue"
);

async function redirect(req, res, next) {
  try {
    const { slug } = req.params;

    const { link } =
      await redirectService.resolveRedirect(slug);

    await analyticsQueue.add(
      "track-click",
      {
        linkId: link.id,

        slug: link.slug,

        ip: req.ip,

        userAgent:
          req.headers["user-agent"] || null,

        referer:
          req.headers.referer ||
          req.headers.referrer ||
          null,

        query: req.query,
      }
    );

    return res.redirect(
      302,
      link.originalUrl
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  redirect,
};