import { describe, it, expect, vi, beforeEach } from "vitest";
import { rotateCW, rotateCCW } from "../core/srs.ts";
import { RotationState, GamePhase, GameMode } from "../core/types.ts";
import type { GameState } from "../core/types.ts";

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
          fillText: vi.fn(),
          drawImage: vi.fn(),
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 0,
          font: "",
          textAlign: "",
          textBaseline: "",
          globalAlpha: 0,
        })),
      })),
    } as unknown as Document);
  });

  it("renders without throwing with a mock context", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const { createInitialState } = await import("../core/state.ts");
    const ctx = makeMockCtx();
    const state = createInitialState();
    expect(() => renderFrame(ctx, state, 30)).not.toThrow();
  });

  it("renders menu overlay without throwing", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const { createInitialState } = await import("../core/state.ts");
    const ctx = makeMockCtx();
    const state = createInitialState();
    expect(() => renderFrame(ctx, state, 30, true, GameMode.Marathon)).not.toThrow();
    // Menu overlay content is rendered to a cache canvas; verify drawImage was called
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("renders game over overlay with score text", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();

    const state = {
      phase: GamePhase.GameOver,
      mode: GameMode.Marathon,
      board: Array.from({ length: 20 }, () => Array(10).fill(null)),
      activePiece: null,
      ghostY: 0,
      heldPiece: null,
      hasSwappedThisTurn: false,
      nextQueue: [],
      score: 99999,
      level: 5,
      lines: 42,
      effectiveLines: 999,
      combo: 0,
      backToBack: false,
      gravityTimer: 0,
      lockState: { timer: 0, resets: 0, onGround: true, lowestY: 0 },
      entryDelayTimer: 0,
      bag: [],
      lineClearTimer: 0,
      clearedRowIndices: [],
      modeTimer: 0,
      popups: [],
    } as unknown as GameState;

    expect(() => renderFrame(ctx, state, 30)).not.toThrow();
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = calls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("GAME");
    expect(allText).toContain("OVER");
    expect(allText).toContain("99,999");
  });

  it("renders pause overlay with fillText calls", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    const state = {
      phase: GamePhase.Paused,
      mode: GameMode.Marathon,
      board: Array.from({ length: 20 }, () => Array(10).fill(null)),
      activePiece: null,
      ghostY: 0,
      heldPiece: null,
      hasSwappedThisTurn: false,
      nextQueue: [],
      score: 0,
      level: 0,
      lines: 0,
      effectiveLines: 0,
      combo: 0,
      backToBack: false,
      gravityTimer: 0,
      lockState: { timer: 0, resets: 0, onGround: true, lowestY: 0 },
      entryDelayTimer: 0,
      bag: [],
      lineClearTimer: 0,
      clearedRowIndices: [],
      modeTimer: 0,
      popups: [],
    } as unknown as GameState;

    expect(() => renderFrame(ctx, state, 30, false, GameMode.Marathon)).not.toThrow();
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = calls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("PAUSED");
  });
});

function makeMockCtx(): CanvasRenderingContext2D {
  return {
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
}

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
      drawImage: vi.fn(),
      globalAlpha: 0,
    } as unknown as CanvasRenderingContext2D;
    expect(() => renderBackground(ctx, 800, 600)).not.toThrow();
    expect(() => renderBackground(ctx, 400, 300)).not.toThrow();
  });
});
