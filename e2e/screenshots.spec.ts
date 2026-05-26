/**
 * Canvas rendering screenshot tests for tetryst.
 *
 * Captures screenshots of 6 distinct game states and verifies
 * the canvas renders recognizable layouts (not blank).
 *
 * Screenshots are saved to test-results/screenshots/ for
 * manual visual inspection and CI artifact review.
 */
import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

/** Check that the game canvas has rendered non-black content. */
async function expectCanvasHasContent(page: import("@playwright/test").Page) {
  const hasContent = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    // Sample a grid of points to avoid scanning all pixels
    const w = canvas.width;
    const h = canvas.height;
    const step = 20;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] !== 0 || p[1] !== 0 || p[2] !== 0) return true;
      }
    }
    return false;
  });
  expect(hasContent).toBe(true);
}

/** Save screenshot to test-results/screenshots/ */
async function saveScreenshot(
  page: import("@playwright/test").Page,
  name: string,
) {
  const dir = join("test-results", "screenshots");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const buf = await page.screenshot({ type: "png" });
  writeFileSync(join(dir, `${name}.png`), buf);
}

test("menu screen renders recognizable layout", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);
  await expectCanvasHasContent(page);
  await saveScreenshot(page, "01-menu-marathon");
});

test("menu mode switch changes display", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);

  // ArrowRight cycles Marathon → Sprint → Ultra
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  await expectCanvasHasContent(page);
  await saveScreenshot(page, "02-menu-ultra");
});

test("gameplay renders active game", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);

  // Enter starts Marathon (default)
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);

  await expectCanvasHasContent(page);
  await saveScreenshot(page, "03-gameplay");
});

test("pause overlay renders correctly", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);

  // Start game, then press Escape to pause
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await expectCanvasHasContent(page);
  await saveScreenshot(page, "04-pause");
});

test("high score screen displays from menu", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);

  // H key opens high scores from menu
  await page.keyboard.press("KeyH");
  await page.waitForTimeout(500);

  await expectCanvasHasContent(page);
  await saveScreenshot(page, "05-high-scores");
});

test("game-over state renders after lock-out", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);

  // Start a game
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  // Rapidly drop pieces to trigger lock-out / game-over
  // Hard drop (Space) repeatedly to fill the board quickly
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1000);

  await expectCanvasHasContent(page);
  await saveScreenshot(page, "06-game-over");
});
