const fs = require("fs").promises;
const path = require("path");
const env = require("../config/env");
const logger = require("./logger");

const QR_DIRECTORY = path.resolve(__dirname, "../../uploads/qr");

function getQRFilePath(qrUrl) {
  if (typeof qrUrl !== "string") return null;
  let url;
  try {
    url = new URL(qrUrl);
  } catch {
    return null;
  }
  const base = new URL(env.baseUrl);
  const prefix = `${base.pathname.replace(/\/$/, "")}/uploads/qr/`;
  if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) return null;
  const fileName = url.pathname.slice(prefix.length);
  // Only our generated names are eligible; encoded separators and traversal fail.
  if (!/^qr-[a-zA-Z0-9-]+\.png$/.test(fileName)) return null;
  const resolved = path.resolve(QR_DIRECTORY, fileName);
  return path.dirname(resolved) === QR_DIRECTORY ? resolved : null;
}

async function removeQRFile(qrUrl) {
  const filePath = getQRFilePath(qrUrl);
  if (!filePath) return false;
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.warn("Could not remove generated QR file", { code: error.code });
    }
    return false;
  }
}

module.exports = { QR_DIRECTORY, getQRFilePath, removeQRFile };
