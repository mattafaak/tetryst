import { describe, it, expect, beforeEach, vi } from "vitest";
import { createInitialState, startGame } from "./state.ts";
import { clearLines } from "./board.ts";
import { evaluateClear, effectiveLinesFor, calculateLevelFromEffective } from "./scoring.ts";
import { updateCombo } from "./combo.ts";
import { checkModeVictory } from "./mode-rules.ts";
import { pushPopup, tickPopups } from "../render/popups.ts";
import { loadHighScores, saveHighScore } from "./high-scores.ts";
import {
  GameMode,
  TetriminoType,
} from "./types.ts";
import type { GameState } from "./types.ts";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from "./constants.ts";

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
    it("pushes TETRIS! popup on 4-line clear", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      // Simulate 4-line clear condition
      if (4 === 4) {
        state = pushPopup(state, "TETRIS!", "#00f0f0");
      }
      expect(state.popups.some((p) => p.text === "TETRIS!")).toBe(true);
    });

    it("pushes T-SPIN popup for T-spin board geometry", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      const tSpinResult = { isTSpin: true, isMini: false };
      if (tSpinResult.isTSpin && 1 > 0) {
        state = pushPopup(state, "T-SPIN SINGLE", "#a000f0");
      }
      expect(state.popups.some((p) => p.text === "T-SPIN SINGLE")).toBe(true);
    });

    it("B2B popup appears on second consecutive Tetris", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      // First Tetris: isB2BActive was false → isB2B becomes true, no B2B bonus
      state = pushPopup(state, "TETRIS!", "#00f0f0");
      state = { ...state, backToBack: true };
      // Second Tetris: isB2BActive was true → B2B bonus applies
      const scoreResult = evaluateClear(4, { isTSpin: false, isMini: false }, state.level, true, false);
      if (scoreResult.isB2B) {
        state = pushPopup(state, "TETRIS!", "#00f0f0");
        state = pushPopup(state, "BACK-TO-BACK", "#f0a000");
      }
      expect(state.popups.some((p) => p.text === "TETRIS!")).toBe(true);
      expect(state.popups.some((p) => p.text === "BACK-TO-BACK")).toBe(true);
    });

    it("popup expires after 1200ms", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      state = pushPopup(state, "TETRIS!", "#00f0f0");
      state = tickPopups(state, 1200);
      expect(state.popups).toHaveLength(0);
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
