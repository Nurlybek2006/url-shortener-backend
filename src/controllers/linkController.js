const linkService = require("../services/linkService");

async function createLink(req, res, next) {
  try {
    const link = await linkService.createLink(
      req.user.userId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Link created successfully",
      data: {
        link,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getLinks(req, res, next) {
  try {
    const result = await linkService.getLinks(
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

async function getLinkById(req, res, next) {
  try {
    const link = await linkService.getLinkById(
      req.params.id,
      req.user.userId
    );

    res.status(200).json({
      success: true,
      data: {
        link,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function updateLink(req, res, next) {
  try {
    const link = await linkService.updateLink(
      req.params.id,
      req.user.userId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Link updated successfully",
      data: {
        link,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function deleteLink(req, res, next) {
  try {
    const result = await linkService.deleteLink(
      req.params.id,
      req.user.userId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createLink,
  getLinks,
  getLinkById,
  updateLink,
  deleteLink,
};