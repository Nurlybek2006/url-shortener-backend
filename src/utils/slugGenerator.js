const crypto = require("crypto");

const prisma = require("../config/database");

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const SLUG_LENGTH = 7;

function generateRandomSlug(length = SLUG_LENGTH) {
  let slug = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(ALPHABET.length);

    slug += ALPHABET[randomIndex];
  }

  return slug;
}

async function generateUniqueSlug(maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const slug = generateRandomSlug();

    const existingLink = await prisma.link.findUnique({
      where: {
        slug,
      },
    });

    if (!existingLink) {
      return slug;
    }
  }

  for (let i = 0; i < maxAttempts; i++) {
    const slug = generateRandomSlug(SLUG_LENGTH + 2);

    const existingLink = await prisma.link.findUnique({
      where: {
        slug,
      },
    });

    if (!existingLink) {
      return slug;
    }
  }

  throw new Error("Failed to generate unique slug");
}

module.exports = {
  generateRandomSlug,
  generateUniqueSlug,
};