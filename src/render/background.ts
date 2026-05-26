/**
 * Subtle animated star-field background.
 * Renders small drifting dots behind the game board for visual atmosphere.
 * Uses an offscreen canvas with throttled re-renders (~15fps) to reduce per-frame fillRect calls.
 */

import { STAR_COUNT, STAR_TWINKLE_SPEED } from "../core/constants.ts";

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  baseAlpha: number;
}

let stars: Star[] = [];
let initialized = false;

/** Frame-rate independent star drift — track real elapsed time. */
let lastDriftTime = 0;

/** Offscreen canvas for cached star field. */
let cacheCanvas: HTMLCanvasElement | null = null;
let cacheCtx: CanvasRenderingContext2D | null = null;
let lastCacheTime = 0;
const CACHE_INTERVAL = 1000 / 15; // ~15fps cache refresh

function ensureStars(w: number, h: number): void {
  if (initialized) return;
  initialized = true;
  stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 0.4 + Math.random() * 1.6,
    speed: 8 + Math.random() * 16,
    phase: Math.random() * Math.PI * 2,
    baseAlpha: 0.2 + Math.random() * 0.35,
  }));
}

/** Ensure the offscreen cache canvas exists at the given size. */
function ensureCache(w: number, h: number): void {
  if (cacheCanvas && cacheCanvas.width === w && cacheCanvas.height === h) return;
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      cacheCanvas = new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement;
    } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
      cacheCanvas = document.createElement("canvas");
      cacheCanvas.width = w;
      cacheCanvas.height = h;
    } else {
      return; // No canvas API available
    }
    cacheCtx = cacheCanvas.getContext("2d");
    if (!cacheCtx) cacheCanvas = null;
  } catch {
    cacheCanvas = null;
    cacheCtx = null;
  }
}

/** Re-render the full star field (background + current star positions) to the cache canvas. */
function renderCache(w: number, h: number): void {
  if (!cacheCtx) return;
  const ctx = cacheCtx;

  // Dark background
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);

  // Stars at current positions (no twinkle — rendered as average brightness)
  for (const s of stars) {
    ctx.globalAlpha = s.baseAlpha;
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.ceil(s.size), Math.ceil(s.size));
  }
  ctx.globalAlpha = 1;
}

/** Reset on resize so stars re-initialize at the new canvas dimensions. */
let lastW = 0;
let lastH = 0;

export function renderBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  // Bail early on zero-dimension canvas (e.g., during tab switch or initial load)
  if (w <= 0 || h <= 0) return;

  // Re-init on resize
  if (w !== lastW || h !== lastH) {
    initialized = false;
    cacheCanvas = null;
    cacheCtx = null;
    lastW = w;
    lastH = h;
    lastDriftTime = 0;
  }
  ensureStars(w, h);
  ensureCache(w, h);

  // Drift stars at frame-rate-independent speed
  const now = performance.now();
  const dt = lastDriftTime === 0 ? 16 : now - lastDriftTime;
  lastDriftTime = now;
  const step = dt / 1000;
  for (const s of stars) {
    s.y += s.speed * step;
    if (s.y > h) {
      s.y = -2;
      s.x = Math.random() * w;
    }
  }

  // Throttled re-render to cache canvas
  if (now - lastCacheTime > CACHE_INTERVAL) {
    renderCache(w, h);
    lastCacheTime = now;
  }

  // Draw cached star field
  if (cacheCanvas) {
    ctx.drawImage(cacheCanvas, 0, 0);
  } else {
    // Fallback: render directly
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    for (const s of stars) {
      ctx.globalAlpha = s.baseAlpha;
      ctx.fillStyle = "#fff";
      ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.ceil(s.size), Math.ceil(s.size));
    }
    ctx.globalAlpha = 1;
    return;
  }

  // Overlay twinkle on top of the cached base layer (per-frame, smooth oscillation)
  const t = now;
  for (const s of stars) {
    const twinkle = Math.sin(t * STAR_TWINKLE_SPEED + s.phase);
    if (twinkle > 0.3) {
      ctx.globalAlpha = s.baseAlpha * twinkle * 0.5;
      ctx.fillStyle = "#fff";
      ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.ceil(s.size), Math.ceil(s.size));
    }
  }
  ctx.globalAlpha = 1;
}
