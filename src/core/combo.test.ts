import { describe, it, expect } from "vitest";
import { updateCombo } from "./combo.ts";
import { COMBO_BASE } from "./constants.ts";
import { GamePhase } from "./types.ts";
import type { GameState } from "./types.ts";
import { baseState } from "../test-utils/test-utils.ts";

function createTestState(overrides?: Partial<GameState>): GameState {
  return baseState({
    phase: GamePhase.Playing,
    ...overrides,
  });
}

describe("combo", () => {
  it("first clear increments combo from 0 to 1 with zero bonus (TDG §7)", () => {
    const state = createTestState({ combo: 0, level: 0 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(1);
    expect(result.bonusScore).toBe(0); // first clear: pre-increment combo=0 → 50×0×1=0
  });

  it("subsequent clears increment combo and award bonus (TDG §7)", () => {
    const state = createTestState({ combo: 1, level: 0 });
    const result = updateCombo(state, 2);
    expect(result.state.combo).toBe(2);
    expect(result.bonusScore).toBe(COMBO_BASE * 1 * 1); // pre-increment combo=1 → 50×1×1
  });

  it("combo resets to 0 on non-clearing piece", () => {
    const state = createTestState({ combo: 3, level: 0 });
    const result = updateCombo(state, 0);
    expect(result.state.combo).toBe(0);
    expect(result.bonusScore).toBe(0);
  });

  it("bonus score calculation: 50 × pre-increment-combo × (level+1)", () => {
    const state = createTestState({ combo: 2, level: 4 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(3);
    expect(result.bonusScore).toBe(COMBO_BASE * 2 * 5); // pre-increment combo=2 → 50×2×5
  });
});

describe("combo edge cases", () => {
  it("linesCleared=0 when combo is already 0 stays 0", () => {
    const state = createTestState({ combo: 0, level: 1 });
    const result = updateCombo(state, 0);
    expect(result.state.combo).toBe(0);
    expect(result.bonusScore).toBe(0);
  });

  it("triple combo increments across three consecutive clears", () => {
    let state = createTestState({ combo: 0, level: 0 });

    // TDG §7: bonus uses pre-increment combo value
    const r1 = updateCombo(state, 1);
    expect(r1.state.combo).toBe(1);
    expect(r1.bonusScore).toBe(50 * 0 * 1); // pre-increment combo=0 → 0
    state = r1.state;

    const r2 = updateCombo(state, 1);
    expect(r2.state.combo).toBe(2);
    expect(r2.bonusScore).toBe(50 * 1 * 1); // pre-increment combo=1 → 50
    state = r2.state;

    const r3 = updateCombo(state, 1);
    expect(r3.state.combo).toBe(3);
    expect(r3.bonusScore).toBe(50 * 2 * 1); // pre-increment combo=2 → 100
  });

  it("combo resets on linesCleared=0 even after deep chain", () => {
    const state = createTestState({ combo: 10, level: 0 });
    const result = updateCombo(state, 0);
    expect(result.state.combo).toBe(0);
    expect(result.bonusScore).toBe(0);
  });

  it("level affects bonus: combo pre-4 at level 2 → 50×4×3=600", () => {
    const state = createTestState({ combo: 4, level: 2 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(5);
    expect(result.bonusScore).toBe(50 * 4 * 3); // pre-increment combo=4 → 600
  });
});

// TDG §7: first consecutive clear earns 0 combo bonus; second earns 50×(level+1)
it("TDG §7: first consecutive clear bonus is 0", () => {
  const state = createTestState({ combo: 0, level: 0 });
  const result = updateCombo(state, 1);
  expect(result.bonusScore).toBe(0); // first clear: state.combo=0 → 50×0×1=0
});

it("TDG §7: second consecutive clear bonus is 50×(level+1)", () => {
  const state = createTestState({ combo: 1, level: 0 });
  const result = updateCombo(state, 1);
  expect(result.bonusScore).toBe(50 * 1); // second clear: state.combo=1 → 50×1×1=50
});
