import { describe, it, expect } from "vitest";
import { processAction } from "./actions.ts";
import { spawnNextPiece } from "./state.ts";
import { GamePhase, TetriminoType, RotationState } from "./types.ts";
import { baseState } from "../test-utils/test-utils.ts";

function playState(currentPieceKeypresses = 0) {
  return baseState({
    phase: GamePhase.Playing,
    activePiece: { type: TetriminoType.T, pos: { x: 3, y: 10 }, rotation: RotationState.ZERO },
    lockState: { timer: 0, resets: 0, onGround: false, lowestY: 10, lastRotationKickIndex: null },
    nextQueue: [{ type: TetriminoType.O }, { type: TetriminoType.I }],
    bag: [TetriminoType.L, TetriminoType.S, TetriminoType.Z, TetriminoType.J, TetriminoType.T],
    currentPieceKeypresses,
  });
}

describe("currentPieceKeypresses — increments for Move*/Rotate* only", () => {
  it("MoveLeft increments currentPieceKeypresses", () => {
    const s = processAction(playState(), { type: "MoveLeft" });
    expect(s.currentPieceKeypresses).toBe(1);
  });
  it("MoveRight increments currentPieceKeypresses", () => {
    const s = processAction(playState(), { type: "MoveRight" });
    expect(s.currentPieceKeypresses).toBe(1);
  });
  it("RotateCW increments currentPieceKeypresses", () => {
    const s = processAction(playState(), { type: "RotateCW" });
    expect(s.currentPieceKeypresses).toBe(1);
  });
  it("RotateCCW increments currentPieceKeypresses", () => {
    const s = processAction(playState(), { type: "RotateCCW" });
    expect(s.currentPieceKeypresses).toBe(1);
  });
  it("accumulates across multiple actions", () => {
    let s = processAction(playState(0), { type: "MoveLeft" });
    s = processAction(s, { type: "MoveLeft" });
    s = processAction(s, { type: "RotateCW" });
    expect(s.currentPieceKeypresses).toBe(3);
  });
});

describe("currentPieceKeypresses — does NOT increment for excluded actions", () => {
  it("HardDrop does NOT increment currentPieceKeypresses (stays at pre-lock value until next spawn)", () => {
    // After hard drop the piece locks but spawnNextPiece hasn't been called yet.
    // currentPieceKeypresses stays at the value it had going into the lock.
    const s = processAction(
      baseState({
        phase: GamePhase.Playing,
        activePiece: { type: TetriminoType.T, pos: { x: 3, y: 5 }, rotation: RotationState.ZERO },
        lockState: { timer: 0, resets: 0, onGround: false, lowestY: 5, lastRotationKickIndex: null },
        nextQueue: [{ type: TetriminoType.O }],
        bag: [TetriminoType.L],
        currentPieceKeypresses: 2,
      }),
      { type: "HardDrop" },
    );
    // HardDrop is in KEYPRESS_COUNTED_ACTIONS for totalKeypresses but NOT in PIECE_NAV_ACTIONS
    // so currentPieceKeypresses should remain 2 (not 3, not 0)
    expect(s.currentPieceKeypresses).toBe(2);
  });
  it("SoftDrop does NOT increment currentPieceKeypresses", () => {
    const s = processAction(playState(5), { type: "SoftDrop" });
    expect(s.currentPieceKeypresses).toBe(5);
  });
  it("Hold does NOT increment currentPieceKeypresses", () => {
    const s = processAction(playState(3), { type: "Hold" });
    // Hold spawns new piece — currentPieceKeypresses resets to 0
    expect(s.currentPieceKeypresses).toBe(0);
  });
});

describe("currentPieceKeypresses — resets on piece spawn", () => {
  it("spawnNextPiece resets currentPieceKeypresses to 0", () => {
    const state = baseState({
      phase: GamePhase.EntryDelay,
      currentPieceKeypresses: 7,
      nextQueue: [{ type: TetriminoType.T }, { type: TetriminoType.O }],
      bag: [TetriminoType.L, TetriminoType.S, TetriminoType.Z, TetriminoType.J],
    });
    const spawned = spawnNextPiece(state);
    expect(spawned.currentPieceKeypresses).toBe(0);
  });

  it("counter is 0 at start of each piece (not accumulated from previous piece)", () => {
    const state1 = baseState({
      phase: GamePhase.EntryDelay,
      currentPieceKeypresses: 10,
      nextQueue: [{ type: TetriminoType.T }, { type: TetriminoType.O }],
      bag: [TetriminoType.L, TetriminoType.S, TetriminoType.Z, TetriminoType.J],
    });
    const state2 = spawnNextPiece(state1);
    expect(state2.currentPieceKeypresses).toBe(0);

    // Make moves on new piece
    const state3 = processAction(
      { ...state2, phase: GamePhase.Playing },
      { type: "MoveLeft" },
    );
    expect(state3.currentPieceKeypresses).toBe(1);
  });
});
