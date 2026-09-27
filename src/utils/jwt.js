const jwt = require("jsonwebtoken");

const env = require("../config/env");

function generateToken(userId, role) {
  return jwt.sign(
    {
      userId,
      role,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
    }
  );
}

function generateRedirectToken(linkId) {
  return jwt.sign(
    {
      linkId,
      purpose: "redirect",
    },
    env.jwtSecret,
    {
      expiresIn: "5m",
    }
  );
}

function verifyToken(token) {
  return jwt.verify(
    token,
    env.jwtSecret
  );
}

module.exports = {
  generateToken,
  generateRedirectToken,
  verifyToken,
};