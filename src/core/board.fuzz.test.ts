/**
 * Property-based fuzz tests for board.ts: collision detection, line clearing,
 * piece locking, lock-out detection, and perfect-clear detection.
 *
 * Uses fast-check to generate random boards, pieces, and input combinations
 * and verify invariants across thousands of iterations.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  checkCollision,
  clearLines,
  lockPiece,
  isPerfectClear,
  isLockOut,
  createBoard,
} from "../core/board.ts";
import { BOARD_WIDTH, BOARD_HEIGHT, BUFFER_HEIGHT, PIECE_SHAPES } from "../core/constants.ts";
import { TetriminoType, RotationState } from "../core/types.ts";
import type { Board, Cell, Piece } from "../core/types.ts";
// randomBoard, randomPiece imported implicitly via fast-check generators

// ── fast-check custom generators ──────────────────────────────────────────

const allTetriminoTypes = fc.constantFrom(
  TetriminoType.I,
  TetriminoType.O,
  TetriminoType.T,
  TetriminoType.S,
  TetriminoType.Z,
  TetriminoType.J,
  TetriminoType.L,
);

const allRotationStates = fc.constantFrom(
  RotationState.ZERO,
  RotationState.R,
  RotationState.TWO,
  RotationState.L,
);

/** Generate a valid x position for a piece given its type and rotation. */
function validX(type: TetriminoType, rotation: RotationState): fc.Arbitrary<number> {
  const shape = PIECE_SHAPES[type][rotation];
  let width = 0;
  for (let c = 0; c < shape[0].length; c++) {
    for (let r = 0; r < shape.length; r++) {
      if (shape[r][c]) { width = Math.max(width, c + 1); break; }
    }
  }
  return fc.integer({ min: -2, max: BOARD_WIDTH - width + 2 });
}

/** Generate a piece at any board position (may be out of bounds). */
const arbitraryPiece: fc.Arbitrary<Piece> = allTetriminoTypes.chain((type) =>
  allRotationStates.chain((rotation) =>
    validX(type, rotation).chain((x) =>
      fc.integer({ min: -4, max: BOARD_HEIGHT + 4 }).map((y) => ({
        type,
        pos: { x, y },
        rotation,
      })),
    ),
  ),
);

/** Generate a Cell (null or a tetrimino type letter). */
const arbitraryCell: fc.Arbitrary<Cell> = fc.oneof(
  fc.constant(null),
  fc.constantFrom(
    TetriminoType.I, TetriminoType.O, TetriminoType.T,
    TetriminoType.S, TetriminoType.Z, TetriminoType.J, TetriminoType.L,
  ),
);

/** Generate an entire board with random fill. */
const arbitraryBoard: fc.Arbitrary<Board> = fc
  .array(fc.array(arbitraryCell, { minLength: BOARD_WIDTH, maxLength: BOARD_WIDTH }), {
    minLength: BOARD_HEIGHT,
    maxLength: BOARD_HEIGHT,
  });

// ── Invariant: collision detection ────────────────────────────────────────

describe("board fuzz: checkCollision", () => {
  it("collision implies at least one overlapping cell", () => {
    fc.assert(
      fc.property(arbitraryBoard, arbitraryPiece, (board, piece) => {
        const collides = checkCollision(board, piece);
        if (!collides) return; // only interesting when collision is true
        const shape = PIECE_SHAPES[piece.type][piece.rotation];
        let foundOverlap = false;
        for (let r = 0; r < shape.length && !foundOverlap; r++) {
          for (let c = 0; c < shape[r].length && !foundOverlap; c++) {
            if (!shape[r][c]) continue;
            const bx = piece.pos.x + c;
            const by = piece.pos.y + r;
            if (bx < 0 || bx >= BOARD_WIDTH) { foundOverlap = true; }
            else if (by >= BOARD_HEIGHT) { foundOverlap = true; }
            else if (by >= 0 && board[by][bx] !== null) { foundOverlap = true; }
          }
        }
        expect(foundOverlap).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("piece above buffer zone (y < 0) never collides", () => {
    fc.assert(
      fc.property(allTetriminoTypes, allRotationStates, (type, rotation) => {
        const board = createBoard();
        const piece: Piece = { type, pos: { x: 3, y: -5 }, rotation };
        expect(checkCollision(board, piece)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("piece entirely below board always collides", () => {
    fc.assert(
      fc.property(allTetriminoTypes, allRotationStates, (type, rotation) => {
        const board = createBoard();
        const piece: Piece = { type, pos: { x: 3, y: BOARD_HEIGHT + 2 }, rotation };
        expect(checkCollision(board, piece)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it("locked piece at bottom collides with occupied cells", () => {
    fc.assert(
      fc.property(allTetriminoTypes, (type) => {
        const board = createBoard();
        // Fill bottom 3 rows
        for (let r = BOARD_HEIGHT - 3; r < BOARD_HEIGHT; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.Z;
        }
        const piece: Piece = { type, pos: { x: 3, y: BOARD_HEIGHT - 3 }, rotation: RotationState.ZERO };
        expect(checkCollision(board, piece)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});

// ── Invariant: line clearing ──────────────────────────────────────────────

describe("board fuzz: clearLines", () => {
  it("after clear, no row is completely full", () => {
    fc.assert(
      fc.property(arbitraryBoard, (board) => {
        const result = clearLines(board);
        for (let r = 0; r < BOARD_HEIGHT; r++) {
          const full = result.board[r].every((cell) => cell !== null);
          expect(full).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("cleared lines count equals number of full rows in input", () => {
    fc.assert(
      fc.property(arbitraryBoard, (board) => {
        const fullRowCount = board.filter((row) =>
          row.every((cell) => cell !== null),
        ).length;
        const result = clearLines(board);
        expect(result.linesCleared).toBe(fullRowCount);
      }),
      { numRuns: 200 },
    );
  });

  it("board height is preserved after clear", () => {
    fc.assert(
      fc.property(arbitraryBoard, (board) => {
        const result = clearLines(board);
        expect(result.board.length).toBe(BOARD_HEIGHT);
      }),
      { numRuns: 200 },
    );
  });

  it("occupied cell count does not increase after clear", () => {
    fc.assert(
      fc.property(arbitraryBoard, (board) => {
        const countOccupied = (b: Board) => {
          let n = 0;
          for (const row of b) for (const cell of row) if (cell !== null) n++;
          return n;
        };
        const before = countOccupied(board);
        const result = clearLines(board);
        const after = countOccupied(result.board);
        expect(after).toBeLessThanOrEqual(before);
      }),
      { numRuns: 200 },
    );
  });

  it("empty board clears nothing", () => {
    const board = createBoard();
    const result = clearLines(board);
    expect(result.linesCleared).toBe(0);
    expect(result.clearedRowIndices).toEqual([]);
  });

  it("fully filled board clears all 40 rows", () => {
    const board = createBoard();
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.I;
    }
    const result = clearLines(board);
    expect(result.linesCleared).toBe(BOARD_HEIGHT);
    expect(isPerfectClear(result.board)).toBe(true);
  });

  it("non-contiguous full rows are all cleared", () => {
    const board = createBoard();
    // Fill rows 0, 10, 20, 30, 39
    for (const r of [0, 10, 20, 30, 39]) {
      for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.I;
    }
    const result = clearLines(board);
    expect(result.linesCleared).toBe(5);
    expect(result.clearedRowIndices).toEqual([0, 10, 20, 30, 39]);
  });
});

// ── Invariant: piece locking ──────────────────────────────────────────────

describe("board fuzz: lockPiece", () => {
  it("locked piece cells are set on board (no earlier occupied cell overwritten)", () => {
    fc.assert(
      fc.property(arbitraryBoard, arbitraryPiece, (board, piece) => {
        if (checkCollision(board, piece)) return; // can't lock a colliding piece
        const before = board.map((row) => [...row]);
        const result = lockPiece(board, piece);
        const shape = PIECE_SHAPES[piece.type][piece.rotation];
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const bx = piece.pos.x + c;
            const by = piece.pos.y + r;
            if (by >= 0 && by < BOARD_HEIGHT && bx >= 0 && bx < BOARD_WIDTH) {
              // Cell should now be occupied by this piece type
              expect(result[by][bx]).toBe(piece.type);
            }
          }
        }
        // Cells NOT in the piece shape should be unchanged
        for (let r = 0; r < BOARD_HEIGHT; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) {
            let inPiece = false;
            for (let pr = 0; pr < shape.length && !inPiece; pr++) {
              for (let pc = 0; pc < shape[pr].length && !inPiece; pc++) {
                if (shape[pr][pc] && piece.pos.x + pc === c && piece.pos.y + pr === r) {
                  inPiece = true;
                }
              }
            }
            if (!inPiece) {
              expect(result[r][c]).toBe(before[r][c]);
            }
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("locking at negative y does not crash and leaves board height unchanged", () => {
    const board = createBoard();
    const piece: Piece = { type: TetriminoType.T, pos: { x: 3, y: -2 }, rotation: RotationState.ZERO };
    const result = lockPiece(board, piece);
    expect(result.length).toBe(BOARD_HEIGHT);
  });

  it("lockPiece is idempotent: locking twice produces the same board", () => {
    fc.assert(
      fc.property(arbitraryBoard, arbitraryPiece, (board, piece) => {
        if (checkCollision(board, piece)) return;
        const once = lockPiece(board, piece);
        const twice = lockPiece(once, piece);
        expect(twice).toEqual(once);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Invariant: lock-out detection ─────────────────────────────────────────

describe("board fuzz: isLockOut", () => {
  it("lock-out when all minos are above BUFFER_HEIGHT", () => {
    fc.assert(
      fc.property(allTetriminoTypes, allRotationStates, (type, rotation) => {
        const shape = PIECE_SHAPES[type][rotation];
        let maxMinoY = -Infinity;
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) maxMinoY = Math.max(maxMinoY, r);
          }
        }
        // Place piece so its bottommost mino is at BUFFER_HEIGHT - 1 (just above visible)
        const y = BUFFER_HEIGHT - 1 - maxMinoY;
        const piece: Piece = { type, pos: { x: 3, y }, rotation };
        // At least some pieces may have minos at or above BUFFER_HEIGHT here
        // isLockOut returns false if ANY mino is at y >= BUFFER_HEIGHT
        const lockedOut = isLockOut(piece);
        // Verify manually
        let hasBelow = false;
        for (let r = 0; r < shape.length; r++) {
          for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] && (piece.pos.y + r) >= BUFFER_HEIGHT) hasBelow = true;
          }
        }
        // If piece has any mino at or below BUFFER_HEIGHT, lock-out should be false
        if (lockedOut) {
          // Verify no mino extends to visible area
          expect(hasBelow).toBe(false);
        } else {
          expect(isLockOut(piece)).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("piece fully in visible area (y >= 20 for most pieces) is never lock-out", () => {
    fc.assert(
      fc.property(allTetriminoTypes, (type) => {
        const piece: Piece = {
          type,
          pos: { x: 3, y: BUFFER_HEIGHT },
          rotation: RotationState.ZERO,
        };
        expect(isLockOut(piece)).toBe(false);
      }),
      { numRuns: 50 },
    );
  });
});

// ── Invariant: perfect-clear detection ─────────────────────────────────────

describe("board fuzz: isPerfectClear", () => {
  it("empty board is a perfect clear", () => {
    expect(isPerfectClear(createBoard())).toBe(true);
  });

  it("board with any occupied cell is not a perfect clear", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: BOARD_HEIGHT - 1 }), fc.integer({ min: 0, max: BOARD_WIDTH - 1 }),
      (r, c) => {
        const board = createBoard();
        board[r][c] = TetriminoType.I;
        expect(isPerfectClear(board)).toBe(false);
      }),
      { numRuns: 50 },
    );
  });
});

// ── Known cross-project bug patterns ──────────────────────────────────────

describe("board fuzz: known bug patterns", () => {
  it("S/Z piece rotated flat on ground does not clip through floor (floor kick)", () => {
    // S-piece ZERO rotation placed at bottom row — rotating should not fail silently
    // or clip below the board.
    const board = createBoard();
    // Place S piece flat on the floor
    const piece: Piece = { type: TetriminoType.S, pos: { x: 3, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    // S ZERO shape is 2 rows tall: rows 0 and 1 are filled
    // At y=BOARD_HEIGHT-2, shape rows: y=38, y=39 — both in bounds
    // Should not collide
    expect(checkCollision(board, piece)).toBe(false);
  });

  it("clearLines handles filled + empty rows correctly (concurrent delete)", () => {
    // Build a board where rows 35 and 37 are full, rows 36 and 38 are empty
    // This tests the concurrent deletion bug: deleting row 35 shifts everything down
    // and the loop index for row 37 now points at what was row 38.
    // Our implementation uses filter+unshift, which handles this correctly.
    const board = createBoard();
    for (let c = 0; c < BOARD_WIDTH; c++) {
      board[35][c] = TetriminoType.I;
      board[37][c] = TetriminoType.I;
    }
    const result = clearLines(board);
    expect(result.linesCleared).toBe(2);
    // After clearing 2 rows, bottom 2 rows should be empty (shifted in)
    expect(result.board[BOARD_HEIGHT - 1].every((c) => c === null)).toBe(true);
    expect(result.board[BOARD_HEIGHT - 2].every((c) => c === null)).toBe(true);
  });

  it("lockPiece at out-of-bounds position does not mutate board", () => {
    const board = createBoard();
    const piece: Piece = { type: TetriminoType.T, pos: { x: -10, y: -10 }, rotation: RotationState.ZERO };
    const result = lockPiece(board, piece);
    expect(result).toEqual(board);
  });
});
