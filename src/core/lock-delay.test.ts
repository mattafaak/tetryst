import { describe, it, expect } from "vitest";
import {
  shouldLock,
  resetLockState,
  updateLowestY,
} from "./lock-delay.ts";
import { LOCK_DELAY, MAX_LOCK_RESETS } from "./constants.ts";
import { GamePhase , GameMode } from "./types.ts";
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

describe("lock-delay", () => {
  describe("shouldLock", () => {
    it("returns false when piece is not on ground", () => {
      const state = createTestState({
        lockState: { timer: 0, resets: 0, onGround: false, lowestY: -1 },
      });
      const result = shouldLock(state, 100);
      expect(result.shouldLock).toBe(false);
      expect(result.state).toBe(state);
    });

    it("returns false when onGround is false regardless of timer value", () => {
      const state = createTestState({
        lockState: { timer: 50000, resets: 0, onGround: false, lowestY: -1 },
      });
      const result = shouldLock(state, 100);
      expect(result.shouldLock).toBe(false);
      expect(result.state).toBe(state);
      expect(result.state.lockState.timer).toBe(50000); // untouched
    });

    it("returns false when phase is not Playing", () => {
      const phases: GamePhase[] = [
        GamePhase.Paused,
        GamePhase.GameOver,
        GamePhase.Menu,
        GamePhase.EntryDelay,
        GamePhase.LineClear,
      ];
      for (const phase of phases) {
        const state = createTestState({
          phase,
          lockState: { timer: 0, resets: 0, onGround: true, lowestY: -1 },
        });
        const result = shouldLock(state, 500);
        expect(result.shouldLock).toBe(false);
        expect(result.state).toBe(state);
      }
    });

    it("timer accumulates correctly", () => {
      const state = createTestState({
        lockState: { timer: 0, resets: 0, onGround: true, lowestY: -1 },
      });
      const result1 = shouldLock(state, 200);
      expect(result1.shouldLock).toBe(false);
      expect(result1.state.lockState.timer).toBe(200);

      const result2 = shouldLock(result1.state, 150);
      expect(result2.shouldLock).toBe(false);
      expect(result2.state.lockState.timer).toBe(350);
    });

    it("multiple dt accumulations 200+200+200 = 600 >= 500 → shouldLock", () => {
      const state = createTestState({
        lockState: { timer: 0, resets: 0, onGround: true, lowestY: -1 },
      });
      const r1 = shouldLock(state, 200);
      expect(r1.shouldLock).toBe(false);
      expect(r1.state.lockState.timer).toBe(200);

      const r2 = shouldLock(r1.state, 200);
      expect(r2.shouldLock).toBe(false);
      expect(r2.state.lockState.timer).toBe(400);

      const r3 = shouldLock(r2.state, 200);
      expect(r3.shouldLock).toBe(true);
      expect(r3.state.lockState.timer).toBe(600);
    });

    it("locks immediately when resets >= MAX_LOCK_RESETS, ignoring timer (TDG §7)", () => {
      const state = createTestState({
        lockState: { timer: 0, resets: MAX_LOCK_RESETS, onGround: true, lowestY: -1 },
      });
      const result = shouldLock(state, 1); // tiny dt — well below LOCK_DELAY
      expect(result.shouldLock).toBe(true);
      expect(result.state).toBe(state); // state unchanged, no timer mutation
    });

    it("does not lock immediately when resets is one below the limit", () => {
      const state = createTestState({
        lockState: { timer: 0, resets: MAX_LOCK_RESETS - 1, onGround: true, lowestY: -1 },
      });
      const result = shouldLock(state, 1);
      expect(result.shouldLock).toBe(false); // timer only 1ms — well below 500ms
    });

    it("returns true when timer >= LOCK_DELAY", () => {
      const state = createTestState({
        lockState: { timer: 0, resets: 0, onGround: true, lowestY: -1 },
      });
      const result = shouldLock(state, LOCK_DELAY);
      expect(result.shouldLock).toBe(true);
      expect(result.state.lockState.timer).toBe(LOCK_DELAY);
    });
  });

  describe("resetLockState", () => {
    it("returns initial state", () => {
      const lockState = resetLockState();
      expect(lockState).toEqual({
        timer: 0,
        resets: 0,
        onGround: false,
        lowestY: -1,
      });
    });
  });


  describe("updateLowestY", () => {
    it("resets resets counter when piece descends to new lowest y", () => {
      const state = createTestState({
        lockState: { timer: 300, resets: 10, onGround: true, lowestY: 25 },
      });
      const next = updateLowestY(state, 26);
      expect(next.lockState.resets).toBe(0);
      expect(next.lockState.lowestY).toBe(26);
    });

    it("does not reset counter when y is same or higher", () => {
      const state = createTestState({
        lockState: { timer: 300, resets: 10, onGround: true, lowestY: 25 },
      });
      const next = updateLowestY(state, 25);
      expect(next.lockState.resets).toBe(10);
      expect(next).toBe(state);
    });

    it("initializes lowestY on first descent from -1", () => {
      const state = createTestState({
        lockState: { timer: 0, resets: 0, onGround: false, lowestY: -1 },
      });
      const next = updateLowestY(state, 20);
      expect(next.lockState.lowestY).toBe(20);
      expect(next.lockState.resets).toBe(0);
    });
  });
});
