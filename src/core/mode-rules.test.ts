import { describe, it, expect } from "vitest";
import { checkModeVictory } from "./mode-rules.ts";
import { GamePhase, GameMode } from "./types.ts";
import type { GameState } from "./types.ts";

function makeState(overrides: Partial<GameState>): GameState {
  return {
    board: [],
    activePiece: null,
    ghostY: 0,
    heldPiece: null,
    hasSwappedThisTurn: false,
    nextQueue: [],
    score: 0,
    level: 0,
    lines: 0,
    effectiveLines: 0,
    combo: -1,
    backToBack: false,
    phase: GamePhase.Playing,
    gravityTimer: 0,
    lockState: { timer: 0, resets: 0, onGround: false, lowestY: -1 },
    entryDelayTimer: 0,
    bag: [],
    lineClearTimer: 0,
    clearedRowIndices: [],
    lastClearWasB2B: false,
    mode: GameMode.Marathon,
    modeTimer: 0,
    popups: [],
    ...overrides,
  };
}

describe("checkModeVictory", () => {
  describe("Marathon", () => {
    it("returns false at level 14", () => {
      expect(checkModeVictory(makeState({ mode: GameMode.Marathon, level: 14 }))).toBe(false);
    });

    it("returns true at level 15", () => {
      expect(checkModeVictory(makeState({ mode: GameMode.Marathon, level: 15 }))).toBe(true);
    });
  });

  describe("Sprint", () => {
    it("returns false at 39 lines", () => {
      expect(checkModeVictory(makeState({ mode: GameMode.Sprint, lines: 39 }))).toBe(false);
    });

    it("returns true at 40 lines", () => {
      expect(checkModeVictory(makeState({ mode: GameMode.Sprint, lines: 40 }))).toBe(true);
    });
  });

  describe("Ultra", () => {
    it("returns false when modeTimer > 0", () => {
      expect(checkModeVictory(makeState({ mode: GameMode.Ultra, modeTimer: 1 }))).toBe(false);
    });

    it("returns true when modeTimer === 0", () => {
      expect(checkModeVictory(makeState({ mode: GameMode.Ultra, modeTimer: 0 }))).toBe(true);
    });
  });

  it("returns false for Marathon mode when only Sprint line count is reached", () => {
    expect(checkModeVictory(makeState({ mode: GameMode.Marathon, lines: 40, level: 4 }))).toBe(false);
  });
});
