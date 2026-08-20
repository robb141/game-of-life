// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 15_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.APP_URL || "http://localhost:8080",
    trace: "retain-on-failure",
  },
});
