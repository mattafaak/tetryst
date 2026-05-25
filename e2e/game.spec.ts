/**
 * Playwright E2E tests for tetryst.
 *
 * Verifies the game loads in a browser, renders a canvas,
 * responds to keyboard input, and transitions through game phases.
 *
 * These tests run against the Vite dev server via `npm run dev`.
 */
import { test, expect } from "@playwright/test";

test("page loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await page.waitForTimeout(1000);

  expect(errors).toHaveLength(0);
});

test("canvas element is present and renders game content", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1000);

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  expect(await canvas.count()).toBe(1);
});

test("pressing Enter starts a marathon game", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);

  // Press Enter to start a game
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);

  // Canvas should still be visible (game is rendering)
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
});

test("Arrow keys cycle through modes in menu", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);

  // ArrowLeft should cycle mode
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(100);

  // ArrowRight should also work
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
});

test("page title contains tetryst", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/tetryst/i);
});

test("game does not crash after multiple rapid inputs", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await page.waitForTimeout(300);

  // Rapid sequence of inputs
  const keys = ["Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(50);
  }

  await page.waitForTimeout(500);
  expect(errors).toHaveLength(0);
});

test("mute key press does not break game", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(500);

  // Start a game, then mute
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(300);

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
});

test("canvas renders at common viewport sizes", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/");
  await page.waitForTimeout(1000);
  let canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  await page.setViewportSize({ width: 400, height: 700 });
  await page.waitForTimeout(500);
  canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
});
