const prisma = require("../config/database");
const redis = require("../config/redis");

const AppError = require("../utils/AppError");

const CACHE_TTL = 60 * 60;

function getCacheKey(slug) {
  return `link:${slug}`;
}

async function getLinkBySlug(slug) {
  const cacheKey = getCacheKey(slug);

  // 1. Алдымен Redis-тен іздейміз
  const cachedLink = await redis.get(cacheKey);

  if (cachedLink) {
    return JSON.parse(cachedLink);
  }

  // 2. Redis-те болмаса PostgreSQL-дан іздейміз
  const link = await prisma.link.findUnique({
    where: {
      slug,
    },

    select: {
      id: true,
      slug: true,
      originalUrl: true,
      status: true,
      password: true,
      expiresAt: true,
      maxClicks: true,
      clickCount: true,
    },
  });

  if (!link) {
    throw new AppError("Link not found", 404);
  }

  // 3. Redis-ке 1 сағатқа сақтаймыз
  await redis.set(
    cacheKey,
    JSON.stringify(link),
    "EX",
    CACHE_TTL
  );

  return link;
}

async function validateLink(link) {
  if (link.status === "DISABLED") {
    throw new AppError("Link is disabled", 410);
  }

  if (
    link.expiresAt &&
    new Date(link.expiresAt) <= new Date()
  ) {
    throw new AppError("Link has expired", 410);
  }

  if (
    link.maxClicks !== null &&
    link.maxClicks !== undefined
  ) {
    const redisCount = await redis.get(
      `link:${link.slug}:clicks`
    );

    const currentClicks =
      redisCount !== null
        ? Number(redisCount)
        : link.clickCount;

    if (currentClicks >= link.maxClicks) {
      throw new AppError(
        "Link click limit has been reached",
        410
      );
    }
  }

  if (link.password) {
    throw new AppError(
      "Password verification required",
      401
    );
  }

  return true;
}

async function incrementClickCount(link) {
  const counterKey = `link:${link.slug}:clicks`;

  // Redis counter әлі жоқ болса,
  // database-тегі clickCount мәнінен бастаймыз.
  await redis.set(
    counterKey,
    String(link.clickCount),
    "NX"
  );

  const count = await redis.incr(counterKey);

  return count;
}

async function resolveRedirect(slug) {
  const link = await getLinkBySlug(slug);

  await validateLink(link);

  const clickCount = await incrementClickCount(link);

  return {
    link,
    clickCount,
  };
}

module.exports = {
  getLinkBySlug,
  validateLink,
  incrementClickCount,
  resolveRedirect,
};