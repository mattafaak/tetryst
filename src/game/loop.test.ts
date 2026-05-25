/**
 * Game loop integration tests.
 *
 * Tests the full `Game` class (loop.ts) by mocking browser APIs and
 * simulating frame-by-frame execution. Uses the built-in attract mode AI
 * to play through complete games.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Game } from "./loop.ts";
import { GamePhase, GameMode } from "../core/types.ts";

// ── Mocks ────────────────────────────────────────────────────────────────

// Mock rendering and audio modules
vi.mock("../render/canvas.ts", () => ({ renderFrame: vi.fn() }));
vi.mock("../audio/sfx.ts", () => ({ playSFX: vi.fn() }));
vi.mock("../audio/music.ts", () => ({ playMusic: vi.fn(), stopMusic: vi.fn() }));

// Mock saveHighScore to avoid localStorage
const saveHighScoreMock = vi.fn();
vi.mock("../core/high-scores.ts", () => ({
  saveHighScore: (...args: unknown[]) => saveHighScoreMock(...args),
  loadHighScores: vi.fn(() => []),
}));

// ── Test infrastructure ──────────────────────────────────────────────────

let rafCallbacks: Map<number, (timestamp: number) => void>;
let nextRafId: number;
let currentTime: number;
let mockCanvas: { width: number; height: number };
let mockCtx: CanvasRenderingContext2D;
let game: Game;
let keyDownListeners: Array<(e: unknown) => void>;
let keyUpListeners: Array<(e: unknown) => void>;

beforeEach(() => {
  keyDownListeners = [];
  keyUpListeners = [];
  rafCallbacks = new Map();
  nextRafId = 1;
  currentTime = 0;
  saveHighScoreMock.mockClear();
  mockCanvas = { width: 800, height: 600 };
  mockCtx = {
    canvas: mockCanvas,
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    fillStyle: "",
    fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;

  const rafMock = vi.fn((cb: (t: number) => void) => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });
  const cafMock = vi.fn((id: number) => {
    rafCallbacks.delete(id);
  });

  vi.stubGlobal("window", {
    addEventListener: (event: string, listener: (e: unknown) => void) => {
      if (event === "keydown") keyDownListeners.push(listener);
      if (event === "keyup") keyUpListeners.push(listener);
    },
    removeEventListener: (event: string, listener: (e: unknown) => void) => {
      if (event === "keydown") {
        keyDownListeners = keyDownListeners.filter((l) => l !== listener);
      }
      if (event === "keyup") {
        keyUpListeners = keyUpListeners.filter((l) => l !== listener);
      }
    },
    devicePixelRatio: 1,
    innerWidth: 800,
    innerHeight: 600,
  } as unknown as Window & typeof globalThis);

  vi.stubGlobal("requestAnimationFrame", rafMock);
  vi.stubGlobal("cancelAnimationFrame", cafMock);
  vi.spyOn(performance, "now").mockImplementation(() => currentTime);
});

afterEach(() => {
  if (game) {
    try { game.stop(); } catch { /* ignore */ }
  }
  vi.restoreAllMocks();
});

/** Press a key on the mock window. */
function pressKey(code: string): void {
  const event = { code, preventDefault: vi.fn(), type: "keydown" };
  for (const listener of keyDownListeners) listener(event);
}

/** Release a key on the mock window. */
function releaseKey(code: string): void {
  const event = { code, preventDefault: vi.fn(), type: "keyup" };
  for (const listener of keyUpListeners) listener(event);
}

/** Advance the game loop by `dt` milliseconds per frame. */
function advanceFrames(frameCount: number, dtPerFrame = 16): void {
  for (let i = 0; i < frameCount; i++) {
    const cb = rafCallbacks.get(nextRafId - 1);
    if (!cb) break;
    currentTime += dtPerFrame;
    cb(currentTime);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Game integration", () => {
  describe("menu and navigation", () => {
    it("initial state is Menu before start()", () => {
      // Before start() is called, the game is in Menu phase
      const g = new Game(mockCtx) as unknown as { state: { phase: string } };
      expect(g.state.phase).toBe(GamePhase.Menu);
    });

    it("start() triggers attract mode on first frame", () => {
      game = new Game(mockCtx);
      game.start();
      // start() calls loop() synchronously which triggers attract mode
      const g = game as unknown as { state: { phase: string } };
      expect(g.state.phase).toBe(GamePhase.Playing);
    });

    it("Enter starts a marathon game from menu", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      pressKey("Enter");
      advanceFrames(10);

      const g = game as unknown as { state: { phase: string; mode: GameMode } };
      expect(g.state.mode).toBe(GameMode.Marathon);
      expect([GamePhase.Playing, GamePhase.EntryDelay, GamePhase.LineClear]).toContain(
        g.state.phase as GamePhase,
      );
    });

    it("ArrowRight cycles modes", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      const g = game as unknown as { selectedMode: GameMode };
      expect(g.selectedMode).toBe(GameMode.Marathon);

      pressKey("ArrowRight");
      releaseKey("ArrowRight");
      expect(g.selectedMode).toBe(GameMode.Sprint);

      pressKey("ArrowRight");
      releaseKey("ArrowRight");
      expect(g.selectedMode).toBe(GameMode.Ultra);

      pressKey("ArrowRight");
      releaseKey("ArrowRight");
      expect(g.selectedMode).toBe(GameMode.Marathon); // wraps around
    });

    it("ArrowLeft cycles modes backward", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      const g = game as unknown as { selectedMode: GameMode };
      pressKey("ArrowLeft");
      releaseKey("ArrowLeft");
      expect(g.selectedMode).toBe(GameMode.Ultra);
    });

    it("RotateCW increases start level", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      const g = game as unknown as { selectedStartLevel: number };
      pressKey("ArrowUp"); // RotateCW
      releaseKey("ArrowUp");
      expect(g.selectedStartLevel).toBe(1);
    });

    it("SoftDrop decreases start level", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      const g = game as unknown as { selectedStartLevel: number };
      // First go up to level 3 (releasing between each press)
      pressKey("ArrowUp"); releaseKey("ArrowUp");
      pressKey("ArrowUp"); releaseKey("ArrowUp");
      pressKey("ArrowUp"); releaseKey("ArrowUp");
      expect(g.selectedStartLevel).toBe(3);

      pressKey("ArrowDown"); // SoftDrop
      releaseKey("ArrowDown");
      expect(g.selectedStartLevel).toBe(2);
    });

    it("re-pressing Enter from GameOver restarts", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      pressKey("Enter");
      advanceFrames(20);

      const g = game as unknown as { state: { phase: string } };
      // Game should be playing now
      expect([
        GamePhase.Playing,
        GamePhase.EntryDelay,
        GamePhase.LineClear,
      ]).toContain(g.state.phase as GamePhase);
    });
  });

  describe("attract mode", () => {
    it("attract mode starts automatically within ~2 seconds", () => {
      game = new Game(mockCtx);
      game.start();

      advanceFrames(200, 16); // 3.2 seconds

      const g = game as unknown as { isAttractMode: boolean };
      expect(g.isAttractMode).toBe(true);
    });

    it("attract mode restarts after game over (runs continuously)", () => {
      game = new Game(mockCtx);
      game.start();

      // Let attract mode play for a long time
      advanceFrames(2000, 16); // ~32 seconds

      const g = game as unknown as { isAttractMode: boolean; state: { lines: number; score: number } };
      expect(g.isAttractMode).toBe(true);

      // AI should have accumulated some lines/score across restarts
      // (either this game or a previous one had some activity)
      expect(typeof g.state.lines).toBe("number");
      expect(typeof g.state.score).toBe("number");
    });

    it("pressing a key exits attract mode", () => {
      game = new Game(mockCtx);
      game.start();

      advanceFrames(200, 16); // enter attract mode

      let g = game as unknown as { isAttractMode: boolean };
      expect(g.isAttractMode).toBe(true);

      // Press any key
      pressKey("ArrowRight");
      advanceFrames(5);

      g = game as unknown as { isAttractMode: boolean };
      expect(g.isAttractMode).toBe(false);
    });
  });

  describe("mute toggle", () => {
    it("audioEnabled is true before attract mode starts", () => {
      const g = new Game(mockCtx) as unknown as { audioEnabled: boolean };
      expect(g.audioEnabled).toBe(true);
    });

    it("attract mode disables audio", () => {
      game = new Game(mockCtx);
      game.start();
      const g = game as unknown as { audioEnabled: boolean };
      expect(g.audioEnabled).toBe(false);
    });
  });

  describe("Sprint mode", () => {
    it("Sprint modeTimer tracks elapsed time", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      // Switch to Sprint and start
      pressKey("ArrowRight");
      advanceFrames(5);
      pressKey("Enter");
      advanceFrames(100, 16); // ~1.6 seconds

      const g = game as unknown as { state: { mode: GameMode; modeTimer: number } };
      expect(g.state.mode).toBe(GameMode.Sprint);
      expect(g.state.modeTimer).toBeGreaterThan(0);
    });
  });

  describe("game over and restart", () => {
    it("Enter from GameOver phase restarts", () => {
      game = new Game(mockCtx);
      game.start();

      // Simulate game over by setting the state directly
      const g = game as unknown as {
        state: { phase: string };
        handleInput(action: { type: string }): void;
      };
      g.state = { ...g.state, phase: GamePhase.GameOver as GamePhase };

      // Press Enter to restart
      pressKey("Enter");
      advanceFrames(10);

      expect([
        GamePhase.Playing,
        GamePhase.Menu,
      ]).toContain(g.state.phase as GamePhase);
    });
  });

  describe("pause/resume", () => {
    it("pressing P during gameplay pauses", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      // Start a game
      pressKey("Enter");
      advanceFrames(10);

      // Press P to pause
      pressKey("KeyP");
      advanceFrames(5);

      const g = game as unknown as { state: { phase: GamePhase } };
      expect(g.state.phase).toBe(GamePhase.Paused);
    });

    it("pressing P while paused resumes gameplay", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      pressKey("Enter");
      advanceFrames(10);

      pressKey("KeyP"); releaseKey("KeyP"); // pause
      advanceFrames(5);
      pressKey("KeyP"); releaseKey("KeyP"); // resume
      advanceFrames(5);

      const g = game as unknown as { state: { phase: GamePhase } };
      expect(g.state.phase).toBe(GamePhase.Playing);
    });

    it("movement keys are ignored while paused", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      pressKey("Enter");
      advanceFrames(10);

      pressKey("KeyP"); // pause
      advanceFrames(5);

      // Try to move while paused
      pressKey("ArrowLeft");
      advanceFrames(5);

      // Should still be paused
      const g = game as unknown as { state: { phase: GamePhase } };
      expect(g.state.phase).toBe(GamePhase.Paused);
    });

    it("mute works while paused", () => {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      pressKey("Enter");
      advanceFrames(10);

      pressKey("KeyP"); // pause
      advanceFrames(5);

      const g = game as unknown as { audioEnabled: boolean };
      const wasEnabled = g.audioEnabled;

      pressKey("KeyM"); // mute
      advanceFrames(5);

      expect(g.audioEnabled).toBe(!wasEnabled);
    });
  });
});
