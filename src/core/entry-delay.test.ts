import { describe, it, expect } from "vitest";
import { updateEntryDelay } from "./entry-delay.ts";
import { ENTRY_DELAY } from "./constants.ts";
import { GamePhase, TetriminoType, RotationState  } from "./types.ts";
import type { GameState } from "./types.ts";
import { baseState } from "../test-utils/test-utils.ts";

function createTestState(overrides?: Partial<GameState>): GameState {
  return baseState({
    phase: GamePhase.Playing,
    activePiece: {
      type: TetriminoType.T,
      pos: { x: 3, y: 0 },
      rotation: RotationState.ZERO,
    },
    ...overrides,
  });
}

describe("entry-delay", () => {
  describe("updateEntryDelay", () => {
    it("no-op when not in EntryDelay phase", () => {
      const state = createTestState({ phase: GamePhase.Playing });
      const result = updateEntryDelay(state, 100);
      expect(result.ready).toBe(false);
      expect(result.state).toBe(state);
    });

    it("timer accumulates", () => {
      const state = createTestState({
        phase: GamePhase.EntryDelay,
        entryDelayTimer: 0,
      });
      const result1 = updateEntryDelay(state, 100);
      expect(result1.ready).toBe(false);
      expect(result1.state.entryDelayTimer).toBe(100);

      const result2 = updateEntryDelay(result1.state, 50);
      expect(result2.ready).toBe(false);
      expect(result2.state.entryDelayTimer).toBe(150);
    });

    it("returns ready=true when timer >= ENTRY_DELAY", () => {
      const state = createTestState({
        phase: GamePhase.EntryDelay,
        entryDelayTimer: 0,
      });
      const result = updateEntryDelay(state, ENTRY_DELAY);
      expect(result.ready).toBe(true);
      expect(result.state.phase).toBe(GamePhase.Playing);
    });

    it("timer accumulates exactly to threshold with 100 + 100 = 200", () => {
      const state = createTestState({
        phase: GamePhase.EntryDelay,
        entryDelayTimer: 0,
      });
      const r1 = updateEntryDelay(state, 100);
      expect(r1.ready).toBe(false);
      expect(r1.state.entryDelayTimer).toBe(100);
      expect(r1.state.phase).toBe(GamePhase.EntryDelay);

      const r2 = updateEntryDelay(r1.state, 100);
      expect(r2.ready).toBe(true);
      expect(r2.state.entryDelayTimer).toBe(200);
      expect(r2.state.phase).toBe(GamePhase.Playing);
    });
  });
});
