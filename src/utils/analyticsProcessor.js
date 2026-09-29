const { createHash } = require("crypto");
const prisma = require("../config/database");
const { parseUserAgent } = require("./userAgent");
const { getGeoLocation } = require("./geoip");

function scalar(value, maxLength = 500) {
  return typeof value === "string" && value ? value.slice(0, maxLength) : null;
}

function sanitizeReferer(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    // Tokens or other credentials may appear in a referrer's query/fragment.
    url.search = "";
    url.hash = "";
    url.username = "";
    url.password = "";
    return url.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

function analyticsQuery(query = {}) {
  return {
    utm_source: scalar(query.utm_source),
    utm_medium: scalar(query.utm_medium),
    utm_campaign: scalar(query.utm_campaign),
  };
}

function getClickId(job) {
  if (typeof job.data.clickId === "string") return job.data.clickId;
  // Existing jobs did not include clickId. A stable ID also makes their retry safe.
  const hex = createHash("sha256").update(`analytics:${job.id}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function processAnalyticsJob(job) {
  if (job.name !== "track-click") return;
  const { linkId, slug } = job.data;
  const ip = scalar(job.data.ip, 100) || "Unknown";
  const userAgent = scalar(job.data.userAgent, 2048);
  const { browser, os, device } = parseUserAgent(userAgent);
  const { country, city } = getGeoLocation(ip);
  const query = analyticsQuery(job.data.query || {});
  const clickedAt = new Date(job.data.clickedAt || job.timestamp || Date.now());

  try {
    const tracked = await prisma.$transaction(async (tx) => {
      const result = await tx.click.createMany({
        data: {
          id: getClickId(job),
          linkId,
          clickedAt,
          ip,
          userAgent,
          browser,
          os,
          device,
          country,
          city,
          referer: sanitizeReferer(job.data.referer),
          utmSource: query.utm_source,
          utmMedium: query.utm_medium,
          utmCampaign: query.utm_campaign,
        },
        skipDuplicates: true,
      });
      if (result.count === 0) return false;
      await tx.link.update({
        where: { id: linkId },
        data: { clickCount: { increment: 1 } },
      });
      return true;
    });
    return { tracked, slug };
  } catch (error) {
    // Deleting a link also deletes its clicks; queued clicks need no retry then.
    if (error.code === "P2003" || error.code === "P2025") {
      return { tracked: false, slug, deleted: true };
    }
    throw error;
  }
}

module.exports = { processAnalyticsJob, analyticsQuery, sanitizeReferer };
