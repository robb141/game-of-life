const { test, expect } = require("@playwright/test");

test("board loads, a pattern is placed, and play advances the generation counter", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#grid")).toBeVisible();
  await expect(page.locator("#playPause")).toBeVisible();

  // The app auto-loads a default pattern on init - wait for at least one live cell.
  await expect(page.locator("#liveCount")).not.toHaveText("0", { timeout: 10_000 });

  await page.locator("#playPause").click();
  await expect(page.locator("#generation")).not.toHaveText("0", { timeout: 10_000 });
});
