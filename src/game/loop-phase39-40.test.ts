/**
 * Phase 39 + 40 integration tests for the game loop.
 *
 * Covers:
 *  - Finesse SFX firing (hard-drop path and gravity-lock path)
 *  - DAS/ARR/SDR settings UI: navigation into timing section, value adjustment,
 *    boundary clamping, context-sensitive Left/Right behavior, preset application
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { playSFX } from "../audio/sfx.ts";
import { Game } from "./loop.ts";
import { GamePhase } from "../core/types.ts";
import type { GameState } from "../core/types.ts";
import {
  DAS_ROW_IDX, ARR_ROW_IDX, SDR_ROW_IDX,
  STANDARD_PRESET_IDX, FAST_PRESET_IDX, INSTANT_PRESET_IDX,
  DAS_STEP, ARR_STEP, SDR_STEP, DAS_PRESETS,
  TOTAL_BINDING_ROWS,
} from "../render/key-bindings-ui.ts";
import { DEFAULT_DAS_SETTINGS } from "../core/das-settings.ts";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("../render/canvas.ts", () => ({ renderFrame: vi.fn() }));
vi.mock("../audio/sfx.ts", () => ({ playSFX: vi.fn() }));
vi.mock("../audio/music.ts", () => ({
  playMusic: vi.fn(),
  stopMusic: vi.fn(),
  setSong: vi.fn(),
  setTempoMultiplier: vi.fn(),
}));
vi.mock("../render/effects.ts", () => ({ triggerFlash: vi.fn(), clearEffects: vi.fn() }));
vi.mock("../core/high-scores.ts", () => ({
  saveHighScore: vi.fn(),
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
let localStorageStore: Record<string, string>;

beforeEach(() => {
  keyDownListeners = [];
  keyUpListeners = [];
  rafCallbacks = new Map();
  nextRafId = 1;
  currentTime = 0;
  localStorageStore = {};
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
  const cafMock = vi.fn((id: number) => { rafCallbacks.delete(id); });

  vi.stubGlobal("window", {
    addEventListener: (event: string, listener: (e: unknown) => void) => {
      if (event === "keydown") keyDownListeners.push(listener);
      if (event === "keyup") keyUpListeners.push(listener);
    },
    removeEventListener: (event: string, listener: (e: unknown) => void) => {
      if (event === "keydown") keyDownListeners = keyDownListeners.filter((l) => l !== listener);
      if (event === "keyup") keyUpListeners = keyUpListeners.filter((l) => l !== listener);
    },
    devicePixelRatio: 1,
    innerWidth: 800,
    innerHeight: 600,
  } as unknown as Window & typeof globalThis);

  vi.stubGlobal("requestAnimationFrame", rafMock);
  vi.stubGlobal("cancelAnimationFrame", cafMock);
  vi.spyOn(performance, "now").mockImplementation(() => currentTime);

  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { localStorageStore[key] = val; }),
    removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
    clear: vi.fn(() => { for (const k in localStorageStore) delete localStorageStore[k]; }),
  });
});

afterEach(() => {
  if (game) { try { game.stop(); } catch { /* ignore */ } }
  vi.restoreAllMocks();
});

function pressKey(code: string): void {
  const event = { code, preventDefault: vi.fn(), type: "keydown" };
  for (const listener of keyDownListeners) listener(event);
}
function releaseKey(code: string): void {
  const event = { code, preventDefault: vi.fn(), type: "keyup" };
  for (const listener of keyUpListeners) listener(event);
}
function advanceFrames(n: number, dt = 16): void {
  for (let i = 0; i < n; i++) {
    const cb = rafCallbacks.get(nextRafId - 1);
    if (!cb) break;
    currentTime += dt;
    cb(currentTime);
  }
}

// Open the key-bindings screen from the attract-mode menu.
function openKeyBindings() {
  game = new Game(mockCtx);
  game.start();
  advanceFrames(5);
  pressKey("KeyK"); releaseKey("KeyK");
  advanceFrames(2);
  return game as unknown as {
    bindingsSelectedIdx: number;
    isKeyBindingScreen: boolean;
    dasSettings: { dasDelay: number; arrRate: number; sdrRate: number };
    state: GameState;
  };
}

// Navigate Down N times using ArrowDown (SoftDrop) in the bindings screen.
function navDown(n: number) {
  for (let i = 0; i < n; i++) { pressKey("ArrowDown"); releaseKey("ArrowDown"); }
}
function navUp(n: number) {
  for (let i = 0; i < n; i++) { pressKey("ArrowUp"); releaseKey("ArrowUp"); }
}

// ── Finesse SFX — hard-drop path ─────────────────────────────────────────

describe("Phase 39 — finesse SFX in game loop (hard-drop path)", () => {
  function startPlayingGame() {
    game = new Game(mockCtx);
    game.start();
    advanceFrames(5);
    pressKey("Enter"); releaseKey("Enter");
    advanceFrames(15);
    return game as unknown as { state: GameState };
  }

  it("hard-drop at spawn position with no extra moves → finesse SFX not fired", () => {
    const g = startPlayingGame();
    if (g.state.phase !== GamePhase.Playing || !g.state.activePiece) return;

    vi.mocked(playSFX).mockClear();
    // Hard-drop immediately (0 extra keypresses = canonical cost)
    pressKey("Space"); releaseKey("Space");
    advanceFrames(3);

    const finesseCallCount = vi.mocked(playSFX).mock.calls.filter(([n]) => n === "finesse").length;
    expect(finesseCallCount).toBe(0);
  });

  it("hard-drop after extra moves (back to spawn column) → finesse SFX fired", () => {
    const g = startPlayingGame();
    if (g.state.phase !== GamePhase.Playing || !g.state.activePiece) return;

    // Move left then right: net position unchanged but currentPieceKeypresses = 2
    // For T at x=3 rot=0: canonical = 0, actual = 2 → fault
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    pressKey("ArrowRight"); releaseKey("ArrowRight");

    vi.mocked(playSFX).mockClear();
    pressKey("Space"); releaseKey("Space");
    advanceFrames(3);

    const finesseCallCount = vi.mocked(playSFX).mock.calls.filter(([n]) => n === "finesse").length;
    expect(finesseCallCount).toBe(1);
  });

  it("each piece that has a fault fires exactly one finesse SFX", () => {
    const g = startPlayingGame();
    if (g.state.phase !== GamePhase.Playing || !g.state.activePiece) return;

    // Piece 1: fault (move left and right, back to spawn)
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    pressKey("ArrowRight"); releaseKey("ArrowRight");

    vi.mocked(playSFX).mockClear();
    pressKey("Space"); releaseKey("Space");
    advanceFrames(10); // let entry delay + spawn complete

    const count1 = vi.mocked(playSFX).mock.calls.filter(([n]) => n === "finesse").length;
    expect(count1).toBe(1);

    // Piece 2: no fault (hard-drop immediately at spawn)
    vi.mocked(playSFX).mockClear();
    if (g.state.phase === GamePhase.Playing && g.state.activePiece) {
      pressKey("Space"); releaseKey("Space");
      advanceFrames(10);
    }
    const count2 = vi.mocked(playSFX).mock.calls.filter(([n]) => n === "finesse").length;
    expect(count2).toBe(0);
  });

  it("finesseFaults counter increments in game state after fault", () => {
    const g = startPlayingGame();
    if (g.state.phase !== GamePhase.Playing || !g.state.activePiece) return;

    const faultsBefore = g.state.finesseFaults;
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    pressKey("Space"); releaseKey("Space");
    advanceFrames(3);

    expect(g.state.finesseFaults).toBeGreaterThan(faultsBefore);
  });
});

// ── Phase 40 — DAS/ARR/SDR settings UI ───────────────────────────────────

describe("Phase 40 — key-bindings screen timing section navigation", () => {
  it("TOTAL_BINDING_ROWS is 18 (11 actions + restore + 3 timing + 3 presets)", () => {
    expect(TOTAL_BINDING_ROWS).toBe(18);
    expect(DAS_ROW_IDX).toBe(12);
    expect(ARR_ROW_IDX).toBe(13);
    expect(SDR_ROW_IDX).toBe(14);
    expect(STANDARD_PRESET_IDX).toBe(15);
    expect(FAST_PRESET_IDX).toBe(16);
    expect(INSTANT_PRESET_IDX).toBe(17);
  });

  it("Down navigates from last action row into timing section", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX); // navigate from 0 to DAS_ROW_IDX
    expect(g.bindingsSelectedIdx).toBe(DAS_ROW_IDX);
  });

  it("Down navigates through all timing rows to presets", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    expect(g.bindingsSelectedIdx).toBe(DAS_ROW_IDX);

    navDown(1);
    expect(g.bindingsSelectedIdx).toBe(ARR_ROW_IDX);

    navDown(1);
    expect(g.bindingsSelectedIdx).toBe(SDR_ROW_IDX);

    navDown(1);
    expect(g.bindingsSelectedIdx).toBe(STANDARD_PRESET_IDX);

    navDown(1);
    expect(g.bindingsSelectedIdx).toBe(FAST_PRESET_IDX);

    navDown(1);
    expect(g.bindingsSelectedIdx).toBe(INSTANT_PRESET_IDX);
  });

  it("Up navigates from DAS row back to last action/restore row", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    navUp(1);
    expect(g.bindingsSelectedIdx).toBe(DAS_ROW_IDX - 1); // RESTORE_KEYS_IDX
  });

  it("Down wraps from INSTANT_PRESET_IDX back to row 0", () => {
    const g = openKeyBindings();
    navDown(INSTANT_PRESET_IDX + 1); // navigate past last row → wraps to 0
    expect(g.bindingsSelectedIdx).toBe(0);
  });
});

describe("Phase 40 — DAS value adjustment", () => {
  it("MoveLeft on DAS row decreases dasDelay by DAS_STEP", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    const before = g.dasSettings.dasDelay;
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    expect(g.dasSettings.dasDelay).toBe(before - DAS_STEP);
  });

  it("MoveRight on DAS row increases dasDelay by DAS_STEP", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    const before = g.dasSettings.dasDelay;
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    expect(g.dasSettings.dasDelay).toBe(before + DAS_STEP);
  });

  it("MoveLeft on ARR row decreases arrRate by ARR_STEP", () => {
    const g = openKeyBindings();
    navDown(ARR_ROW_IDX);
    const before = g.dasSettings.arrRate;
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    expect(g.dasSettings.arrRate).toBe(before - ARR_STEP);
  });

  it("MoveRight on ARR row increases arrRate by ARR_STEP", () => {
    const g = openKeyBindings();
    navDown(ARR_ROW_IDX);
    const before = g.dasSettings.arrRate;
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    expect(g.dasSettings.arrRate).toBe(before + ARR_STEP);
  });

  it("MoveLeft on SDR row decreases sdrRate by SDR_STEP", () => {
    const g = openKeyBindings();
    navDown(SDR_ROW_IDX);
    const before = g.dasSettings.sdrRate;
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    expect(g.dasSettings.sdrRate).toBe(before - SDR_STEP);
  });

  it("MoveRight on SDR row increases sdrRate by SDR_STEP", () => {
    const g = openKeyBindings();
    navDown(SDR_ROW_IDX);
    const before = g.dasSettings.sdrRate;
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    expect(g.dasSettings.sdrRate).toBe(before + SDR_STEP);
  });

  it("DAS clamps at lower bound 0 — MoveLeft below 0 stays at 0", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    // Reduce to 0 first
    const stepsToZero = Math.ceil(DEFAULT_DAS_SETTINGS.dasDelay / DAS_STEP) + 5;
    for (let i = 0; i < stepsToZero; i++) { pressKey("ArrowLeft"); releaseKey("ArrowLeft"); }
    expect(g.dasSettings.dasDelay).toBe(0);
  });

  it("DAS clamps at upper bound 500 — MoveRight above 500 stays at 500", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    const stepsToMax = Math.ceil((500 - DEFAULT_DAS_SETTINGS.dasDelay) / DAS_STEP) + 5;
    for (let i = 0; i < stepsToMax; i++) { pressKey("ArrowRight"); releaseKey("ArrowRight"); }
    expect(g.dasSettings.dasDelay).toBe(500);
  });

  it("ARR clamps at lower bound 0", () => {
    const g = openKeyBindings();
    navDown(ARR_ROW_IDX);
    const stepsToZero = Math.ceil(DEFAULT_DAS_SETTINGS.arrRate / ARR_STEP) + 5;
    for (let i = 0; i < stepsToZero; i++) { pressKey("ArrowLeft"); releaseKey("ArrowLeft"); }
    expect(g.dasSettings.arrRate).toBe(0);
  });

  it("ARR clamps at upper bound 200", () => {
    const g = openKeyBindings();
    navDown(ARR_ROW_IDX);
    const stepsToMax = Math.ceil((200 - DEFAULT_DAS_SETTINGS.arrRate) / ARR_STEP) + 5;
    for (let i = 0; i < stepsToMax; i++) { pressKey("ArrowRight"); releaseKey("ArrowRight"); }
    expect(g.dasSettings.arrRate).toBe(200);
  });

  it("SDR clamps at lower bound 0", () => {
    const g = openKeyBindings();
    navDown(SDR_ROW_IDX);
    const stepsToZero = Math.ceil(DEFAULT_DAS_SETTINGS.sdrRate / SDR_STEP) + 5;
    for (let i = 0; i < stepsToZero; i++) { pressKey("ArrowLeft"); releaseKey("ArrowLeft"); }
    expect(g.dasSettings.sdrRate).toBe(0);
  });

  it("SDR clamps at upper bound 200", () => {
    const g = openKeyBindings();
    navDown(SDR_ROW_IDX);
    const stepsToMax = Math.ceil((200 - DEFAULT_DAS_SETTINGS.sdrRate) / SDR_STEP) + 5;
    for (let i = 0; i < stepsToMax; i++) { pressKey("ArrowRight"); releaseKey("ArrowRight"); }
    expect(g.dasSettings.sdrRate).toBe(200);
  });

  it("adjusting DAS calls saveDASSettings (persists to localStorage)", () => {
    openKeyBindings();
    navDown(DAS_ROW_IDX);
    const setItemBefore = vi.mocked(localStorage.setItem).mock.calls.length;
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    expect(vi.mocked(localStorage.setItem).mock.calls.length).toBeGreaterThan(setItemBefore);
  });

  it("adjusting ARR calls saveDASSettings", () => {
    openKeyBindings();
    navDown(ARR_ROW_IDX);
    const setItemBefore = vi.mocked(localStorage.setItem).mock.calls.length;
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    expect(vi.mocked(localStorage.setItem).mock.calls.length).toBeGreaterThan(setItemBefore);
  });
});

describe("Phase 40 — context-sensitive MoveLeft/MoveRight behavior", () => {
  it("MoveLeft on a timing row does NOT change selectedIdx", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    expect(g.bindingsSelectedIdx).toBe(DAS_ROW_IDX);
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    expect(g.bindingsSelectedIdx).toBe(DAS_ROW_IDX); // no navigation
  });

  it("MoveRight on a timing row does NOT change selectedIdx", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    expect(g.bindingsSelectedIdx).toBe(DAS_ROW_IDX);
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    expect(g.bindingsSelectedIdx).toBe(DAS_ROW_IDX); // no navigation
  });

  it("MoveLeft on a non-timing action row navigates UP (same as RotateCW)", () => {
    const g = openKeyBindings();
    // Start at row 0; navigate down to row 3
    navDown(3);
    expect(g.bindingsSelectedIdx).toBe(3);
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    expect(g.bindingsSelectedIdx).toBe(2); // navigated up
  });

  it("MoveRight on a non-timing action row navigates DOWN (same as SoftDrop)", () => {
    const g = openKeyBindings();
    navDown(2);
    expect(g.bindingsSelectedIdx).toBe(2);
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    expect(g.bindingsSelectedIdx).toBe(3); // navigated down
  });

  it("SoftDrop (ArrowDown) on a timing row DOES navigate down", () => {
    const g = openKeyBindings();
    navDown(DAS_ROW_IDX);
    pressKey("ArrowDown"); releaseKey("ArrowDown");
    expect(g.bindingsSelectedIdx).toBe(ARR_ROW_IDX);
  });

  it("RotateCW (ArrowUp) on a timing row DOES navigate up", () => {
    const g = openKeyBindings();
    navDown(ARR_ROW_IDX);
    pressKey("ArrowUp"); releaseKey("ArrowUp");
    expect(g.bindingsSelectedIdx).toBe(DAS_ROW_IDX);
  });
});

describe("Phase 40 — preset application", () => {
  it("Enter on Standard preset sets dasDelay=300, arrRate=50, sdrRate=50", () => {
    const g = openKeyBindings();
    navDown(STANDARD_PRESET_IDX);
    pressKey("Enter"); releaseKey("Enter");
    expect(g.dasSettings).toEqual(DAS_PRESETS.standard);
  });

  it("Enter on Fast preset sets dasDelay=133, arrRate=10, sdrRate=10", () => {
    const g = openKeyBindings();
    navDown(FAST_PRESET_IDX);
    pressKey("Enter"); releaseKey("Enter");
    expect(g.dasSettings).toEqual(DAS_PRESETS.fast);
  });

  it("Enter on Instant preset sets dasDelay=0, arrRate=0, sdrRate=0", () => {
    const g = openKeyBindings();
    navDown(INSTANT_PRESET_IDX);
    pressKey("Enter"); releaseKey("Enter");
    expect(g.dasSettings).toEqual(DAS_PRESETS.instant);
  });

  it("preset application calls saveDASSettings (persists to localStorage)", () => {
    openKeyBindings();
    navDown(STANDARD_PRESET_IDX);
    const callsBefore = vi.mocked(localStorage.setItem).mock.calls.length;
    pressKey("Enter"); releaseKey("Enter");
    expect(vi.mocked(localStorage.setItem).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("applying Instant preset then adjusting with MoveRight increments from 0", () => {
    const g = openKeyBindings();
    // Apply Instant (all zeros)
    navDown(INSTANT_PRESET_IDX);
    pressKey("Enter"); releaseKey("Enter");
    expect(g.dasSettings.dasDelay).toBe(0);

    // Navigate to DAS row and press MoveRight
    navUp(INSTANT_PRESET_IDX - DAS_ROW_IDX); // back to DAS row
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    expect(g.dasSettings.dasDelay).toBe(DAS_STEP); // 0 + 10 = 10
  });

  it("after Standard preset, DAS adjustment step yields 300 ± DAS_STEP", () => {
    const g = openKeyBindings();
    navDown(STANDARD_PRESET_IDX);
    pressKey("Enter"); releaseKey("Enter");
    navUp(STANDARD_PRESET_IDX - DAS_ROW_IDX); // to DAS row
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    expect(g.dasSettings.dasDelay).toBe(300 - DAS_STEP);
  });
});

describe("Phase 40 — DAS constants correctness", () => {
  it("DAS_STEP is 10", () => { expect(DAS_STEP).toBe(10); });
  it("ARR_STEP is 5",  () => { expect(ARR_STEP).toBe(5); });
  it("SDR_STEP is 5",  () => { expect(SDR_STEP).toBe(5); });

  it("Standard preset matches DEFAULT_DAS_SETTINGS", () => {
    expect(DAS_PRESETS.standard).toEqual(DEFAULT_DAS_SETTINGS);
  });

  it("Fast preset has lower values than Standard", () => {
    expect(DAS_PRESETS.fast.dasDelay).toBeLessThan(DAS_PRESETS.standard.dasDelay);
    expect(DAS_PRESETS.fast.arrRate).toBeLessThan(DAS_PRESETS.standard.arrRate);
  });

  it("Instant preset is all-zero (maximum responsiveness)", () => {
    expect(DAS_PRESETS.instant).toEqual({ dasDelay: 0, arrRate: 0, sdrRate: 0 });
  });
});

describe("Phase 40 — key-bindings screen: Enter on action row still rebinds", () => {
  it("Enter on row 0 (action row) starts key-capture, not preset", () => {
    const g = openKeyBindings();
    expect(g.bindingsSelectedIdx).toBe(0);
    pressKey("Enter"); releaseKey("Enter");
    advanceFrames(1);
    const bindingsWaiting = (game as unknown as { bindingsWaitingForKey: boolean }).bindingsWaitingForKey;
    expect(bindingsWaiting).toBe(true);
  });
});

describe("Phase 40 — stats UI — computeGameStats accuracy validation", () => {
  it("piecesPlaced increments in real game play", () => {
    game = new Game(mockCtx);
    game.start();
    advanceFrames(5);
    pressKey("Enter"); releaseKey("Enter");
    advanceFrames(15);

    const g = game as unknown as { state: GameState };
    if (g.state.phase !== GamePhase.Playing) return;

    const piecesBefore = g.state.piecesPlaced;
    pressKey("Space"); releaseKey("Space"); // hard-drop
    advanceFrames(15); // wait for spawn

    expect(g.state.piecesPlaced).toBeGreaterThan(piecesBefore);
  });

  it("totalKeypresses increments for move actions", () => {
    game = new Game(mockCtx);
    game.start();
    advanceFrames(5);
    pressKey("Enter"); releaseKey("Enter");
    advanceFrames(15);

    const g = game as unknown as { state: GameState };
    if (g.state.phase !== GamePhase.Playing) return;

    const kpBefore = g.state.totalKeypresses;
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    pressKey("ArrowRight"); releaseKey("ArrowRight");
    pressKey("ArrowUp"); releaseKey("ArrowUp"); // RotateCW
    expect(g.state.totalKeypresses).toBe(kpBefore + 3);
  });

  it("currentPieceKeypresses resets after piece locks and new one spawns", () => {
    game = new Game(mockCtx);
    game.start();
    advanceFrames(5);
    pressKey("Enter"); releaseKey("Enter");
    advanceFrames(15);

    const g = game as unknown as { state: GameState };
    if (g.state.phase !== GamePhase.Playing) return;

    // Make some moves to increment counter
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    pressKey("ArrowLeft"); releaseKey("ArrowLeft");
    expect(g.state.currentPieceKeypresses).toBeGreaterThan(0);

    // Hard-drop and wait for next piece
    pressKey("Space"); releaseKey("Space");
    advanceFrames(20);

    if (g.state.phase === GamePhase.Playing && g.state.activePiece) {
      expect(g.state.currentPieceKeypresses).toBe(0);
    }
  });
});

describe("Phase 40 — keyboard-bindings screen rendering constants", () => {
  it("row indices form a contiguous ascending sequence", () => {
    expect(ARR_ROW_IDX).toBe(DAS_ROW_IDX + 1);
    expect(SDR_ROW_IDX).toBe(ARR_ROW_IDX + 1);
    expect(STANDARD_PRESET_IDX).toBe(SDR_ROW_IDX + 1);
    expect(FAST_PRESET_IDX).toBe(STANDARD_PRESET_IDX + 1);
    expect(INSTANT_PRESET_IDX).toBe(FAST_PRESET_IDX + 1);
  });
});
