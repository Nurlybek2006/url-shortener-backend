module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  clearMocks: true,
  maxWorkers: 1,
  testTimeout: 15000,
  collectCoverageFrom: ["src/**/*.js", "!src/docs/**"],
  coverageDirectory: "coverage",
};
