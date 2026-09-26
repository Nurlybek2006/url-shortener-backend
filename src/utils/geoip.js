const geoip = require("geoip-lite");

function normalizeIp(ip) {
  if (!ip) {
    return null;
  }

  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }

  if (ip === "::1") {
    return "127.0.0.1";
  }

  return ip;
}

function getGeoLocation(ip) {
  const normalizedIp = normalizeIp(ip);

  if (!normalizedIp) {
    return {
      country: "Unknown",
      city: null,
    };
  }

  const geo = geoip.lookup(normalizedIp);

  if (!geo) {
    return {
      country: "Unknown",
      city: null,
    };
  }

  return {
    country: geo.country || "Unknown",
    city: geo.city || null,
  };
}

module.exports = {
  normalizeIp,
  getGeoLocation,
};