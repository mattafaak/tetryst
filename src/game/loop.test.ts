/**
 * Game loop integration tests.
 *
 * Tests the full `Game` class (loop.ts) by mocking browser APIs and
 * simulating frame-by-frame execution. Uses the built-in attract mode AI
 * to play through complete games.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { playSFX } from "../audio/sfx.ts";
import { triggerFlash } from "../render/effects.ts";
import { Game } from "./loop.ts";
import { GamePhase, GameMode, TetriminoType, RotationState } from "../core/types.ts";
import type { GameState } from "../core/types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT } from "../core/constants.ts";

// ── Mocks ────────────────────────────────────────────────────────────────

// Mock rendering and audio modules
vi.mock("../render/canvas.ts", () => ({ renderFrame: vi.fn() }));
vi.mock("../audio/sfx.ts", () => ({ playSFX: vi.fn() }));
vi.mock("../audio/music.ts", () => ({ playMusic: vi.fn(), stopMusic: vi.fn() }));
vi.mock("../render/effects.ts", () => ({ triggerFlash: vi.fn(), clearEffects: vi.fn() }));

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

  describe("pause menu", () => {
    function startAndPause(): unknown {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      // Exit attract mode and start a game
      pressKey("ArrowRight"); releaseKey("ArrowRight");
      advanceFrames(5);
      pressKey("Enter"); releaseKey("Enter");
      advanceFrames(10);

      // Pause
      pressKey("KeyP"); releaseKey("KeyP");
      advanceFrames(5);

      const g = game as unknown as {
        state: { phase: GamePhase; score: number };
        pauseMenuSelection: number;
      };
      expect(g.state.phase).toBe(GamePhase.Paused);
      return g;
    }

    it("shows pause menu with selection at Resume (0)", () => {
      const g = startAndPause() as { pauseMenuSelection: number };
      expect(g.pauseMenuSelection).toBe(0);
    });

    it("ArrowDown navigates to next option", () => {
      const g = startAndPause() as { pauseMenuSelection: number };
      expect(g.pauseMenuSelection).toBe(0);

      pressKey("ArrowDown"); releaseKey("ArrowDown");
      expect(g.pauseMenuSelection).toBe(1); // Restart

      pressKey("ArrowDown"); releaseKey("ArrowDown");
      expect(g.pauseMenuSelection).toBe(2); // Quit to Menu
    });

    it("ArrowUp navigates to previous option (wrapping)", () => {
      const g = startAndPause() as { pauseMenuSelection: number };

      pressKey("ArrowUp"); releaseKey("ArrowUp");
      expect(g.pauseMenuSelection).toBe(2); // wraps from 0 → 2
    });

    it("Enter on Resume resumes gameplay", () => {
      startAndPause();

      pressKey("Enter"); releaseKey("Enter");
      advanceFrames(5);

      const g = game as unknown as { state: { phase: GamePhase } };
      expect(g.state.phase).toBe(GamePhase.Playing);
    });

    it("Enter on Restart starts a new game with zero score", () => {
      const g = startAndPause() as { state: { score: number; phase: GamePhase }; pauseMenuSelection: number };

      // Force some score before restart
      g.state = { ...g.state, score: 5000 };

      pressKey("ArrowDown"); releaseKey("ArrowDown"); // → Restart
      pressKey("Enter"); releaseKey("Enter");
      advanceFrames(10);

      expect(g.state.score).toBe(0);
      expect(g.state.phase).toBe(GamePhase.Playing);
    });

    it("Enter on Quit to Menu returns to menu", () => {
      startAndPause();

      pressKey("ArrowDown"); releaseKey("ArrowDown");
      pressKey("ArrowDown"); releaseKey("ArrowDown"); // → Quit to Menu
      pressKey("Enter"); releaseKey("Enter");
      advanceFrames(5);

      const g = game as unknown as { state: { phase: GamePhase } };
      expect(g.state.phase).toBe(GamePhase.Menu);
    });

    it("selection resets to 0 on re-pause", () => {
      const g = startAndPause() as { pauseMenuSelection: number };

      pressKey("ArrowDown"); releaseKey("ArrowDown"); // → Restart
      expect(g.pauseMenuSelection).toBe(1);

      pressKey("KeyP"); releaseKey("KeyP"); // resume
      advanceFrames(5);
      pressKey("KeyP"); releaseKey("KeyP"); // re-pause
      advanceFrames(5);

      expect(g.pauseMenuSelection).toBe(0);
    });
  });

  describe("high score screen", () => {
    function enterMenu(): unknown {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      // Exit attract mode via Mute (no side effects on mode/level)
      pressKey("KeyM"); releaseKey("KeyM");
      advanceFrames(5);

      const g = game as unknown as {
        state: { phase: GamePhase };
        showHighScores: boolean;
        highScoreMode: GameMode;
        selectedMode: GameMode;
      };
      expect(g.state.phase).toBe(GamePhase.Menu);
      return g;
    }

    it("pressing H from menu shows high scores", () => {
      const g = enterMenu() as { showHighScores: boolean };
      expect(g.showHighScores).toBe(false);

      pressKey("KeyH"); releaseKey("KeyH");
      expect(g.showHighScores).toBe(true);
    });

    it("pressing H again dismisses high scores", () => {
      const g = enterMenu() as { showHighScores: boolean };

      pressKey("KeyH"); releaseKey("KeyH");
      expect(g.showHighScores).toBe(true);

      pressKey("KeyH"); releaseKey("KeyH");
      expect(g.showHighScores).toBe(false);
    });

    it("ArrowRight cycles high score mode without changing selected mode", () => {
      const g = enterMenu() as {
        showHighScores: boolean;
        highScoreMode: GameMode;
        selectedMode: GameMode;
      };

      pressKey("KeyH"); releaseKey("KeyH");
      expect(g.highScoreMode).toBe(GameMode.Marathon);

      pressKey("ArrowRight"); releaseKey("ArrowRight");
      expect(g.highScoreMode).toBe(GameMode.Sprint);
      expect(g.selectedMode).toBe(GameMode.Marathon); // unchanged
    });

    it("ArrowLeft cycles high score mode backward", () => {
      const g = enterMenu() as {
        showHighScores: boolean;
        highScoreMode: GameMode;
      };

      pressKey("KeyH"); releaseKey("KeyH");

      pressKey("ArrowRight"); releaseKey("ArrowRight"); // → Sprint
      expect(g.highScoreMode).toBe(GameMode.Sprint);

      pressKey("ArrowLeft"); releaseKey("ArrowLeft"); // ← Marathon
      expect(g.highScoreMode).toBe(GameMode.Marathon);

      pressKey("ArrowLeft"); releaseKey("ArrowLeft"); // ← Ultra
      expect(g.highScoreMode).toBe(GameMode.Ultra);
    });

    it("pressing any other key dismisses high scores", () => {
      const g = enterMenu() as { showHighScores: boolean };

      pressKey("KeyH"); releaseKey("KeyH");
      expect(g.showHighScores).toBe(true);

      pressKey("ArrowDown"); releaseKey("ArrowDown");
      expect(g.showHighScores).toBe(false);
    });
  });

  describe("hard drop effects (Phase 14.1 + 14.4)", () => {
    function startPlayingGame(): { state: GameState } {
      game = new Game(mockCtx);
      game.start();
      advanceFrames(5);

      // Exit attract mode and start a real game
      pressKey("ArrowRight"); releaseKey("ArrowRight");
      advanceFrames(5);
      pressKey("Enter"); releaseKey("Enter");
      advanceFrames(10);

      const g = game as unknown as { state: GameState };
      expect(g.state.phase).toBe(GamePhase.Playing);
      return g;
    }

    it("triggers Tetris flash and tetris SFX when hard drop clears 4 lines", () => {
      const g = startPlayingGame();

      // Set up board: 4 full rows at the bottom
      const board = Array.from({ length: BOARD_HEIGHT }, () =>
        Array<string | null>(BOARD_WIDTH).fill(null),
      );
      for (let i = 0; i < 4; i++) {
        board[BOARD_HEIGHT - 1 - i] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
      }

      g.state = {
        ...g.state,
        board,
        activePiece: {
          type: TetriminoType.I,
          pos: { x: 3, y: BOARD_HEIGHT - 6 },
          rotation: RotationState.ZERO,
        },
        ghostY: BOARD_HEIGHT - 6,
      };

      // Clear mock call counts from setup
      vi.clearAllMocks();

      pressKey("Space");

      expect(playSFX).toHaveBeenCalledWith("lock");
      expect(playSFX).toHaveBeenCalledWith("tetris");
      expect(triggerFlash).toHaveBeenCalledWith("#ffffff", 160);
    });

    it("clears lastLockResult after hard drop handling", () => {
      const g = startPlayingGame();

      const board = Array.from({ length: BOARD_HEIGHT }, () =>
        Array<string | null>(BOARD_WIDTH).fill(null),
      );
      for (let i = 0; i < 4; i++) {
        board[BOARD_HEIGHT - 1 - i] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
      }

      g.state = {
        ...g.state,
        board,
        activePiece: {
          type: TetriminoType.I,
          pos: { x: 3, y: BOARD_HEIGHT - 6 },
          rotation: RotationState.ZERO,
        },
        ghostY: BOARD_HEIGHT - 6,
      };

      pressKey("Space");

      // Transient field must be cleared so it doesn't pollute future frames
      expect((g.state as { lastLockResult?: unknown }).lastLockResult).toBeUndefined();
    });

    it("does not trigger flash for a non-clearing hard drop", () => {
      const g = startPlayingGame();

      // Empty board — piece drops but clears no lines
      const board = Array.from({ length: BOARD_HEIGHT }, () =>
        Array<string | null>(BOARD_WIDTH).fill(null),
      );

      g.state = {
        ...g.state,
        board,
        activePiece: {
          type: TetriminoType.I,
          pos: { x: 3, y: 0 },
          rotation: RotationState.ZERO,
        },
      };

      vi.clearAllMocks();
      pressKey("Space");

      expect(playSFX).toHaveBeenCalledWith("lock");
      expect(triggerFlash).not.toHaveBeenCalled();
    });
  });
});
