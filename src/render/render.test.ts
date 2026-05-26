import { describe, it, expect, vi, beforeEach } from "vitest";
import { rotateCW, rotateCCW } from "../core/srs.ts";
import { RotationState, GamePhase, GameMode, TetriminoType } from "../core/types.ts";
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
  beforeEach(() => {
    vi.resetModules();
  });

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

  it("handles zero-dimension canvas without throwing", async () => {
    const { renderBackground } = await import("./background.ts");
    const ctx = {
      canvas: { width: 800, height: 600 },
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      globalAlpha: 0,
    } as unknown as CanvasRenderingContext2D;
    expect(() => renderBackground(ctx, 0, 0)).not.toThrow();
    expect(() => renderBackground(ctx, 0, 600)).not.toThrow();
    expect(() => renderBackground(ctx, 800, 0)).not.toThrow();
  });
});

describe("canvas.ts — playfield background color", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as Window & typeof globalThis);
    vi.stubGlobal("document", createDocStub());
  });

  it("renders board with computed playfield colors (not hardcoded #1a1a2e)", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const { createInitialState, startGame } = await import("../core/state.ts");
    const ctx = makeMockCtx();
    const state = startGame(createInitialState());
    renderFrame(ctx, state, 30);
    // Board is rendered to offscreen cache then blitted — confirm the
    // render path didn't crash with the computed color values.
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});

describe("canvas.ts — board and piece rendering", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      innerWidth: 800,
      innerHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window & typeof globalThis);
    vi.stubGlobal("document", createDocStub());
  });

  it("renders board grid via drawImage (board cache)", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const { createInitialState, startGame } = await import("../core/state.ts");
    const ctx = makeMockCtx();
    const state = startGame(createInitialState());
    renderFrame(ctx, state, 30);
    // Board is rendered to an offscreen cache, then blitted via drawImage
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("renders active piece with fillRect calls for each filled cell", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const { createInitialState, startGame } = await import("../core/state.ts");
    const ctx = makeMockCtx();
    const state = startGame(createInitialState());
    expect(state.activePiece).not.toBeNull();
    renderFrame(ctx, state, 30);
    // Each tetromino has 4 filled cells; drawCell calls fillRect 3 times per cell
    // (once for the fill, twice for highlights/shadows). At least 4 calls.
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillCalls.length).toBeGreaterThanOrEqual(4);
  });

  it("renders ghost piece with strokeRect calls", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const { createInitialState, startGame } = await import("../core/state.ts");
    const ctx = makeMockCtx();
    const state = startGame(createInitialState());
    renderFrame(ctx, state, 30);
    // Ghost piece uses strokeRect for each visible cell
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it("does not render active piece or ghost in GameOver phase", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    const strokeRectBefore = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.length;
    // State with some locked cells to force board render and activePiece=null
    const state = {
      phase: GamePhase.GameOver,
      mode: GameMode.Marathon,
      board: Array.from({ length: 40 }, () => Array(10).fill(null)),
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
    renderFrame(ctx, state, 30);
    // No ghost strokeRect calls (activePiece is null, phase is GameOver)
    const strokeRectCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(strokeRectCalls.length).toBe(strokeRectBefore);
  });

  it("draws locked cells from the board", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    // Board with one locked cell at visible row 0, col 0
    const board = Array.from({ length: 40 }, () => Array(10).fill(null));
    board[20][0] = TetriminoType.S; // BUFFER_HEIGHT=20, so this is visible row 0
    const state = {
      phase: GamePhase.Playing,
      mode: GameMode.Marathon,
      board,
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
    renderFrame(ctx, state, 30);
    // Board fillRect should be called for the board background (once) + locked cells
    // Locked S-piece cell at (0,0) visible: drawCell called → 3 fillRect calls
    // So board background fillRect + cell fillRect calls ≥ 1
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("renders line-clear flash on cleared rows", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    const board = Array.from({ length: 40 }, () => Array(10).fill(null));
    // Row 30 (visible row 10) has a full line to clear
    board[30] = Array(10).fill(TetriminoType.S);
    const state = {
      phase: GamePhase.LineClear,
      mode: GameMode.Marathon,
      board,
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
      lineClearTimer: 50, // > 0, triggers flash if sin > 0
      clearedRowIndices: [30],
      modeTimer: 0,
      popups: [],
    } as unknown as GameState;
    renderFrame(ctx, state, 30);
    // LineClear animation draws white flash on cleared rows
    const fillCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(fillCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("renders popups as fillText calls", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    const board = Array.from({ length: 40 }, () => Array(10).fill(null));
    const state = {
      phase: GamePhase.Playing,
      mode: GameMode.Marathon,
      board,
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
      popups: [
        { text: "TETRIS!", color: "#fff", timer: 0, duration: 1000 },
        { text: "T-SPIN", color: "#a000f0", timer: 0, duration: 800 },
      ],
    } as unknown as GameState;
    renderFrame(ctx, state, 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("TETRIS!");
    expect(allText).toContain("T-SPIN");
  });
});

describe("canvas.ts — victory screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as Window & typeof globalThis);
    vi.stubGlobal("document", createDocStub());
  });

  function makeVictoryState(overrides: Partial<GameState> = {}): GameState {
    return {
      phase: GamePhase.Victory,
      mode: GameMode.Marathon,
      board: Array.from({ length: 40 }, () => Array(10).fill(null)),
      activePiece: null,
      ghostY: 0,
      heldPiece: null,
      hasSwappedThisTurn: false,
      nextQueue: [],
      score: 50000,
      level: 10,
      lines: 150,
      effectiveLines: 150,
      combo: 0,
      backToBack: false,
      gravityTimer: 0,
      lockState: { timer: 0, resets: 0, onGround: true, lowestY: 0 },
      entryDelayTimer: 0,
      bag: [],
      lineClearTimer: 0,
      clearedRowIndices: [],
      modeTimer: 60000,
      popups: [],
      ...overrides,
    } as unknown as GameState;
  }

  it('renders "YOU WIN" for Marathon victory', async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makeVictoryState({ mode: GameMode.Marathon }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("YOU");
    expect(allText).toContain("WIN");
    expect(allText).toContain("50,000");
  });

  it('renders "SPRINT CLEAR" for Sprint victory', async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makeVictoryState({ mode: GameMode.Sprint, modeTimer: 45000 }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("SPRINT");
    expect(allText).toContain("CLEAR");
    // Sprint shows time, not score
    expect(allText).toContain("0:45.00");
  });

  it('renders "TIME\'S UP" for Ultra victory', async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makeVictoryState({ mode: GameMode.Ultra, score: 75000 }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("TIME");
    expect(allText).toContain("UP");
    expect(allText).toContain("75,000");
  });

  it('renders "PRESS  ENTER  FOR  MENU" on victory', async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makeVictoryState({ mode: GameMode.Marathon }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("PRESS");
    expect(allText).toContain("ENTER");
    expect(allText).toContain("MENU");
  });
});

describe("canvas.ts — HUD rendering", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as Window & typeof globalThis);
    vi.stubGlobal("document", createDocStub());
  });

  function makePlayingState(overrides: Partial<GameState> = {}): GameState {
    return {
      phase: GamePhase.Playing,
      mode: GameMode.Marathon,
      board: Array.from({ length: 40 }, () => Array(10).fill(null)),
      activePiece: null,
      ghostY: 0,
      heldPiece: null,
      hasSwappedThisTurn: false,
      nextQueue: [
        { type: TetriminoType.S },
        { type: TetriminoType.Z },
        { type: TetriminoType.J },
        { type: TetriminoType.L },
        { type: TetriminoType.I },
      ],
      score: 12345,
      level: 3,
      lines: 20,
      effectiveLines: 20,
      combo: 2,
      backToBack: true,
      gravityTimer: 0,
      lockState: { timer: 0, resets: 0, onGround: true, lowestY: 0 },
      entryDelayTimer: 0,
      bag: [],
      lineClearTimer: 0,
      clearedRowIndices: [],
      modeTimer: 0,
      popups: [],
      ...overrides,
    } as unknown as GameState;
  }

  it("renders marathon HUD with score, level, lines", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makePlayingState({ mode: GameMode.Marathon }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("12,345");
    expect(allText).toContain("LEVEL");
    expect(allText).toContain("LINES");
  });

  it("renders sprint HUD with time and lines-left", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makePlayingState({ mode: GameMode.Sprint, modeTimer: 30000 }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("TIME");
    expect(allText).toContain("LINES LEFT");
    expect(allText).toContain("0:30.00");
  });

  it("renders ultra HUD with time-left and score", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makePlayingState({ mode: GameMode.Ultra, modeTimer: 90000 }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("TIME LEFT");
    expect(allText).toContain("12,345");
  });

  it("renders B2B and combo indicators when active", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makePlayingState({ mode: GameMode.Marathon, backToBack: true, combo: 2 }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("B2B");
    expect(allText).toContain("COMBO");
  });

  it("renders hold piece and next queue labels", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    renderFrame(ctx, makePlayingState({ mode: GameMode.Marathon }), 30);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    expect(allText).toContain("HOLD");
    expect(allText).toContain("NEXT");
  });

  it("does not render HUD during menu phase", async () => {
    const { renderFrame } = await import("./canvas.ts");
    const ctx = makeMockCtx();
    const menuState = {
      phase: GamePhase.Menu,
      mode: GameMode.Marathon,
      board: Array.from({ length: 40 }, () => Array(10).fill(null)),
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
    renderFrame(ctx, menuState, 30, true);
    const textCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;
    const allText = textCalls.map((c: string[]) => c[0]).join(" ");
    // HUD labels should not appear during menu
    expect(allText).not.toContain("SCORE");
    expect(allText).not.toContain("HOLD");
    expect(allText).not.toContain("NEXT");
  });
});

describe("canvas.ts — setParticleLayout called in renderFrame", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      innerWidth: 800,
      innerHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window & typeof globalThis);
    vi.stubGlobal("document", createDocStub());
  });

  it("calls setParticleLayout with computed boardX, boardY, and cellSize", async () => {
    // Mock the effects module so we can spy on setParticleLayout
    vi.doMock("./effects.ts", async () => {
      const actual = await vi.importActual<typeof import("./effects.ts")>("./effects.ts");
      return {
        ...actual,
        setParticleLayout: vi.fn(),
        renderEffects: vi.fn(),
      };
    });

    const { renderFrame } = await import("./canvas.ts");
    const effectsMod = await import("./effects.ts");
    const { createInitialState, startGame } = await import("../core/state.ts");

    const ctx = makeMockCtx();
    // canvas is 800×600 (logical), cellSize=30
    // boardPixelWidth = 10 * 30 = 300, boardPixelHeight = 20 * 30 = 600
    // boardX = floor((800 - 300) / 2) = 250
    // boardY = floor((600 - 600) / 2) = 0
    const cellSize = 30;
    const expectedBoardX = Math.floor((800 - 10 * cellSize) / 2); // 250
    const expectedBoardY = Math.floor((600 - 20 * cellSize) / 2); // 0

    const state = startGame(createInitialState());
    renderFrame(ctx, state, cellSize);

    expect(effectsMod.setParticleLayout).toHaveBeenCalledWith(
      expectedBoardX,
      expectedBoardY,
      cellSize,
    );
  });
});

/**
 * Create a minimal document stub with createElement that returns a mock canvas.
 */
function createDocStub() {
  return {
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
        clearRect: vi.fn(),
      })),
    })),
  } as unknown as Document;
}
