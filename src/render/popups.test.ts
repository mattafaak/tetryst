import { describe, it, expect } from "vitest";
import { pushPopup, tickPopups } from "./popups.ts";
import { GamePhase, GameMode } from "../core/types.ts";
import type { GameState } from "../core/types.ts";

function emptyState(): GameState {
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
    mode: GameMode.Marathon,
    modeTimer: 0,
    popups: [],
  };
}

describe("pushPopup", () => {
  it("adds one item with correct text, color, and duration", () => {
    const state = emptyState();
    const next = pushPopup(state, "TETRIS!", "#00f0f0");
    expect(next.popups).toHaveLength(1);
    expect(next.popups[0].text).toBe("TETRIS!");
    expect(next.popups[0].color).toBe("#00f0f0");
    expect(next.popups[0].duration).toBe(1200);
    expect(next.popups[0].timer).toBe(0);
  });

  it("accumulates multiple items", () => {
    const s0 = emptyState();
    const s1 = pushPopup(s0, "TETRIS!", "#00f0f0");
    const s2 = pushPopup(s1, "BACK-TO-BACK", "#f0a000");
    expect(s2.popups).toHaveLength(2);
    expect(s2.popups[0].text).toBe("TETRIS!");
    expect(s2.popups[1].text).toBe("BACK-TO-BACK");
  });
});

describe("tickPopups", () => {
  it("advances timers and keeps items when dt < duration", () => {
    const s0 = pushPopup(emptyState(), "TETRIS!", "#00f0f0");
    const s1 = tickPopups(s0, 600);
    expect(s1.popups).toHaveLength(1);
    expect(s1.popups[0].timer).toBe(600);
  });

  it("removes expired items when dt >= duration", () => {
    const s0 = pushPopup(emptyState(), "TETRIS!", "#00f0f0");
    const s1 = tickPopups(s0, 1200);
    expect(s1.popups).toHaveLength(0);
  });

  it("removes only expired items when mixed", () => {
    let s = emptyState();
    s = pushPopup(s, "A", "#fff");
    s = { ...s, popups: [{ ...s.popups[0], timer: 1100 }] }; // nearly expired
    s = pushPopup(s, "B", "#fff"); // fresh
    const s1 = tickPopups(s, 200); // A timer → 1300 >= 1200, B timer → 200
    expect(s1.popups).toHaveLength(1);
    expect(s1.popups[0].text).toBe("B");
  });

  it("does not mutate the input state", () => {
    const s0 = pushPopup(emptyState(), "TETRIS!", "#00f0f0");
    const originalPopups = s0.popups;
    tickPopups(s0, 100);
    expect(s0.popups).toBe(originalPopups);
    expect(s0.popups[0].timer).toBe(0);
  });
});
