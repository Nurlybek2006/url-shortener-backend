const QRCode = require("qrcode");

const path = require("path");
const fs = require("fs").promises;

const prisma = require("../config/database");
const env = require("../config/env");

const AppError = require("../utils/AppError");

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

    width: size,

    color: {
      dark: options.darkColor || "#000000",

      light: options.lightColor || "#FFFFFF",
    },
  };

  const buffer = await QRCode.toBuffer(shortUrl, qrOptions);

  const fileName = `qr-${link.id}-${Date.now()}.png`;

  const uploadDirectory = path.join(process.cwd(), "uploads", "qr");

  await fs.mkdir(uploadDirectory, {
    recursive: true,
  });

  const filePath = path.join(uploadDirectory, fileName);

  await fs.writeFile(filePath, buffer);

  const qrUrl = `${env.baseUrl}/uploads/qr/${fileName}`;

  await prisma.link.update({
    where: {
      id: link.id,
    },

    data: {
      qrCodeUrl: qrUrl,
    },
  });

  return {
    qrUrl,
    shortUrl,
    fileName,
  };
}

module.exports = {
  generateQRCode,
};
