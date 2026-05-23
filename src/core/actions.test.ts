import { describe, it, expect } from "vitest";
import { processAction } from "./actions.ts";
import { GamePhase, TetriminoType, RotationState , GameMode } from "./types.ts";
import type { GameState } from "./types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT } from "./constants.ts";

function emptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<string | null>(BOARD_WIDTH).fill(null),
  );
}

function makePiece(y: number) {
  return {
    type: TetriminoType.I,
    pos: { x: 3, y },
    rotation: RotationState.ZERO,
  };
}

function baseState(overrides?: Partial<GameState>): GameState {
  return {
    board: emptyBoard(),
    activePiece: makePiece(20),
    ghostY: 30,
    heldPiece: null,
    hasSwappedThisTurn: false,
    nextQueue: [],
    score: 0,
    level: 0,
    lines: 0,
    combo: -1,
    backToBack: false,
    phase: GamePhase.Playing,
    gravityTimer: 0,
    lockState: { timer: 0, resets: 5, onGround: false, lowestY: 20 },
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

describe("handleSoftDrop", () => {
  it("resets lock resets counter when piece descends to new lowest Y", () => {
    const state = baseState({
      lockState: { timer: 200, resets: 10, onGround: false, lowestY: 20 },
      activePiece: makePiece(20),
    });
    const next = processAction(state, { type: "SoftDrop" });
    expect(next.activePiece?.pos.y).toBe(21);
    expect(next.lockState.lowestY).toBe(21);
    expect(next.lockState.resets).toBe(0);
    expect(next.lockState.timer).toBe(200); // timer preserved, only resets zeroed
    expect(next.score).toBe(1); // 1 point per cell soft-dropped
  });

  it("does not change state when piece is blocked from moving down", () => {
    const board = emptyBoard();
    // I-piece at y=20 in rotation ZERO has minos at shape row 1 → board row 21.
    // Moving to y=21 would put minos at board row 22. Fill row 22 to block descent.
    board[22] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const state = baseState({
      board,
      activePiece: makePiece(20),
    });
    const next = processAction(state, { type: "SoftDrop" });
    expect(next).toBe(state);
  });
});

describe("handleHardDrop", () => {
  it("transitions to GameOver when piece locks entirely in buffer zone (Lock-Out)", () => {
    // I-piece rotation ZERO: minos at shape row 1. At pos.y=18, row 1 lands at board row 19.
    // Board row 19 is in the buffer zone (row < BUFFER_HEIGHT=20).
    // If board row 20 is full, the piece can't drop further and locks at y=18 (all in buffer).
    const board = emptyBoard();
    board[20] = Array(BOARD_WIDTH).fill(TetriminoType.Z); // skyline blocked
    const state = baseState({
      board,
      activePiece: makePiece(18), // I-piece at y=18, can't drop (row 20 is full)
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 18 },
    });
    const next = processAction(state, { type: "HardDrop" });
    expect(next.phase).toBe(GamePhase.GameOver);
    expect(next.activePiece).toBeNull();
  });
});
