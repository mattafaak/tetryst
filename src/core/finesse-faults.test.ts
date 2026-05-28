import { describe, it, expect } from "vitest";
import { executeLock } from "./lock.ts";
import { lockPiece, createBoard } from "./board.ts";
import { TetriminoType, RotationState, GamePhase } from "./types.ts";
import { BOARD_HEIGHT } from "./constants.ts";
import { baseState } from "../test-utils/test-utils.ts";
import { canonicalKeypresses } from "./finesse.ts";

// T-piece spawns at x=3, RotationState.ZERO — canonical keypresses = 0
const T_SPAWN_X = 3;
const T_SPAWN_ROT = RotationState.ZERO;
const LOCK_Y = BOARD_HEIGHT - 3; // near bottom, avoids lock-out

function makePiece(
  type: TetriminoType,
  x: number,
  rotation: RotationState = RotationState.ZERO,
) {
  return { type, pos: { x, y: LOCK_Y }, rotation };
}

function lockAndExecute(
  type: TetriminoType,
  x: number,
  rotation: RotationState,
  currentPieceKeypresses: number,
  finesseFaults = 0,
) {
  const piece = makePiece(type, x, rotation);
  const board = lockPiece(createBoard(), piece);
  const state = baseState({
    phase: GamePhase.Playing,
    lockState: { timer: 0, resets: 0, onGround: true, lowestY: LOCK_Y, lastRotationKickIndex: null },
    board,
    currentPieceKeypresses,
    finesseFaults,
  });
  return executeLock(state, piece);
}

describe("finesse fault detection — no fault when at canonical cost", () => {
  it("T at spawn position (canonical=0) with 0 keypresses → no fault", () => {
    const canonical = canonicalKeypresses(TetriminoType.T, T_SPAWN_ROT, T_SPAWN_X);
    expect(canonical).toBe(0);
    const result = lockAndExecute(TetriminoType.T, T_SPAWN_X, T_SPAWN_ROT, 0);
    expect(result.state.finesseFaults).toBe(0);
  });

  it("T moved 1 left (canonical=1) with 1 keypress → no fault", () => {
    const x = T_SPAWN_X - 1;
    const canonical = canonicalKeypresses(TetriminoType.T, T_SPAWN_ROT, x);
    expect(canonical).toBe(1);
    const result = lockAndExecute(TetriminoType.T, x, T_SPAWN_ROT, 1);
    expect(result.state.finesseFaults).toBe(0);
  });

  it("T moved 1 right (canonical=1) with 1 keypress → no fault", () => {
    const x = T_SPAWN_X + 1;
    const canonical = canonicalKeypresses(TetriminoType.T, T_SPAWN_ROT, x);
    expect(canonical).toBe(1);
    const result = lockAndExecute(TetriminoType.T, x, T_SPAWN_ROT, 1);
    expect(result.state.finesseFaults).toBe(0);
  });
});

describe("finesse fault detection — fault when over canonical cost", () => {
  it("T at spawn position (canonical=0) with 1 keypress → fault", () => {
    const result = lockAndExecute(TetriminoType.T, T_SPAWN_X, T_SPAWN_ROT, 1);
    expect(result.state.finesseFaults).toBe(1);
  });

  it("T at spawn position (canonical=0) with 3 keypresses → fault (counts as 1 per piece)", () => {
    const result = lockAndExecute(TetriminoType.T, T_SPAWN_X, T_SPAWN_ROT, 3);
    expect(result.state.finesseFaults).toBe(1);
  });

  it("T moved 1 left (canonical=1) with 2 keypresses → fault", () => {
    const x = T_SPAWN_X - 1;
    const result = lockAndExecute(TetriminoType.T, x, T_SPAWN_ROT, 2);
    expect(result.state.finesseFaults).toBe(1);
  });
});

describe("finesse fault detection — accumulates across pieces", () => {
  it("second fault increments from existing finesseFaults count", () => {
    const result = lockAndExecute(TetriminoType.T, T_SPAWN_X, T_SPAWN_ROT, 2, 5);
    expect(result.state.finesseFaults).toBe(6);
  });

  it("no fault with existing faults leaves count unchanged", () => {
    const result = lockAndExecute(TetriminoType.T, T_SPAWN_X, T_SPAWN_ROT, 0, 3);
    expect(result.state.finesseFaults).toBe(3);
  });
});

describe("finesse fault detection — piecesPlaced still increments", () => {
  it("piecesPlaced increments on fault", () => {
    const result = lockAndExecute(TetriminoType.T, T_SPAWN_X, T_SPAWN_ROT, 5);
    expect(result.state.piecesPlaced).toBe(1);
    expect(result.state.finesseFaults).toBe(1);
  });

  it("piecesPlaced increments on no fault", () => {
    const result = lockAndExecute(TetriminoType.T, T_SPAWN_X, T_SPAWN_ROT, 0);
    expect(result.state.piecesPlaced).toBe(1);
    expect(result.state.finesseFaults).toBe(0);
  });
});
