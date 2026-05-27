import { describe, it, expect, beforeEach, vi } from "vitest";
import { createInitialState, startGame } from "./state.ts";
import { clearLines, createBoard, lockPiece } from "./board.ts";
import { evaluateClear, effectiveLinesFor, calculateLevelFromEffective } from "./scoring.ts";
import { updateCombo } from "./combo.ts";
import { checkModeVictory } from "./mode-rules.ts";
import { pushPopup, tickPopups } from "./popups.ts";
import { executeLock } from "./lock.ts";
import { loadHighScores, saveHighScore } from "./high-scores.ts";
import {
  GameMode,
  TetriminoType,
  RotationState,
  GamePhase,
} from "./types.ts";
import type { GameState, Piece } from "./types.ts";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from "./constants.ts";

function lockAndRun(state: GameState, piece: Piece) {
  const lockedBoard = lockPiece(state.board, piece);
  return executeLock({ ...state, board: lockedBoard, activePiece: null }, piece);
}

function mockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

/** Fill the bottom n rows of a board (all cells occupied). */
function fillRows(state: GameState, n: number): GameState {
  const board = state.board.map((row) => [...row]);
  for (let r = BOARD_HEIGHT - n; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      board[r][c] = TetriminoType.I;
    }
  }
  return { ...state, board };
}

/** Simulate n single-line clears and return the resulting state. */
function simulateLineClear(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = fillRows(s, 1);
    const clearResult = clearLines(s.board);
    s = { ...s, board: clearResult.board };
    const comboResult = updateCombo(s, clearResult.linesCleared);
    s = comboResult.state;
    const tSpinResult = { isTSpin: false, isMini: false };
    const scoreResult = evaluateClear(
      clearResult.linesCleared,
      tSpinResult,
      s.level,
      s.backToBack,
      false,
    );
    const eff = s.mode === GameMode.Marathon
      ? effectiveLinesFor(clearResult.linesCleared, tSpinResult, scoreResult.isB2B)
      : 0;
    const newEffective = s.effectiveLines + eff;
    const newLevel = s.mode === GameMode.Marathon
      ? calculateLevelFromEffective(newEffective)
      : s.level;
    s = {
      ...s,
      score: s.score + scoreResult.score + comboResult.bonusScore,
      backToBack: scoreResult.isB2B,
      lines: s.lines + clearResult.linesCleared,
      effectiveLines: newEffective,
      level: newLevel,
    };
  }
  return s;
}

describe("integration", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockStorage());
  });

  describe("Sprint completes at 40 lines", () => {
    it("checkModeVictory triggers at 40 lines in Sprint mode", () => {
      let state = startGame(createInitialState(GameMode.Sprint));
      expect(checkModeVictory(state)).toBe(false);
      state = simulateLineClear(state, 40);
      expect(state.lines).toBe(40);
      expect(checkModeVictory(state)).toBe(true);
    });

    it("checkModeVictory does not trigger at 39 lines", () => {
      let state = startGame(createInitialState(GameMode.Sprint));
      state = simulateLineClear(state, 39);
      expect(checkModeVictory(state)).toBe(false);
    });
  });

  describe("Marathon completes at level 15", () => {
    it("checkModeVictory triggers after 600 single-line clears (Variable Goal)", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      state = simulateLineClear(state, 600);
      expect(state.level).toBe(15);
      expect(checkModeVictory(state)).toBe(true);
    });
  });

  describe("Ultra expires", () => {
    it("checkModeVictory returns true when modeTimer reaches 0", () => {
      let state = startGame(createInitialState(GameMode.Ultra));
      state = { ...state, modeTimer: 500 };
      state = { ...state, modeTimer: Math.max(0, state.modeTimer - 500) };
      expect(state.modeTimer).toBe(0);
      expect(checkModeVictory(state)).toBe(true);
    });
  });

  describe("Popups", () => {
    function makePlayingState(): GameState {
      return {
        ...createInitialState(GameMode.Marathon),
        phase: GamePhase.Playing,
        activePiece: { type: TetriminoType.I, pos: { x: 0, y: 0 }, rotation: RotationState.ZERO },
        nextQueue: [{ type: TetriminoType.T }, { type: TetriminoType.O }, { type: TetriminoType.S }, { type: TetriminoType.Z }, { type: TetriminoType.J }],
        bag: [TetriminoType.L],
      };
    }

    it("executeLock emits TETRIS! popup on 4-line clear", () => {
      const board = createBoard();
      // Fill bottom 4 rows completely; I-piece placed on top of the already-full rows
      for (let r = BOARD_HEIGHT - 4; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.J;
      }
      const state = { ...makePlayingState(), board };
      const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 4 }, rotation: RotationState.ZERO };
      const result = lockAndRun(state, piece);
      expect(result.linesCleared).toBe(4);
      expect(result.popupInfo.some((p) => p.text === "TETRIS!")).toBe(true);
    });

    it("executeLock emits T-SPIN SINGLE popup on T-spin 1-line clear", () => {
      // T at ZERO, pos=(3,20). Piece cells: (4,20),(3,21),(4,21),(5,21).
      // 3×3 bounding box corners: TL=(3,20), TR=(5,20), BL=(3,22), BR=(5,22).
      // ZERO back=[TL,TR]. Full T-spin: both back + ≥1 front = ≥3 corners, both back occupied.
      // Setup: TL + TR (both back) + BL (front) = 3 corners → isTSpin=true, isMini=false.
      // Row 21 filled (minus the 3 T-piece cells) → 1 line clears after T locks.
      const board = createBoard();
      for (let c = 0; c < BOARD_WIDTH; c++) board[21][c] = TetriminoType.J;
      board[21][3] = null; board[21][4] = null; board[21][5] = null;
      board[20][3] = TetriminoType.I; // TL (back)
      board[20][5] = TetriminoType.I; // TR (back) — both back occupied
      board[22][3] = TetriminoType.I; // BL (front) — 3rd corner → full T-spin
      const state = { ...makePlayingState(), board };
      const piece = { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
      const result = lockAndRun(state, piece);
      expect(result.tSpinResult.isTSpin).toBe(true);
      expect(result.tSpinResult.isMini).toBe(false);
      expect(result.popupInfo.some((p) => p.text === "T-SPIN SINGLE")).toBe(true);
    });

    it("B2B popup appears on second consecutive Tetris via executeLock", () => {
      const board = createBoard();
      for (let r = BOARD_HEIGHT - 4; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.J;
      }
      // Second Tetris: backToBack already true from first
      const state = { ...makePlayingState(), board, backToBack: true };
      const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 4 }, rotation: RotationState.ZERO };
      const result = lockAndRun(state, piece);
      expect(result.linesCleared).toBe(4);
      expect(result.popupInfo.some((p) => p.text === "TETRIS!")).toBe(true);
      expect(result.popupInfo.some((p) => p.text === "BACK-TO-BACK")).toBe(true);
    });

    it("popup expires after 1200ms", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      state = pushPopup(state, "TETRIS!", "#00f0f0");
      state = tickPopups(state, 1200);
      expect(state.popups).toHaveLength(0);
    });

    it("level-up popup has correct text and color", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      const leveled = pushPopup(state, "LEVEL 1!", "#ffff00");
      expect(leveled.popups.some((p) => p.text === "LEVEL 1!" && p.color === "#ffff00")).toBe(true);
    });
  });

  describe("High scores", () => {
    it("saves score on Marathon victory", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      state = simulateLineClear(state, 600);
      saveHighScore({ score: state.score, level: state.level, lines: state.lines, mode: state.mode });
      const scores = loadHighScores(GameMode.Marathon);
      expect(scores.length).toBeGreaterThan(0);
      expect(scores[0].level).toBe(15);
    });

    it("saves elapsed time for Sprint victory", () => {
      let state = startGame(createInitialState(GameMode.Sprint));
      state = { ...state, modeTimer: 93500 }; // ~1:33.5 elapsed
      state = simulateLineClear(state, 40);
      saveHighScore({ score: state.modeTimer, level: state.level, lines: state.lines, mode: state.mode });
      const scores = loadHighScores(GameMode.Sprint);
      expect(scores.length).toBe(1);
      expect(scores[0].score).toBe(93500);
    });
  });
});
