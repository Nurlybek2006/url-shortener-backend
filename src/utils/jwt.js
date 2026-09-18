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

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = {
  generateToken,
  verifyToken,
};