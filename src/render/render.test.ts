import { describe, it, expect, vi, beforeEach } from "vitest";
import { rotateCW, rotateCCW } from "../core/srs.ts";
import { RotationState } from "../core/types.ts";

describe("srs.ts — rotateCW", () => {
  it("ZERO → R", () => expect(rotateCW(RotationState.ZERO)).toBe(RotationState.R));
  it("R → TWO", () => expect(rotateCW(RotationState.R)).toBe(RotationState.TWO));
  it("TWO → L", () => expect(rotateCW(RotationState.TWO)).toBe(RotationState.L));
  it("L → ZERO", () => expect(rotateCW(RotationState.L)).toBe(RotationState.ZERO));
});

describe("srs.ts — rotateCCW", () => {
  it("ZERO → L", () => expect(rotateCCW(RotationState.ZERO)).toBe(RotationState.L));
  it("L → TWO", () => expect(rotateCCW(RotationState.L)).toBe(RotationState.TWO));
  it("TWO → R", () => expect(rotateCCW(RotationState.TWO)).toBe(RotationState.R));
  it("R → ZERO", () => expect(rotateCCW(RotationState.R)).toBe(RotationState.ZERO));
});

describe("canvas.ts — renderFrame", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      innerWidth: 800,
      innerHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window & typeof globalThis);
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          save: vi.fn(),
          restore: vi.fn(),
          scale: vi.fn(),
          translate: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 0,
        })),
      })),
    } as unknown as Document);
  });

  it("renders without throwing with a mock context", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const { createInitialState } = await import("../core/state.ts");
    const ctx = {
      canvas: { width: 800, height: 600 },
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      fillStyle: "",
      fillRect: vi.fn(),
      strokeStyle: "",
      lineWidth: 0,
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      font: "",
      textAlign: "",
      textBaseline: "",
      globalAlpha: 0,
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const state = createInitialState();
    expect(() => renderFrame(ctx, state, 30)).not.toThrow();
  });
});

describe("effects.ts", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("triggerFlash does not throw", async () => {
    const { triggerFlash } = await import("./effects.ts");
    expect(() => triggerFlash("#fff", 100)).not.toThrow();
    expect(() => triggerFlash("#ffb300", 200)).not.toThrow();
    expect(() => triggerFlash("#ffffff", 160)).not.toThrow();
  });

  it("spawnClearParticles does not throw", async () => {
    const { spawnClearParticles } = await import("./effects.ts");
    expect(() => spawnClearParticles([0, 1, 2], 100, 100, 30)).not.toThrow();
    expect(() => spawnClearParticles([], 0, 0, 10)).not.toThrow();
  });

  it("clearEffects resets module state (does not throw)", async () => {
    const mod = await import("./effects.ts");
    expect(() => mod.clearEffects()).not.toThrow();
    // Call twice to verify idempotency
    expect(() => mod.clearEffects()).not.toThrow();
  });
});

describe("background.ts — renderBackground", () => {
  it("renders without throwing", async () => {
    const { renderBackground } = await import("./background.ts");
    const ctx = {
      canvas: { width: 800, height: 600 },
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: "",
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    expect(() => renderBackground(ctx, 800, 600)).not.toThrow();
    expect(() => renderBackground(ctx, 400, 300)).not.toThrow();
  });
});
