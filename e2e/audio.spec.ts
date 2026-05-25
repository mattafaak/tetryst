import { test, expect } from "@playwright/test";

test("audio: music plays without errors after starting game", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.waitForTimeout(1000);

  // Start game — music should begin
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);

  // Gameplay interactions trigger SFX
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("KeyZ");
  await page.keyboard.press("KeyC");
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);

  // Mute toggle
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyM");
  await page.waitForTimeout(2000);

  expect(errors).toHaveLength(0);
});
