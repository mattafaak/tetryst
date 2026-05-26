/**
 * Visual effects for screen flash and line-clear particles.
 * Module-level state — purely visual, no game logic coupling.
 */

import { BOARD_WIDTH, VISIBLE_HEIGHT, BUFFER_HEIGHT } from "../core/constants.ts";

// ── Screen flash ─────────────────────────────────────────────────────────

interface Flash {
  color: string;
  timer: number;
  duration: number;
}

let flash: Flash | null = null;

/** Trigger a brief full-screen color tint. */
export function triggerFlash(color: string, duration = 180): void {
  flash = { color, timer: 0, duration };
}

// ── Line-clear particles ─────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

let particles: Particle[] = [];

/** Spawn particles from cleared board rows. */
export function spawnClearParticles(
  rows: number[],
  boardX: number,
  boardY: number,
  cellSize: number,
): void {
  const colors = ["#00e5ff", "#ff5252", "#ffb300", "#69f0ae", "#b388ff", "#ff80ab"];
  for (const boardRow of rows) {
    const vr = boardRow - BUFFER_HEIGHT;
    if (vr < 0 || vr >= VISIBLE_HEIGHT) continue;
    const cy = boardY + vr * cellSize + cellSize / 2;
    for (let c = 0; c < BOARD_WIDTH; c++) {
      const cx = boardX + c * cellSize + cellSize / 2;
      for (let n = 0; n < 2; n++) {
        particles.push({
          x: cx,
          y: cy,
          vx: (Math.random() - 0.5) * 120,
          vy: (Math.random() - 0.5) * 120 - 40,
          life: 0,
          maxLife: 350 + Math.random() * 200,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 1.5 + Math.random() * 2.5,
        });
      }
    }
  }
}

// ── Render ───────────────────────────────────────────────────────────────

let lastEffectsTime = 0;

export function renderEffects(ctx: CanvasRenderingContext2D, _dpr: number, canvasW: number, canvasH: number): void {
  const now = performance.now();
  const dt = lastEffectsTime === 0 ? 16 : now - lastEffectsTime;
  lastEffectsTime = now;

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * (dt / 1000);
    p.y += p.vy * (dt / 1000);
    p.vy += 200 * (dt / 1000); // gravity
    p.life += dt;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    const alpha = 1 - p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Screen flash
  if (!flash) return;
  flash.timer += dt;
  const progress = flash.timer / flash.duration;
  if (progress >= 1) {
    flash = null;
    return;
  }
  ctx.save();
  ctx.fillStyle = flash.color;
  ctx.globalAlpha = (1 - progress) * 0.12;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();
}

/** Clear all effects (e.g., on game restart). */
export function clearEffects(): void {
  particles = [];
  flash = null;
  lastEffectsTime = 0;
  lastParticleRowKey = "";
}

/** Module-level particle row-key tracking to prevent duplicate spawning per frame.
 *  Reset on clearEffects so the key doesn't leak across game sessions. */
let lastParticleRowKey = "";

/** Set the last-spawned particle row key. canvas.ts calls this after spawning. */
export function setParticleRowKey(key: string): void {
  lastParticleRowKey = key;
}

/** Read the last row key (used by canvas.ts to avoid duplicate spawning). */
export function getParticleRowKey(): string {
  return lastParticleRowKey;
}
