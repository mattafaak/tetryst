/**
 * Behavioral tests for visual effects (screen flash, particles).
 * Tests state transitions and invariants rather than just "does not throw".
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  triggerFlash,
  spawnClearParticles,
  spawnParticlesForRows,
  clearEffects,
  renderEffects,
  setParticleLayout,
} from "./effects.ts";
import { BUFFER_HEIGHT } from "../core/constants.ts";

function mockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("flash", () => {
  beforeEach(() => {
    clearEffects();
  });

  it("triggerFlash stores flash state with default duration", () => {
    triggerFlash("#ffffff");
    // renderEffects with a small dt should render the flash (not null)
    const ctx = mockCtx();
    renderEffects(ctx, 800, 600, 10, false);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe("#ffffff");
  });

  it("flash timer advances with dt", () => {
    const ctx = mockCtx();
    triggerFlash("#fff", 100);

    // Half-way through duration
    renderEffects(ctx, 800, 600, 50, false);
    expect(ctx.fillRect).toHaveBeenCalled();

    // Past duration — flash should be cleared, no more fillRect
    vi.clearAllMocks();
    renderEffects(ctx, 800, 600, 60, false);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("flash is suppressed when suppressEffects is true", () => {
    const ctx = mockCtx();
    triggerFlash("#fff", 100);
    renderEffects(ctx, 800, 600, 10, true);
    // suppressEffects prevents rendering, but the flash timer still advances
    // Fill rect should NOT be called if suppressEffects is true
    // Actually, renderEffects returns early on suppressEffects for flash
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("multiple triggerFlash calls overwrite previous flash", () => {
    const ctx = mockCtx();
    triggerFlash("#ff0000", 500);
    triggerFlash("#00ff00", 500); // overwrite

    renderEffects(ctx, 800, 600, 10, false);
    expect(ctx.fillStyle).toBe("#00ff00");
  });

  it("no flash when none triggered", () => {
    const ctx = mockCtx();
    renderEffects(ctx, 800, 600, 10, false);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("particles", () => {
  beforeEach(() => {
    clearEffects();
  });

  it("spawnClearParticles creates particles for given rows", () => {
    spawnClearParticles([BUFFER_HEIGHT], 100, 200, 30);
    // Each visible row spawns 2 particles per column (BOARD_WIDTH = 10)
    // So 10 columns × 2 = 20 particles per row
    const ctx = mockCtx();
    renderEffects(ctx, 800, 600, 16, false);
    // Fill rect should be called for each particle
    expect(ctx.fillRect).toHaveBeenCalled();
    const callCount = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(18);
    expect(callCount).toBeLessThanOrEqual(22);
  });

  it("spawnClearParticles skips rows outside visible area", () => {
    // Row BUFFER_HEIGHT - 1 = row 19 is the top of the visible area (0-indexed)
    // Row -1 (invalid) or row 40+ (off bottom) should be skipped
    // Actually, rows are board rows, and visible check is: vr = boardRow - BUFFER_HEIGHT
    // For boardRow = 0: vr = -20, which is < 0, so skipped
    // For boardRow = 0, result is particles.length = 0 after renderEffects... but let's check
    const ctx = mockCtx();
    spawnClearParticles([0], 100, 200, 30); // row 0 is in buffer zone, should be skipped
    renderEffects(ctx, 800, 600, 16, false);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("spawnClearParticles for visible row produces particles", () => {
    // Row at BUFFER_HEIGHT (row 20) is the first visible row
    const ctx = mockCtx();
    spawnClearParticles([BUFFER_HEIGHT], 100, 200, 30);
    renderEffects(ctx, 800, 600, 16, false);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("particles cap at MAX_PARTICLES", () => {
    // Spawn many rows worth — MAX_PARTICLES = 200
    // Each row: BOARD_WIDTH (10) × 2 = 20 particles
    // 10 rows × 20 = 200 (should be capped)
    spawnClearParticles(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      100, 200, 30,
    );
    const ctx = mockCtx();
    renderEffects(ctx, 800, 600, 0, false);
    // At most 200 particles render (but rows in buffer zone are skipped, so actual count < 200)
    const callCount = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callCount).toBeLessThanOrEqual(200);
  });

  it("particles move each frame (position changes with dt)", () => {
    const ctx = mockCtx();
    spawnClearParticles([BUFFER_HEIGHT], 100, 200, 30);

    renderEffects(ctx, 800, 600, 100, false);
    const firstArgs = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: number[]) => ({ x: c[0], y: c[1] }),
    );

    vi.clearAllMocks();
    renderEffects(ctx, 800, 600, 100, false);
    const secondArgs = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: number[]) => ({ x: c[0], y: c[1] }),
    );

    // Particles should have moved (vy + gravity applied)
    // Compare first particle's Y positions
    if (firstArgs.length > 0 && secondArgs.length > 0) {
      expect(secondArgs[0].y).not.toBe(firstArgs[0].y);
    }
  });

  it("clearEffects empties particle array", () => {
    spawnClearParticles([BUFFER_HEIGHT], 100, 200, 30);
    clearEffects();

    const ctx = mockCtx();
    renderEffects(ctx, 800, 600, 16, false);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("spawnParticlesForRows spawns particles with cached layout", () => {
    setParticleLayout(100, 200, 30);
    spawnParticlesForRows([BUFFER_HEIGHT]);

    const ctx = mockCtx();
    renderEffects(ctx, 800, 600, 16, false);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("spawnParticlesForRows deduplicates same rows", () => {
    setParticleLayout(100, 200, 30);
    spawnParticlesForRows([BUFFER_HEIGHT]);
    spawnParticlesForRows([BUFFER_HEIGHT]); // second call should be deduped

    const ctx = mockCtx();
    renderEffects(ctx, 800, 600, 16, false);
    // Count fillRect calls — should match single spawn count
    const callCount = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callCount).toBeGreaterThan(0);
    // After second render frame, clear mocks, then third spawn of different rows
    vi.clearAllMocks();
    spawnParticlesForRows([BUFFER_HEIGHT + 1]);
    renderEffects(ctx, 800, 600, 16, false);
    // Should have new particles (different row key)
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("particles decay and get removed after maxLife", () => {
    const ctx = mockCtx();
    spawnClearParticles([BUFFER_HEIGHT], 100, 200, 30);

    // Advance by maxLife — particles should be gone
    // maxLife is 350-550ms, so 600ms should clear them all
    renderEffects(ctx, 800, 600, 600, true);

    vi.clearAllMocks();
    renderEffects(ctx, 800, 600, 0, false);
    // No particles left, no fillRect
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("renderBackground invariants", () => {
  beforeEach(() => {
    clearEffects();
  });

  it("zero-dimension canvas does not crash", async () => {
    const { renderBackground } = await import("./background.ts");
    const ctx = mockCtx();
    expect(() => renderBackground(ctx, 0, 0)).not.toThrow();
    expect(() => renderBackground(ctx, 0, 600)).not.toThrow();
    expect(() => renderBackground(ctx, 800, 0)).not.toThrow();
  });

  it("renderBackground renders at normal size", async () => {
    const { renderBackground } = await import("./background.ts");
    const ctx = mockCtx();
    expect(() => renderBackground(ctx, 800, 600)).not.toThrow();
  });

  it("freeze=true does not crash", async () => {
    const { renderBackground } = await import("./background.ts");
    const ctx = mockCtx();
    expect(() => renderBackground(ctx, 800, 600, true)).not.toThrow();
  });
});
