const { UAParser } = require("ua-parser-js");

function parseUserAgent(userAgent) {
  if (!userAgent) {
    return {
      browser: "Unknown",
      os: "Unknown",
      device: "Desktop",
    };
  }

  const parser = new UAParser(userAgent);

  const browserResult = parser.getBrowser();
  const osResult = parser.getOS();
  const deviceResult = parser.getDevice();

  let device = "Desktop";

  if (deviceResult.type === "mobile") {
    device = "Mobile";
  } else if (deviceResult.type === "tablet") {
    device = "Tablet";
  } else if (deviceResult.type) {
    device = deviceResult.type;
  }

  return {
    browser: browserResult.name || "Unknown",
    os: osResult.name || "Unknown",
    device,
  };
}

module.exports = {
  parseUserAgent,
};