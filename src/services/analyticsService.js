const prisma = require("../config/database");
const redis = require("../config/redis");

const AppError = require("../utils/AppError");

async function findOwnedLink(linkId, userId) {
  const link = await prisma.link.findFirst({
    where: {
      id: linkId,
      userId,
    },
  });

  if (!link) {
    throw new AppError("Link not found", 404);
  }

  return link;
}

// ========================================
// GENERAL STATS
// ========================================

async function getLinkStats(linkId, userId) {
  const link = await findOwnedLink(linkId, userId);

  const redisCount = await redis.get(`link:${link.slug}:clicks`);

  const totalClicks =
    Math.max(Number(redisCount) || 0, link.clickCount);

  const uniqueVisitorsResult = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT "ip")::int AS count
    FROM "Click"
    WHERE "linkId" = ${linkId}
  `;

  const uniqueVisitors = uniqueVisitorsResult[0]?.count || 0;

  const lastClick = await prisma.click.findFirst({
    where: {
      linkId,
    },

    orderBy: {
      clickedAt: "desc",
    },

    select: {
      clickedAt: true,
    },
  });

  return {
    linkId: link.id,
    slug: link.slug,

    totalClicks,
    uniqueVisitors,

    lastClickedAt: lastClick?.clickedAt || null,

    createdAt: link.createdAt,
  };
}

// ========================================
// CLICK LIST
// ========================================

async function getLinkClicks(linkId, userId, options = {}) {
  await findOwnedLink(linkId, userId);

  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 20;

  const skip = (page - 1) * limit;

  const [clicks, total] = await prisma.$transaction([
    prisma.click.findMany({
      where: {
        linkId,
      },

      orderBy: {
        clickedAt: "desc",
      },

      skip,
      take: limit,

      select: {
        id: true,
        clickedAt: true,

        ip: true,

        browser: true,
        os: true,
        device: true,

        country: true,
        city: true,

        referer: true,

        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
      },
    }),

    prisma.click.count({
      where: {
        linkId,
      },
    }),
  ]);

  return {
    clicks,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ========================================
// FULL LINK ANALYTICS
// ========================================

async function getLinkAnalytics(linkId, userId, days = 30) {
  await findOwnedLink(linkId, userId);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const where = {
    linkId,

    clickedAt: {
      gte: since,
    },
  };

  const [totalClicks, byBrowser, byOS, byDevice, byCountry] = await Promise.all(
    [
      prisma.click.count({
        where,
      }),

      prisma.click.groupBy({
        by: ["browser"],
        where,

        _count: {
          id: true,
        },

        orderBy: {
          _count: {
            id: "desc",
          },
        },

        take: 10,
      }),

      prisma.click.groupBy({
        by: ["os"],
        where,

        _count: {
          id: true,
        },

        orderBy: {
          _count: {
            id: "desc",
          },
        },

        take: 10,
      }),

      prisma.click.groupBy({
        by: ["device"],
        where,

        _count: {
          id: true,
        },

        orderBy: {
          _count: {
            id: "desc",
          },
        },

        take: 10,
      }),

      prisma.click.groupBy({
        by: ["country"],
        where,

        _count: {
          id: true,
        },

        orderBy: {
          _count: {
            id: "desc",
          },
        },

        take: 10,
      }),
    ],
  );

  // Күндер бойынша
  const byDay = await prisma.$queryRaw`
    SELECT
      DATE("clickedAt") AS date,
      COUNT(*)::int AS count
    FROM "Click"
    WHERE "linkId" = ${linkId}
      AND "clickedAt" >= ${since}
    GROUP BY DATE("clickedAt")
    ORDER BY date ASC
  `;

  // Сағаттар бойынша
  const byHour = await prisma.$queryRaw`
    SELECT
      EXTRACT(HOUR FROM "clickedAt")::int AS hour,
      COUNT(*)::int AS count
    FROM "Click"
    WHERE "linkId" = ${linkId}
      AND "clickedAt" >= ${since}
    GROUP BY EXTRACT(HOUR FROM "clickedAt")
    ORDER BY hour ASC
  `;

  // Unique visitor
  const uniqueVisitorsResult = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT "ip")::int AS count
      FROM "Click"
      WHERE "linkId" = ${linkId}
        AND "clickedAt" >= ${since}
    `;

  return {
    totalClicks,

    uniqueVisitors: uniqueVisitorsResult[0]?.count || 0,

    byBrowser: byBrowser.map((item) => ({
      name: item.browser || "Unknown",
      count: item._count.id,
    })),

    byOS: byOS.map((item) => ({
      name: item.os || "Unknown",
      count: item._count.id,
    })),

    byDevice: byDevice.map((item) => ({
      name: item.device || "Unknown",
      count: item._count.id,
    })),

    byCountry: byCountry.map((item) => ({
      name: item.country || "Unknown",
      count: item._count.id,
    })),

    byDay,

    byHour,

    period: {
      days,
      since,
      until: new Date(),
    },
  };
}

// ========================================
// USER OVERVIEW
// ========================================

async function getOverview(userId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalLinks, activeLinks, totalClicks] = await Promise.all([
    prisma.link.count({
      where: {
        userId,
      },
    }),

    prisma.link.count({
      where: {
        userId,
        status: "ACTIVE",
      },
    }),

    prisma.click.count({
      where: {
        link: {
          userId,
        },

        clickedAt: {
          gte: since,
        },
      },
    }),
  ]);

  const topLinks = await prisma.link.findMany({
    where: {
      userId,
    },

    orderBy: {
      clickCount: "desc",
    },

    take: 5,

    select: {
      id: true,
      slug: true,
      title: true,
      originalUrl: true,
      clickCount: true,
      createdAt: true,
    },
  });

  return {
    totalLinks,
    activeLinks,
    totalClicks,

    topLinks,

    period: {
      days,
      since,
      until: new Date(),
    },
  };
}

module.exports = {
  getLinkStats,
  getLinkClicks,
  getLinkAnalytics,
  getOverview,
};
