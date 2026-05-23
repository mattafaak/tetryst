import { describe, it, expect } from "vitest";
import { processAction } from "./actions.ts";
import { GamePhase, TetriminoType, RotationState } from "./types.ts";
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
    // Fill row 22 so I-piece at y=20 (fills row 21 in rotation 0) cannot descend
    board[22] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const state = baseState({
      board,
      activePiece: makePiece(20),
    });
    const next = processAction(state, { type: "SoftDrop" });
    expect(next).toBe(state);
  });
});
