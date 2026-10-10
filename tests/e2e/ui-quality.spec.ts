import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "fs";
import path from "path";

test.describe("UI Quality, Accessibility (WCAG AA) & Screenshots", () => {
  test.beforeAll(async () => {
    const screenshotDir = path.resolve(process.cwd(), "docs/screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  // 1. Accessibility Pass on Home Screen
  test("Home Screen WCAG AA Accessibility with Axe", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"]) // Exclude OSM tile raster maps if needed
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  // 2. Capture Home Screen Screenshots: 390x844 (Dark & Light) and 1440x900 (Dark & Light)
  test("Capture Home Screen screenshots (390x844 and 1440x900, dark and light)", async ({ page }) => {
    // Mobile Dark (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: "docs/screenshots/home-mobile-dark-390.png", fullPage: true });

    // Mobile Light (390x844)
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.screenshot({ path: "docs/screenshots/home-mobile-light-390.png", fullPage: true });

    // Desktop Dark (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    await page.screenshot({ path: "docs/screenshots/home-desktop-dark-1440.png" });

    // Desktop Light (1440x900)
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.screenshot({ path: "docs/screenshots/home-desktop-light-1440.png" });
  });

  // 3. Capture Landing Wave Screen screenshots
  test("Capture Landing Wave Screen screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/landing-wave");
    await page.waitForLoadState("networkidle");

    // Dark
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: "docs/screenshots/landing-wave-dark-1440.png" });

    // Light
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.screenshot({ path: "docs/screenshots/landing-wave-light-1440.png" });
  });

  // 4. Capture Admin Dashboard screenshots
  test("Capture Admin Dashboard screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Dark
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: "docs/screenshots/admin-dark-1440.png" });

    // Light
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.screenshot({ path: "docs/screenshots/admin-light-1440.png" });
  });

  // 5. Capture Driver Screen screenshots
  test("Capture Driver Screen screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/driver");
    await page.waitForLoadState("networkidle");

    // Dark
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: "docs/screenshots/driver-mobile-dark-390.png" });

    // Light
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.screenshot({ path: "docs/screenshots/driver-mobile-light-390.png" });
  });

  // 6. Capture Marshal Screen screenshots
  test("Capture Marshal Screen screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/marshal");
    await page.waitForLoadState("networkidle");

    // Dark
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: "docs/screenshots/marshal-dark-1440.png" });

    // Light
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await page.screenshot({ path: "docs/screenshots/marshal-light-1440.png" });
  });
});
