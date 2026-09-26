const redirectService = require(
  "../services/redirectService"
);

async function redirect(req, res, next) {
  try {
    const { slug } = req.params;

    const { link } =
      await redirectService.resolveRedirect(slug);

    return res.redirect(302, link.originalUrl);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  redirect,
};