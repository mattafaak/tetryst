import {
  type Board,
  type Piece,
  type GameState,
  type Cell,
  TetriminoType,
  RotationState,
  GamePhase,
  GameMode,
} from "../core/types.ts";
import { createBoard } from "../core/board.ts";
import { resetLockState } from "../core/lock-delay.ts";
import { BOARD_WIDTH, BOARD_HEIGHT, PIECE_SHAPES } from "../core/constants.ts";

/**
 * Parse an ASCII art string into a Board.
 *
 * Each character represents one cell:
 *   . = empty
 *   I, O, T, S, Z, J, L, X = occupied (stored as that string)
 *
 * First line = row 0 (top of buffer), last line = row BOARD_HEIGHT-1 (bottom of visible).
 * If the input has fewer lines than BOARD_HEIGHT, the top rows are filled as empty.
 * Each line is padded/truncated to BOARD_WIDTH.
 */
export function asciiBoard(ascii: string): Board {
  const lines = ascii.trim().split("\n");
  const board: Board = [];

  // Calculate leading empty rows if input is shorter than full board
  const inputRows = lines.length;
  const leadingEmpty = BOARD_HEIGHT - inputRows;

  for (let i = 0; i < leadingEmpty; i++) {
    board.push(Array<Cell>(BOARD_WIDTH).fill(null));
  }

  for (const line of lines) {
    const row: Cell[] = [];
    for (let c = 0; c < BOARD_WIDTH; c++) {
      const ch = line[c] ?? ".";
      row.push(ch === "." || ch === " " ? null : ch.toUpperCase());
    }
    board.push(row);
  }

  return board;
}

/**
 * Convert a Board to an ASCII art string (rows bottom-to-top for readability).
 * Useful for debugging test failures.
 * If visibleOnly is true, only the bottom 20 rows (visible area) are shown.
 */
export function boardToAscii(board: Board, visibleOnly = false): string {
  const start = visibleOnly ? BOARD_HEIGHT - 20 : 0;
  const lines: string[] = [];
  for (let r = start; r < BOARD_HEIGHT; r++) {
    let line = "";
    for (let c = 0; c < BOARD_WIDTH; c++) {
      line += board[r][c] ?? ".";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

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
    combo: -1,
    backToBack: false,
    phase: GamePhase.Menu,
    gravityTimer: 0,
    lockState: resetLockState(),
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

/**
 * Fill the bottom n rows of a board completely (all cells occupied).
 * Returns a new board; does not mutate the original.
 */
export function fillRows(board: Board, n: number): Board {
  const newBoard: Board = board.map((row) => [...row]);
  for (let r = BOARD_HEIGHT - n; r < BOARD_HEIGHT; r++) {
    for (let c = 0; c < BOARD_WIDTH; c++) {
      newBoard[r][c] = TetriminoType.I;
    }
  }
  return newBoard;
}

/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Generate a random board for fuzz testing.
 * Each cell has `fillProb` chance of being occupied (default 0.3).
 * Uses Math.random internally; fast-check tests should pass their own RNG.
 */
export function randomBoard(fillProb = 0.3): Board {
  const board: Board = [];
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < BOARD_WIDTH; c++) {
      row.push(Math.random() < fillProb ? TetriminoType.I : null);
    }
    board.push(row);
  }
  return board;
}

/**
 * Generate a random Piece for fuzz testing.
 */
export function randomPiece(): Piece {
  const types = Object.values(TetriminoType);
  const type = types[Math.floor(Math.random() * types.length)];
  const rotation = Math.floor(Math.random() * 4) as RotationState;
  const x = Math.floor(Math.random() * BOARD_WIDTH);
  const y = Math.floor(Math.random() * BOARD_HEIGHT);
  return { type, pos: { x, y }, rotation };
}

/**
 * Get all valid spawn positions for a piece type at a given rotation.
 * Returns x values where the piece fits within the board width.
 */
export function validSpawnXs(type: TetriminoType, rotation: RotationState): number[] {
  const shape = PIECE_SHAPES[type][rotation];
  let width = 0;
  for (let c = 0; c < shape[0].length; c++) {
    for (let r = 0; r < shape.length; r++) {
      if (shape[r][c]) { width = Math.max(width, c + 1); break; }
    }
  }
  const result: number[] = [];
  for (let x = 0; x <= BOARD_WIDTH - width; x++) result.push(x);
  return result;
}
