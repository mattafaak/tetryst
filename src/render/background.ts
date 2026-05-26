/**
 * Subtle animated star-field background.
 * Renders small drifting dots behind the game board for visual atmosphere.
 * Uses a fixed-time-step approximation (~60fps equivalent drift) so the
 * visual speed stays consistent regardless of actual frame rate.
 */

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

function ensureStars(w: number, h: number): void {
  if (initialized) return;
  initialized = true;
  stars = Array.from({ length: 65 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 0.4 + Math.random() * 1.6,
    speed: 8 + Math.random() * 16,
    phase: Math.random() * Math.PI * 2,
    baseAlpha: 0.2 + Math.random() * 0.35,
  }));
}

/** Reset on resize so stars re-initialize at the new canvas dimensions. */
let lastW = 0;
let lastH = 0;

export function renderBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  // Re-init on resize
  if (w !== lastW || h !== lastH) {
    initialized = false;
    lastW = w;
    lastH = h;
  }
  ensureStars(w, h);

  // Dark background
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);

  // Stars drift downward at ~60fps-equivalent speed
  const step = 1 / 60;
  const t = performance.now();
  for (const s of stars) {
    s.y += s.speed * step;
    if (s.y > h) {
      s.y = -2;
      s.x = Math.random() * w;
    }

    const twinkle = 0.55 + 0.45 * Math.sin(t * 0.002 + s.phase);
    ctx.globalAlpha = s.baseAlpha * twinkle;
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.ceil(s.size), Math.ceil(s.size));
  }
  ctx.globalAlpha = 1;
}
