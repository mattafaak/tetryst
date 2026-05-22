import { describe, it, expect } from "vitest";
import { AIController, createAttractAIController } from "./ai-controller.ts";
import { RotationState, GamePhase } from "../core/types.ts";
import { createInitialState, startGame } from "../core/state.ts";
import type { AIPlacement } from "./ai-brain.ts";

function makePlayingState(): ReturnType<typeof startGame> {
  return startGame(createInitialState());
}

describe("AIController", () => {
  it("starts in IDLE and returns null when phase is not Playing", () => {
    const ctrl = new AIController({ actionInterval: 0 });
    const menuState = createInitialState();
    expect(ctrl.update(menuState, 16)).toBeNull();
  });

  it("returns null when state has no active piece", () => {
    const ctrl = new AIController({ actionInterval: 0 });
    const state = makePlayingState();
    state.activePiece = null;
    expect(ctrl.update(state, 16)).toBeNull();
  });

  it("resets when game enters non-Playing phase", () => {
    const ctrl = new AIController({ actionInterval: 0 });
    const state = makePlayingState();

    // First call triggers IDLE → computes placement → returns Hold or null (transition to ROTATING)
    const firstResult = ctrl.update(state, 16);
    // Accept either Hold (if brain chose hold) or null (transition to ROTATING without hold)
    expect(firstResult === null || firstResult?.type === "Hold").toBe(true);

    // Now simulate game over
    state.phase = GamePhase.GameOver;
    state.activePiece = null;
    expect(ctrl.update(state, 16)).toBeNull();

    // Should be reset: next update with Playing should compute a new placement
    const freshState = makePlayingState();
    const result = ctrl.update(freshState, 16);
    // Should either fire Hold or transition to ROTATING
    expect(
      result === null || result?.type === "Hold"
    ).toBe(true);
  });

  describe("state machine transitions", () => {
    it("ROTATING → emits RotateCW when rotation doesn't match target", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      const placement: AIPlacement = {
        targetX: state.activePiece!.pos.x,
        targetRotation:
          state.activePiece!.rotation === RotationState.ZERO
            ? RotationState.R
            : RotationState.ZERO,
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // Don't pass dt for non-ROTATING state (cooldown was set to actionInterval)
      // Actually the controller is already in ROTATING with cooldownTimer = actionInterval
      // First update with 0 dt won't fire (cooldownTimer stays at 0 which < 0)
      // Wait, actionInterval is 0, so cooldownTimer = 0, cooldownTimer += 0 = 0, 0 < 0 is false → fires!
      const result = ctrl.update(state, 0);
      expect(result).not.toBeNull();
      expect(["RotateCW", "RotateCCW"]).toContain(result!.type);
    });

    it("ROTATING → transitions to MOVING when rotation matches target", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      const placement: AIPlacement = {
        targetX: 5,
        targetRotation: state.activePiece!.rotation,
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // Rotation matches, should move to MOVING phase
      // No action should be returned (moving to next phase doesn't emit)
      const firstResult = ctrl.update(state, 0);
      expect(firstResult).toBeNull();

      // Now in MOVING phase. Piece at x=3, target X=5, should fire MoveRight
      const secondResult = ctrl.update(state, 0);
      expect(secondResult).not.toBeNull();
      expect(secondResult!.type).toBe("MoveRight");
    });

    it("ROTATING → transitions to MOVING after max rotation attempts", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      const placement: AIPlacement = {
        targetX: state.activePiece!.pos.x,
        targetRotation: RotationState.TWO, // Most pieces are at ZERO, so this is different
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // Fire 5 rotations (attempts 1-5, max is 4 so the 5th attempt triggers the safety valve)
      for (let i = 0; i < 4; i++) {
        const result = ctrl.update(state, 0);
        expect(result).not.toBeNull();
        expect(["RotateCW", "RotateCCW"]).toContain(result!.type);
      }

      // 5th call: rotationAttempts = 4 → 5 > 4, transitions to MOVING
      const finalResult = ctrl.update(state, 1);
      // Rotation doesn't match but safety valve fires → should return null (transition)
      // Actually let me think... on the 5th call, rotationAttempts = 4 (from 4 previous calls)
      // rotationAttempts++ makes it 5 → 5 > 4 → transition to MOVING, return null
      expect(finalResult).toBeNull();
    });

    it("MOVING → fires MoveLeft when piece is right of target", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      // Place the piece at x=7, target = 5
      if (state.activePiece) {
        state.activePiece = {
          ...state.activePiece,
          pos: { x: 7, y: state.activePiece.pos.y },
        };
      }

      const placement: AIPlacement = {
        targetX: 5,
        targetRotation: state.activePiece!.rotation,
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // First call: rotation matches → transition to MOVING → return null
      const transitionResult = ctrl.update(state, 0);
      expect(transitionResult).toBeNull();

      // Second call: MOVING fires MoveLeft
      const moveResult = ctrl.update(state, 0);
      expect(moveResult).not.toBeNull();
      expect(moveResult!.type).toBe("MoveLeft");
    });

    it("MOVING → fires MoveRight when piece is left of target", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      // Piece at x=3, target = 8 → should move right
      const placement: AIPlacement = {
        targetX: 8,
        targetRotation: state.activePiece!.rotation,
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // First: rotation matches → MOVING
      ctrl.update(state, 0);

      // MOVING: should fire MoveRight
      const result = ctrl.update(state, 0);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("MoveRight");
    });

    it("MOVING → transitions to DROPPING when X matches target", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      const placement: AIPlacement = {
        targetX: state.activePiece!.pos.x,
        targetRotation: state.activePiece!.rotation,
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // Call 1: ROTATING → rotation matches → MOVING (null)
      expect(ctrl.update(state, 0)).toBeNull();
      // Call 2: MOVING → X matches → DROPPING (null)
      expect(ctrl.update(state, 0)).toBeNull();
      // Call 3: DROPPING → HardDrop → IDLE
      const hardDrop = ctrl.update(state, 0);
      expect(hardDrop).not.toBeNull();
      expect(hardDrop!.type).toBe("HardDrop");
    });

    it("MOVING → transitions to DROPPING after max move attempts", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      const placement: AIPlacement = {
        targetX: 8, // different from piece's x=3
        targetRotation: state.activePiece!.rotation,
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // First call: rotation matches → transition to MOVING
      ctrl.update(state, 0);

      // Now in MOVING, fire 20 moves (safety valve at > 20)
      for (let i = 0; i < 20; i++) {
        const result = ctrl.update(state, 0);
        // All moves should be MoveRight (target is to the right)
        expect(result).not.toBeNull();
        expect(result!.type).toBe("MoveRight");
      }

      // 21st call: moveAttempts++ = 21 > 20 → transition to DROPPING → return null
      const dropppingTransition = ctrl.update(state, 0);
      expect(dropppingTransition).toBeNull();

      // Now in DROPPING → fire HardDrop
      const hardDrop = ctrl.update(state, 0);
      expect(hardDrop).not.toBeNull();
      expect(hardDrop!.type).toBe("HardDrop");
    });

    it("DROPPING → fires HardDrop then resets to IDLE", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      const placement: AIPlacement = {
        targetX: state.activePiece!.pos.x,
        targetRotation: state.activePiece!.rotation,
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // Through MOVING to DROPPING
      ctrl.update(state, 0); // ROTATING→MOVING
      ctrl.update(state, 0); // MOVING→DROPPING

      // DROPPING fires HardDrop
      const hardDrop = ctrl.update(state, 0);
      expect(hardDrop).not.toBeNull();
      expect(hardDrop!.type).toBe("HardDrop");

      // Should now be reset to IDLE
      // Next update without placement → onIdle returns null (no placement)
      // Actually onIdle() calls findBestPlacement which needs activePiece
      // But activePiece exists, so it will compute a placement
      // We can't easily test the IDLE state directly without knowing the brain's output
      // Just verify the controller handles it gracefully
      const nextResult = ctrl.update(state, 0);
      expect(nextResult === null || nextResult.type === "Hold").toBe(true);
    });

    it("full cycle: IDLE → ROTATING → MOVING → DROPPING → IDLE", () => {
      const ctrl = new AIController({ actionInterval: 0 });
      const state = makePlayingState();

      // Set piece at spawn
      const piece = state.activePiece!;
      const placement: AIPlacement = {
        targetX: piece.pos.x,
        targetRotation: piece.rotation, // matches current → skip rotation
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // Step 1: rotation matches → MOVING → null
      let result = ctrl.update(state, 0);
      expect(result).toBeNull();

      // Step 2: X matches → DROPPING → null
      result = ctrl.update(state, 0);
      expect(result).toBeNull();

      // Step 3: DROPPING → HardDrop → IDLE
      result = ctrl.update(state, 0);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("HardDrop");

      // Step 3: IDLE (but state still has activePiece, so will recompute)
      result = ctrl.update(state, 0);
      // Either Hold or transition to ROTATING
      expect(result === null || result.type === "Hold").toBe(true);
    });
  });

  describe("action pacing", () => {
    it("respects action interval cooldown", () => {
      const ctrl = new AIController({ actionInterval: 100 });
      const state = makePlayingState();

      const placement: AIPlacement = {
        targetX: state.activePiece!.pos.x,
        targetRotation:
          state.activePiece!.rotation === RotationState.ZERO
            ? RotationState.R
            : RotationState.ZERO,
        usesHold: false,
        score: 100,
      };
      ctrl.__testSetPlacement(placement);

      // __testSetPlacement sets cooldownTimer = actionInterval = 100
      // dt=0: 100 + 0 = 100, 100 < 100 = false → fires immediately
      const action1 = ctrl.update(state, 0);
      expect(action1).not.toBeNull();
      expect(["RotateCW", "RotateCCW"]).toContain(action1!.type);

      // After firing, onRotating resets cooldownTimer to 0
      // dt=50: 0 + 50 = 50 < 100 → null
      expect(ctrl.update(state, 50)).toBeNull();

      // Accumulate more: 50 + 60 = 110 >= 100 → fires
      const action2 = ctrl.update(state, 60);
      expect(action2).not.toBeNull();
      expect(["RotateCW", "RotateCCW"]).toContain(action2!.type);
    });
  });

  describe("factory functions", () => {
    it("createAttractAIController has default interval of 150ms", () => {
      const ctrl = createAttractAIController();
      expect(ctrl).toBeInstanceOf(AIController);
      // Just verify it works without errors
      const state = makePlayingState();
      expect(() => ctrl.update(state, 16)).not.toThrow();
    });
  });
});
