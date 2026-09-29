const prisma = require("../config/database");
const redis = require("../config/redis");

const AppError = require("../utils/AppError");

const { comparePassword } = require("../utils/bcrypt");

const { generateRedirectToken, verifyToken } = require("../utils/jwt");

const CACHE_TTL = 60 * 60;

// Initialization, limit checking and reservation must be one Redis operation.
const RESERVE_CLICK = `
  local current = tonumber(redis.call('GET', KEYS[1]))
  local baseline = tonumber(ARGV[1])
  if not current or current < baseline then current = baseline end
  local limit = tonumber(ARGV[2])
  if limit >= 0 and current >= limit then return -1 end
  current = current + 1
  redis.call('SET', KEYS[1], current)
  return current
`;

function getCacheKey(slug) {
  return `link:${slug}`;
}

async function getLinkBySlug(slug) {
  const cacheKey = getCacheKey(slug);

  const cachedLink = await redis.get(cacheKey);

  if (cachedLink) {
    try {
      return JSON.parse(cachedLink);
    } catch {
      await redis.del(cacheKey);
    }
  }

  // Fall back to PostgreSQL on a cache miss.
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

  // Mutation services invalidate this cached snapshot.
  await redis.set(cacheKey, JSON.stringify(link), "EX", CACHE_TTL);

  return link;
}

async function validateLink(link, redirectToken = null) {
  if (link.status === "DISABLED") {
    throw new AppError("Link is disabled", 410);
  }

  if (link.status === "EXPIRED" || (link.expiresAt && new Date(link.expiresAt) <= new Date())) {
    throw new AppError("Link has expired", 410);
  }

  if (link.maxClicks !== null && link.maxClicks !== undefined) {
    const redisCount = await redis.get(`link:${link.slug}:clicks`);

    const currentClicks =
      Math.max(Number(redisCount) || 0, link.clickCount);

    if (currentClicks >= link.maxClicks) {
      throw new AppError("Link click limit has been reached", 410);
    }
  }

  if (link.password) {
    if (!redirectToken || typeof redirectToken !== "string") {
      throw new AppError("Password verification required", 401);
    }

    let decoded;

    try {
      decoded = verifyToken(redirectToken);
    } catch (error) {
      throw new AppError("Invalid or expired redirect token", 401);
    }

    if (decoded.purpose !== "redirect" || decoded.linkId !== link.id || !Number.isInteger(decoded.exp)) {
      throw new AppError("Invalid redirect token", 401);
    }
  }

  return true;
}

async function incrementClickCount(link) {
  const counterKey = `link:${link.slug}:clicks`;
  let baseline = link.clickCount;
  if (await redis.get(counterKey) === null) {
    // The link cache can outlive an evicted counter. Recover persisted clicks
    // from PostgreSQL instead of reusing that older cached snapshot.
    const currentLink = await prisma.link.findUnique({
      where: { id: link.id, slug: link.slug },
      select: { clickCount: true },
    });
    if (!currentLink) throw new AppError("Link not found", 404);
    baseline = currentLink.clickCount;
  }
  const count = Number(await redis.eval(
    RESERVE_CLICK,
    1,
    counterKey,
    String(baseline),
    String(link.maxClicks ?? -1),
  ));
  if (count === -1) {
    throw new AppError("Link click limit has been reached", 410);
  }
  return count;
}

async function resolveRedirect(slug, redirectToken = null) {
  const link = await getLinkBySlug(slug);

  await validateLink(link, redirectToken);

  const clickCount = await incrementClickCount(link);

  return {
    link,
    clickCount,
  };
}

async function verifyLinkPassword(slug, password) {
  const link = await prisma.link.findUnique({
    where: {
      slug,
    },

    select: {
      id: true,
      slug: true,
      originalUrl: true,
      password: true,
      status: true,
      expiresAt: true,
      maxClicks: true,
      clickCount: true,
    },
  });

  if (!link) {
    throw new AppError("Link not found", 404);
  }

  if (!link.password) {
    throw new AppError("Link is not password protected", 400);
  }

  // Check restrictions before issuing a temporary redirect token.
  if (link.status === "DISABLED") {
    throw new AppError("Link is disabled", 410);
  }

  if (link.status === "EXPIRED" || (link.expiresAt && new Date(link.expiresAt) <= new Date())) {
    throw new AppError("Link has expired", 410);
  }

  const isValid = await comparePassword(password, link.password);

  if (!isValid) {
    throw new AppError("Invalid password", 401);
  }

  if (link.maxClicks !== null) {
    const redisCount = await redis.get(`link:${link.slug}:clicks`);
    if (Math.max(Number(redisCount) || 0, link.clickCount) >= link.maxClicks) {
      throw new AppError("Link click limit has been reached", 410);
    }
  }

  const token = generateRedirectToken(link.id);

  return {
    link,
    token,
  };
}

module.exports = {
  getLinkBySlug,
  validateLink,
  incrementClickCount,
  resolveRedirect,
  verifyLinkPassword,
};
