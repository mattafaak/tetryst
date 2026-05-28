import {
  type GameState,
  type Piece,
  type Cell,
  GamePhase,
  GameMode,
  TetriminoType,
  RotationState,
} from "../core/types.ts";
import { createBoard } from "../core/board.ts";
import { resetLockState } from "../core/lock-delay.ts";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../core/constants.ts";
export { pushPopup } from "../core/popups.ts";

/**
 * Create a minimal GameState for testing, with sensible defaults.
 * Override any field via the partial.
 */
export function baseState(overrides?: Partial<GameState>): GameState {
  return {
    board: createBoard(),
    activePiece: null,
    ghostY: 0,
    heldPiece: null,
    hasSwappedThisTurn: false,
    nextQueue: [],
    score: 0,
    level: 0,
    lines: 0,
    effectiveLines: 0,
    combo: 0,
    backToBack: false,
    phase: GamePhase.Menu,
    gravityTimer: 0,
    lockState: resetLockState(),
    entryDelayTimer: 0,
    bag: [],
    lineClearTimer: 0,
    clearedRowIndices: [],
    mode: GameMode.Marathon,
    modeTimer: 0,
    popups: [],
    ...overrides,
  };
}

/**
 * Create a GameState in the Playing phase with an I-piece active at (3, 20),
 * a populated next queue, and a non-empty bag.
 */
export function playingState(overrides?: Partial<GameState>): GameState {
  return baseState({
    phase: GamePhase.Playing,
    activePiece: makePiece(TetriminoType.I, 3, 20, RotationState.ZERO),
    lockState: { timer: 0, resets: 0, onGround: false, lowestY: 20, lastRotationKickIndex: null },
    gravityTimer: 0,
    nextQueue: [
      { type: TetriminoType.T },
      { type: TetriminoType.O },
      { type: TetriminoType.S },
      { type: TetriminoType.Z },
      { type: TetriminoType.J },
    ],
    bag: [TetriminoType.L, TetriminoType.I],
    ...overrides,
  });
}

/**
 * Create a Piece with sensible defaults (I-piece at (3, 20), ZERO rotation).
 */
export function makePiece(
  type: TetriminoType = TetriminoType.I,
  x = 3,
  y = 20,
  rot: RotationState = RotationState.ZERO,
): Piece {
  return { type, pos: { x, y }, rotation: rot };
}

/**
 * Fill the bottom n rows of a board with TetriminoType.I cells.
 * If no board is provided, a fresh createBoard() is used.
 */
export function fillRows(n: number, board?: Cell[][]): Cell[][] {
  const b = board ?? createBoard();
  for (let i = 0; i < n; i++) {
    const row = b[BOARD_HEIGHT - 1 - i];
    for (let x = 0; x < BOARD_WIDTH; x++) {
      row[x] = TetriminoType.I;
    }
  }
  return b;
}
