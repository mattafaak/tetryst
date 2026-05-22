import { describe, it, expect } from "vitest";
import { updateCombo } from "./combo.ts";
import { COMBO_BASE } from "./constants.ts";
import { GamePhase } from "./types.ts";
import type { GameState } from "./types.ts";

function createTestState(overrides?: Partial<GameState>): GameState {
  return {
    board: [],
    activePiece: null,
    ghostY: 0,
    heldPiece: null,
    hasSwappedThisTurn: false,
    nextQueue: [],
    score: 0,
    level: 1,
    lines: 0,
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
    ...overrides,
  };
}

describe("combo", () => {
  it("first clear starts combo at 0 (combo was -1 on init)", () => {
    const state = createTestState({ combo: -1, level: 1 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(0);
    expect(result.bonusScore).toBe(COMBO_BASE * 0 * 1);
  });

  it("subsequent clears increment combo", () => {
    const state = createTestState({ combo: 0, level: 1 });
    const result = updateCombo(state, 2);
    expect(result.state.combo).toBe(1);
    expect(result.bonusScore).toBe(COMBO_BASE * 1 * 1);
  });

  it("combo resets to -1 on non-clearing piece", () => {
    const state = createTestState({ combo: 3, level: 1 });
    const result = updateCombo(state, 0);
    expect(result.state.combo).toBe(-1);
    expect(result.bonusScore).toBe(0);
  });

  it("bonus score calculation: 50 x combo x level", () => {
    const state = createTestState({ combo: 2, level: 5 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(3);
    expect(result.bonusScore).toBe(COMBO_BASE * 3 * 5);
  });
});

describe("combo edge cases", () => {
  it("combo at level 0 produces 0 bonus regardless of combo count", () => {
    const state = createTestState({ combo: 2, level: 0 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(3);
    expect(result.bonusScore).toBe(0); // 50 * 3 * 0 = 0
  });

  it("linesCleared=0 when combo is already -1 stays -1", () => {
    const state = createTestState({ combo: -1, level: 1 });
    const result = updateCombo(state, 0);
    expect(result.state.combo).toBe(-1);
    expect(result.bonusScore).toBe(0);
  });

  it("triple combo increments across three consecutive clears", () => {
    let state = createTestState({ combo: -1, level: 1 });

    const r1 = updateCombo(state, 1);
    expect(r1.state.combo).toBe(0);
    expect(r1.bonusScore).toBe(50 * 0 * 1);
    state = r1.state;

    const r2 = updateCombo(state, 1);
    expect(r2.state.combo).toBe(1);
    expect(r2.bonusScore).toBe(50 * 1 * 1);
    state = r2.state;

    const r3 = updateCombo(state, 1);
    expect(r3.state.combo).toBe(2);
    expect(r3.bonusScore).toBe(50 * 2 * 1);
  });

  it("combo resets on linesCleared=0 even after deep chain", () => {
    const state = createTestState({ combo: 10, level: 1 });
    const result = updateCombo(state, 0);
    expect(result.state.combo).toBe(-1);
    expect(result.bonusScore).toBe(0);
  });

  it("level affects bonus: combo 5 at level 3 = 750", () => {
    const state = createTestState({ combo: 4, level: 3 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(5);
    expect(result.bonusScore).toBe(50 * 5 * 3);
  });
});
