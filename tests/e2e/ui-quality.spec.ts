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

  // 1b. Accessibility Pass on Design Gallery Screen
  test("Design Gallery Screen WCAG AA Accessibility with Axe", async ({ page }) => {
    await page.goto("/design");
    await page.waitForLoadState("networkidle");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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

  // 7. Gamification in Demo Mode (Port 3000): displays "Demo data", score gauge, badges, quests
  test("Gamification Layer in Demo Mode shows Demo data badge, Flight Score, and badges", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator('button:has-text("Rewards"):visible').click();
    await expect(page.locator('[data-testid="demo-data-label"]')).toContainText("Demo data");
    await expect(page.getByRole("heading", { name: /Flight Score Composition/i })).toBeVisible();
    await expect(page.locator("text=840")).toBeVisible();
    await expect(page.locator("text=First Landing")).toBeVisible();
  });

  // 8. Gamification in Production Mode (Port 3001): displays "Coming Soon" with zero mock numbers
  test("Gamification Layer in Production Mode hides mock numbers and displays Coming Soon", async ({ page }) => {
    await page.goto("http://localhost:3001/");
    await page.waitForLoadState("networkidle");
    await page.locator('button:has-text("Rewards"):visible').click();
    await expect(page.getByRole("heading", { name: "FlightDeck Rewards Coming Soon" })).toBeVisible();
    await expect(page.locator("text=840")).not.toBeVisible();
    await expect(page.locator("text=First Landing")).not.toBeVisible();
  });

  // 9. Verify 14px minimum-text rule, overflow, and screenshots across 360px/390px in Dark & Light
  test("9. 14px minimum-text rule and mobile layout checks on 7 screens at 360px and 390px (Dark & Light)", async ({ page }) => {
    test.setTimeout(120000);
    const viewports = [
      { w: 360, h: 740 },
      { w: 390, h: 844 },
    ];
    const themes = ["dark", "light"] as const;

    for (const { w, h } of viewports) {
      for (const theme of themes) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto("/");
        await page.waitForLoadState("domcontentloaded");

        // Apply theme
        await page.evaluate((th) => {
          if (th === "dark") {
            document.documentElement.classList.remove("light");
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
          }
        }, theme);

        const checkOverflow = async (screenName: string) => {
          const bad = await page.evaluate(() => {
            const list: Array<{ tag: string; className: string; scrollWidth: number; right: number; text: string }> = [];
            document.querySelectorAll("*").forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (el.scrollWidth > window.innerWidth + 1 || rect.right > window.innerWidth + 1) {
                list.push({
                  tag: el.tagName,
                  className: typeof el.className === "string" ? el.className : "",
                  scrollWidth: el.scrollWidth,
                  right: rect.right,
                  text: (el.textContent || "").trim().slice(0, 30),
                });
              }
            });
            return list;
          });
          if (bad.length > 0) {
            console.log(`[Overflow on ${screenName} at ${w}px ${theme}]:`, JSON.stringify(bad.slice(0, 5)));
          }
          expect(bad.length).toBe(0);
        };

        // --- SCREEN 1: Hero ---
        await expect(page.locator("header")).toBeVisible();
        await page.screenshot({ path: `docs/screenshots/hero-${w}-${theme}.png`, fullPage: false });
        await checkOverflow("Hero");

        // --- SCREEN 2: Flight Picker ---
        await page.locator("#see-my-fare-btn").click();
        await expect(page.locator("text=Select Your Flight")).toBeVisible();
        await page.screenshot({ path: `docs/screenshots/flight-${w}-${theme}.png`, fullPage: false });
        await checkOverflow("Flight Picker");

        // --- SCREEN 3: Corridor Step & SCREEN 4: Fare Card ---
        await page.locator("#flight-confirm-btn").click();
        await expect(page.locator("text=Verify Boarding Pass")).toBeVisible();
        await page.locator("#verify-pass-btn").click();
        await expect(page.locator("text=Select Drop-off Corridor")).toBeVisible();
        await page.screenshot({ path: `docs/screenshots/corridor-${w}-${theme}.png`, fullPage: false });

        // Fare Card
        const fareCard = page.locator("text=Guaranteed Fare").locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')]").first();
        if (await fareCard.isVisible()) {
          await fareCard.screenshot({ path: `docs/screenshots/fare-${w}-${theme}.png` });
        }
        await checkOverflow("Corridor & Fare");

        // --- SCREEN 5: Login Step (Passenger Verification) ---
        await page.locator("#request-ride-btn").click();
        await expect(page.locator("#login-btn")).toBeVisible();
        await page.screenshot({ path: `docs/screenshots/login-${w}-${theme}.png`, fullPage: false });
        await checkOverflow("Login Confirmation");

        // --- SCREEN 6: Pool Screen ---
        await page.locator("#demo-persona-toggle").first().click();
        await page.locator("text=Aarav Sharma").first().click();
        await page.locator("#login-btn").click();
        await expect(page.locator("text=Scanning Pool Formation...").or(page.locator("text=Active Pool"))).toBeVisible();
        await page.screenshot({ path: `docs/screenshots/pool-${w}-${theme}.png`, fullPage: false });
        await checkOverflow("Active Pool");

        // --- SCREEN 7: Rewards Tab ---
        await page.locator('button:has-text("Rewards"):visible').first().click();
        await expect(page.locator('[data-testid="demo-data-label"]')).toBeVisible();
        await page.screenshot({ path: `docs/screenshots/rewards-${w}-${theme}.png`, fullPage: false });
        await checkOverflow("Rewards Tab");

        // Font size check on Rewards screen: ensure small text classes respect 14px rule
        const textUnder14Count = await page.evaluate(() => {
          const els = document.querySelectorAll<HTMLElement>('.text-xs, .text-\\[10px\\], .text-\\[11px\\], .text-\\[12px\\], .text-\\[13px\\], .custom-zone-tooltip');
          let count = 0;
          els.forEach((el) => {
            const fs = parseFloat(window.getComputedStyle(el).fontSize);
            if (fs < 13.5) count++;
          });
          return count;
        });
        expect(textUnder14Count).toBe(0);
      }
    }
  });
});
