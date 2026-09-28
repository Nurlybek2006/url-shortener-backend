const prisma = require("../config/database");

async function getAllLinks(req, res, next) {
  try {
    const page = Math.max(
      Number(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;

    const [links, total] = await prisma.$transaction([
      prisma.link.findMany({
        orderBy: {
          createdAt: "desc",
        },

        skip,
        take: limit,

        select: {
          id: true,
          slug: true,
          originalUrl: true,
          title: true,
          status: true,

          expiresAt: true,
          maxClicks: true,
          clickCount: true,

          tags: true,
          qrCodeUrl: true,

          createdAt: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),

      prisma.link.count(),
    ]);

    res.status(200).json({
      success: true,

      data: {
        links,

        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllLinks,
};