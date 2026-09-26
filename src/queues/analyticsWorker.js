const { Worker } = require("bullmq");

const redis = require("../config/redis");
const prisma = require("../config/database");

const { parseUserAgent } = require("../utils/userAgent");

const { getGeoLocation } = require("../utils/geoip");

const worker = new Worker(
  "analytics",

  async (job) => {
    if (job.name !== "track-click") {
      return;
    }

    const { linkId, slug, ip, userAgent, referer, query } = job.data;

    const { browser, os, device } = parseUserAgent(userAgent);

    const { country, city } = getGeoLocation(ip);

    const utmSource = query?.utm_source || null;

    const utmMedium = query?.utm_medium || null;

    const utmCampaign = query?.utm_campaign || null;

    await prisma.$transaction([
      prisma.click.create({
        data: {
          linkId,
          ip: ip || "Unknown",
          userAgent: userAgent || null,

          browser,
          os,
          device,

          country,
          city,

          referer: referer || null,

          utmSource,
          utmMedium,
          utmCampaign,
        },
      }),

      prisma.link.update({
        where: {
          id: linkId,
        },

        data: {
          clickCount: {
            increment: 1,
          },
        },
      }),
    ]);

    return {
      tracked: true,
      slug,
    };
  },

  {
    connection: redis,
    concurrency: 20,
  },
);

worker.on("completed", (job) => {
  console.log(`Analytics completed: ${job.data.slug}`);
});

worker.on("failed", (job, error) => {
  console.error(`Analytics failed: ${job?.data?.slug}`, error.message);
});

worker.on("error", (error) => {
  console.error("Analytics worker error:", error.message);
});

module.exports = worker;
