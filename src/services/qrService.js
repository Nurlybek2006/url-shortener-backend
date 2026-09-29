const QRCode = require("qrcode");

const path = require("path");
const fs = require("fs").promises;
const { randomUUID } = require("crypto");

const prisma = require("../config/database");
const env = require("../config/env");

const AppError = require("../utils/AppError");
const { QR_DIRECTORY, removeQRFile } = require("../utils/qrFiles");

async function generateQRCode(linkId, userId, options = {}) {
  const link = await prisma.link.findFirst({
    where: {
      id: linkId,
      userId,
    },
  });

  if (!link) {
    throw new AppError("Link not found", 404);
  }

  const shortUrl = `${env.baseUrl}/${link.slug}`;

  const size = Number(options.size) || 512;

  const qrOptions = {
    errorCorrectionLevel: "H",

    type: "png",

    margin: 2,

    // qrcode floors width after division/multiplication; compensate for floating
    // point rounding that otherwise turns e.g. a requested 256px into 255px.
    width: size + Number.EPSILON * size,

    color: {
      dark: options.darkColor || "#000000",

      light: options.lightColor || "#FFFFFF",
    },
  };

  const buffer = await QRCode.toBuffer(shortUrl, qrOptions);

  const fileName = `qr-${randomUUID()}.png`;

  const uploadDirectory = QR_DIRECTORY;

  await fs.mkdir(uploadDirectory, {
    recursive: true,
  });

  const filePath = path.join(uploadDirectory, fileName);

  await fs.writeFile(filePath, buffer);

  const qrUrl = `${env.baseUrl}/uploads/qr/${fileName}`;

  try {
    // A competing QR generation or slug edit must not replace a newer result.
    const result = await prisma.link.updateMany({
      where: { id: link.id, userId, slug: link.slug, qrCodeUrl: link.qrCodeUrl },
      data: { qrCodeUrl: qrUrl },
    });
    if (result.count !== 1) {
      throw new AppError("Link changed during QR generation; please try again", 409);
    }
  } catch (error) {
    await removeQRFile(qrUrl);
    throw error;
  }
  await removeQRFile(link.qrCodeUrl);

  return {
    qrUrl,
    shortUrl,
    fileName,
  };
}

module.exports = {
  generateQRCode,
};
