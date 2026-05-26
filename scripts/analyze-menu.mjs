/**
 * Analyze mode selection menu alignment.
 * Captures exact pixel positions of each text element.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5176";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

async function getTextBounds() {
  return await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const cx = c.getContext("2d");
    const { width, height } = c;
    const d = cx.getImageData(0, 0, width, height).data;

    // Group colored pixels into horizontal bands by y
    let rows = [];
    for (let y = 0; y < height; y++) {
      let first = -1, last = -1;
      for (let x = 0; x < width; x++) {
        const r = d[(y * width + x) * 4], g = d[(y * width + x) * 4 + 1], b = d[(y * width + x) * 4 + 2];
        if (r > 20 || g > 20 || b > 20) {
          if (first === -1) first = x;
          last = x;
        }
      }
      if (first !== -1) {
        rows.push({ y, first, last, center: Math.round((first + last) / 2), w: last - first + 1 });
      }
    }
    return rows;
  });
}

function describeBands(rows, yStart, yEnd) {
  const bands = [];
  let current = null;
  for (const r of rows) {
    if (r.y < yStart || r.y > yEnd) continue;
    if (
      !current ||
      r.y > current.yEnd + 2 ||
      Math.abs(r.center - current.centerAvg) > 5
    ) {
      if (current) bands.push(current);
      current = { yStart: r.y, yEnd: r.y, centers: [r.center], centerAvg: r.center, count: 1, minCenter: r.center, maxCenter: r.center, minX: r.first, maxX: r.last };
    } else {
      current.yEnd = r.y;
      current.centers.push(r.center);
      current.centerAvg = (current.centerAvg * current.count + r.center) / (current.count + 1);
      current.count++;
      current.minCenter = Math.min(current.minCenter, r.center);
      current.maxCenter = Math.max(current.maxCenter, r.center);
      current.minX = Math.min(current.minX, r.first);
      current.maxX = Math.max(current.maxX, r.last);
    }
  }
  if (current) bands.push(current);
  return bands;
}

function printBands(label, bands) {
  console.log(`\n── ${label} ──`);
  for (const b of bands) {
    const avgCenter = Math.round(b.centerAvg * 10) / 10;
    const textWidth = b.maxX - b.minX + 1;
    const offset = avgCenter - 400;
    const indicator = offset > 2 ? "▶" : offset < -2 ? "◀" : "●";
    console.log(
      `y=${b.yStart}-${b.yEnd}  (${b.yEnd-b.yStart+1}px)  textSpan=${textWidth}px  x=[${b.minX}-${b.maxX}]  center=${avgCenter}  ${indicator}${Math.abs(Math.round(offset))}px`
    );
  }
}

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Grab screenshots too
await page.screenshot({ path: "/tmp/tetryst-marathon.png" });

// --- Marathon menu (initial attract mode) ---
let rows = await getTextBounds();
let bands = describeBands(rows, 0, 500);
printBands("MARATHON (attract)", bands);

// Navigate to Sprint
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(100);

await page.screenshot({ path: "/tmp/tetryst-sprint.png" });

// --- Sprint menu ---
rows = await getTextBounds();
bands = describeBands(rows, 0, 500);
printBands("SPRINT", bands);

// Navigate to Ultra
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(100);

await page.screenshot({ path: "/tmp/tetryst-ultra.png" });

// --- Ultra menu ---
rows = await getTextBounds();
bands = describeBands(rows, 0, 500);
printBands("ULTRA", bands);

// Navigate back to Marathon and set start level
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(100);
for (let i = 0; i < 4; i++) { await page.keyboard.press("ArrowUp"); await page.waitForTimeout(50); }
await page.waitForTimeout(100);

await page.screenshot({ path: "/tmp/tetryst-marathon-lvl5.png" });

// --- Marathon with start level ---
rows = await getTextBounds();
bands = describeBands(rows, 0, 500);
printBands("MARATHON LVL 5", bands);

await browser.close();

console.log("\nScreenshots saved to /tmp/tetryst-*.png");
