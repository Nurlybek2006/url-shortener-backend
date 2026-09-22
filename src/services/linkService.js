const prisma = require("../config/database");

const redis = require("../config/redis");

const env = require("../config/env");

const AppError = require("../utils/AppError");

const {
  generateUniqueSlug,
} = require("../utils/slugGenerator");

function formatLink(link) {
  return {
    ...link,
    shortUrl: `${env.baseUrl}/${link.slug}`,
  };
}

async function createLink(userId, data) {
  const {
    originalUrl,
    title,
    slug,
    expiresAt,
    maxClicks,
    tags,
  } = data;

  const customSlug = slug !== undefined;

  let finalSlug = slug || (await generateUniqueSlug());

  if (customSlug) {
    const existingLink = await prisma.link.findUnique({
      where: {
        slug: finalSlug,
      },
    });

    if (existingLink) {
      throw new AppError("Slug already exists", 409);
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const link = await prisma.link.create({
        data: {
          originalUrl,
          title: title ?? null,
          slug: finalSlug,
          userId,
          expiresAt: expiresAt
            ? new Date(expiresAt)
            : null,
          maxClicks: maxClicks ?? null,
          tags: tags ?? [],
        },
      });

      return formatLink(link);
    } catch (error) {
      if (error.code === "P2002") {
        if (customSlug) {
          throw new AppError("Slug already exists", 409);
        }

        finalSlug = await generateUniqueSlug();

        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    "Failed to generate unique slug",
    500
  );
}

async function getLinks(userId, options = {}) {
  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;

  const skip = (page - 1) * limit;

  const where = {
    userId,
  };

  const [links, total] = await prisma.$transaction([
    prisma.link.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      skip,
      take: limit,
    }),

    prisma.link.count({
      where,
    }),
  ]);

  return {
    links: links.map(formatLink),

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getLinkById(linkId, userId) {
  const link = await prisma.link.findFirst({
    where: {
      id: linkId,
      userId,
    },
  });

  if (!link) {
    throw new AppError("Link not found", 404);
  }

  return formatLink(link);
}

async function updateLink(linkId, userId, data) {
  const existingLink = await prisma.link.findFirst({
    where: {
      id: linkId,
      userId,
    },
  });

  if (!existingLink) {
    throw new AppError("Link not found", 404);
  }

  const allowedFields = [
    "originalUrl",
    "title",
    "slug",
    "expiresAt",
    "maxClicks",
    "tags",
  ];

  const updateData = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (updateData.expiresAt) {
    updateData.expiresAt = new Date(
      updateData.expiresAt
    );
  }

  if (
    updateData.slug &&
    updateData.slug !== existingLink.slug
  ) {
    const slugExists = await prisma.link.findUnique({
      where: {
        slug: updateData.slug,
      },
    });

    if (slugExists) {
      throw new AppError("Slug already exists", 409);
    }
  }

  let updatedLink;

  try {
    updatedLink = await prisma.link.update({
      where: {
        id: linkId,
        userId,
      },

      data: updateData,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("Slug already exists", 409);
    }

    throw error;
  }

  await redis.del(`link:${existingLink.slug}`);

  if (updatedLink.slug !== existingLink.slug) {
    await redis.del(`link:${updatedLink.slug}`);
  }

  return formatLink(updatedLink);
}

async function deleteLink(linkId, userId) {
  const link = await prisma.link.findFirst({
    where: {
      id: linkId,
      userId,
    },
  });

  if (!link) {
    throw new AppError("Link not found", 404);
  }

  await prisma.link.delete({
    where: {
      id: linkId,
      userId,
    },
  });

  await redis.del(`link:${link.slug}`);

  await redis.del(`link:${link.slug}:clicks`);

  return {
    message: "Link deleted successfully",
  };
}

module.exports = {
  createLink,
  getLinks,
  getLinkById,
  updateLink,
  deleteLink,
};

