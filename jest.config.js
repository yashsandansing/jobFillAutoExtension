module.exports = {
  testEnvironment: "jsdom",
  setupFiles: ["<rootDir>/tests/mock-extension-apis.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  clearMocks: true,
};
