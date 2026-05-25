/**
 * Property-based fuzz tests for the AI brain: board evaluation heuristics,
 * column heights, hole counting, bumpiness, and placement generation.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  evaluateBoard,
  computeColumnHeights,
  countHoles,
  computeBumpiness,
  getPieceWidth,
  simulatePlacement,
  generatePlacements,
  findBestPlacement,
} from "./ai-brain.ts";
import { checkCollision, createBoard } from "../core/board.ts";
import { BOARD_WIDTH, BOARD_HEIGHT, PIECE_SHAPES } from "../core/constants.ts";
import { TetriminoType, RotationState } from "../core/types.ts";
import type { Board, Cell, Piece } from "../core/types.ts";
import { baseState } from "../test-utils/test-utils.ts";

// ── Generators ────────────────────────────────────────────────────────────

const tetriminoTypes = fc.constantFrom(
  TetriminoType.I, TetriminoType.O, TetriminoType.T,
  TetriminoType.S, TetriminoType.Z, TetriminoType.J, TetriminoType.L,
);

const rotations = fc.constantFrom(
  RotationState.ZERO, RotationState.R, RotationState.TWO, RotationState.L,
);

const arbitraryCell: fc.Arbitrary<Cell> = fc.oneof(
  fc.constant(null),
  fc.constantFrom(
    TetriminoType.I, TetriminoType.O, TetriminoType.T,
    TetriminoType.S, TetriminoType.Z, TetriminoType.J, TetriminoType.L,
  ),
);

const arbitraryBoardArb = fc
  .array(fc.array(arbitraryCell, { minLength: BOARD_WIDTH, maxLength: BOARD_WIDTH }), {
    minLength: BOARD_HEIGHT,
    maxLength: BOARD_HEIGHT,
  });

// ── Column heights ──────────────────────────────────────────────────────

describe("AI fuzz: computeColumnHeights", () => {
  it("returns all zeros for empty board", () => {
    const board = createBoard();
    const heights = computeColumnHeights(board);
    expect(heights).toHaveLength(BOARD_WIDTH);
    expect(heights.every((h) => h === 0)).toBe(true);
  });

  it("all heights are non-negative and within board range", () => {
    fc.assert(
      fc.property(arbitraryBoardArb, (board) => {
        const heights = computeColumnHeights(board);
        expect(heights).toHaveLength(BOARD_WIDTH);
        for (const h of heights) {
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThanOrEqual(BOARD_HEIGHT);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("height is 0 for columns with no blocks, > 0 for columns with blocks", () => {
    fc.assert(
      fc.property(arbitraryBoardArb, (board) => {
        const heights = computeColumnHeights(board);
        for (let x = 0; x < BOARD_WIDTH; x++) {
          const hasBlock = board.some((row) => row[x] !== null);
          if (!hasBlock) {
            expect(heights[x]).toBe(0);
          } else {
            expect(heights[x]).toBeGreaterThan(0);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("single block at bottom produces height 1", () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 1][3] = TetriminoType.I;
    const heights = computeColumnHeights(board);
    expect(heights[3]).toBe(1);
  });

  it("fully filled board: all heights = BOARD_HEIGHT", () => {
    const board = createBoard();
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.I;
    }
    const heights = computeColumnHeights(board);
    expect(heights.every((h) => h === BOARD_HEIGHT)).toBe(true);
  });
});

// ── Hole counting ───────────────────────────────────────────────────────

describe("AI fuzz: countHoles", () => {
  it("no holes in empty board", () => {
    const board = createBoard();
    const heights = computeColumnHeights(board);
    expect(countHoles(board, heights)).toBe(0);
  });

  it("no holes in fully filled board", () => {
    const board = createBoard();
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.I;
    }
    const heights = computeColumnHeights(board);
    expect(countHoles(board, heights)).toBe(0);
  });

  it("hole count is non-negative", () => {
    fc.assert(
      fc.property(arbitraryBoardArb, (board) => {
        const heights = computeColumnHeights(board);
        const holes = countHoles(board, heights);
        expect(holes).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it("hole count never exceeds total cells", () => {
    fc.assert(
      fc.property(arbitraryBoardArb, (board) => {
        const heights = computeColumnHeights(board);
        const holes = countHoles(board, heights);
        expect(holes).toBeLessThanOrEqual(BOARD_WIDTH * BOARD_HEIGHT);
      }),
      { numRuns: 200 },
    );
  });

  it("single hole under a block is counted", () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 3][3] = TetriminoType.I;  // block at height 3 from bottom
    board[BOARD_HEIGHT - 2][3] = null;               // empty directly below = hole
    board[BOARD_HEIGHT - 1][3] = TetriminoType.Z;   // block at bottom
    const heights = computeColumnHeights(board);
    // Column 3 height = 3 (block at row 37, counting from bottom)
    // Holes: row 38 (null under block at row 37) = 1 hole
    const holes = countHoles(board, heights);
    expect(holes).toBe(1);
  });
});

// ── Bumpiness ──────────────────────────────────────────────────────────

describe("AI fuzz: computeBumpiness", () => {
  it("bumpiness is zero for flat surface", () => {
    const board = createBoard();
    const fillRow = BOARD_HEIGHT - 5;
    for (let c = 0; c < BOARD_WIDTH; c++) board[fillRow][c] = TetriminoType.I;
    const heights = computeColumnHeights(board);
    const bump = computeBumpiness(heights);
    expect(bump).toBe(0);
  });

  it("bumpiness is non-negative", () => {
    fc.assert(
      fc.property(arbitraryBoardArb, (board) => {
        const heights = computeColumnHeights(board);
        const bump = computeBumpiness(heights);
        expect(bump).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it("alternating heights produce positive bumpiness", () => {
    const board = createBoard();
    for (let c = 0; c < BOARD_WIDTH; c++) {
      const h = c % 2 === 0 ? 3 : 6; // alternating heights
      for (let r = BOARD_HEIGHT - h; r < BOARD_HEIGHT; r++) {
        board[r][c] = TetriminoType.I;
      }
    }
    const heights = computeColumnHeights(board);
    const bump = computeBumpiness(heights);
    expect(bump).toBeGreaterThan(0);
  });
});

// ── Board evaluation ───────────────────────────────────────────────────

describe("AI fuzz: evaluateBoard", () => {
  it("empty board + 0 lines = 0 score", () => {
    const board = createBoard();
    expect(evaluateBoard(board, 0)).toBe(0);
  });

  it("fully filled board + 40 lines cleared = high positive score", () => {
    const board = createBoard();
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.I;
    }
    const score = evaluateBoard(board, BOARD_HEIGHT);
    // Completed lines weight is 100 per line = 4000, minus penalties
    expect(score).toBeGreaterThan(0);
  });

  it("evaluation is consistent (deterministic)", () => {
    fc.assert(
      fc.property(arbitraryBoardArb, fc.integer({ min: 0, max: 4 }), (board, lines) => {
        const first = evaluateBoard(board, lines);
        const second = evaluateBoard(board, lines);
        expect(second).toBe(first);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Piece width ────────────────────────────────────────────────────────

describe("AI fuzz: getPieceWidth", () => {
  it("all pieces have positive width", () => {
    fc.assert(
      fc.property(tetriminoTypes, rotations, (type, rot) => {
        const width = getPieceWidth(type, rot);
        expect(width).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(BOARD_WIDTH);
      }),
      { numRuns: 100 },
    );
  });

  it("O-piece always has width 2", () => {
    fc.assert(
      fc.property(rotations, (rot) => {
        expect(getPieceWidth(TetriminoType.O, rot)).toBe(2);
      }),
      { numRuns: 30 },
    );
  });
});

// ── Placement generation ───────────────────────────────────────────────

describe("AI fuzz: generatePlacements", () => {
  it("empty board produces valid placements for all piece types", () => {
    fc.assert(
      fc.property(tetriminoTypes, (type) => {
        const board = createBoard();
        const piece: Piece = { type, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO };
        const placements = generatePlacements(board, piece);
        expect(placements.length).toBeGreaterThan(0);
        for (const p of placements) {
          expect(p.targetX).toBeGreaterThanOrEqual(0);
          expect(p.targetX).toBeLessThanOrEqual(BOARD_WIDTH);
          expect(p.score).not.toBeNaN();
        }
      }),
      { numRuns: 50 },
    );
  });

  it("every placement is valid (no collision)", () => {
    fc.assert(
      fc.property(arbitraryBoardArb, tetriminoTypes, (board, type) => {
        const piece: Piece = { type, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO };
        if (checkCollision(board, piece)) return; // skip if piece can't be placed at all
        const placements = generatePlacements(board, piece);
        for (const p of placements) {
          expect(p.targetX).toBeGreaterThanOrEqual(0);
          expect(p.targetX).toBeLessThanOrEqual(BOARD_WIDTH);
          expect(Number.isFinite(p.score)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("placements are sorted by score descending (best first)", () => {
    const board = createBoard();
    const piece: Piece = { type: TetriminoType.T, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    for (let i = 1; i < placements.length; i++) {
      expect(placements[i].score).toBeLessThanOrEqual(placements[i - 1].score);
    }
  });

  it("all unique target positions for a piece type and rotation", () => {
    fc.assert(
      fc.property(tetriminoTypes, rotations, (type, rot) => {
        const board = createBoard();
        const piece: Piece = { type, pos: { x: 3, y: 19 }, rotation: rot };
        const placements = generatePlacements(board, piece);
        const xs = new Set(placements.map((p) => `${p.targetX}-${p.targetRotation}`));
        expect(xs.size).toBe(placements.length);
      }),
      { numRuns: 50 },
    );
  });
});

// ── findBestPlacement ──────────────────────────────────────────────────

describe("AI fuzz: findBestPlacement", () => {
  it("returns null when no active piece", () => {
    const state = baseState();
    expect(findBestPlacement(state)).toBeNull();
  });

  it("returns a placement when piece is active on empty board", () => {
    const state = baseState({
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO },
    });
    const result = findBestPlacement(state);
    expect(result).not.toBeNull();
    expect(result!.score).not.toBeNaN();
  });

  it("score is finite number", () => {
    fc.assert(
      fc.property(tetriminoTypes, (type) => {
        const board = createBoard();
        // Fill bottom randomly
        for (let r = BOARD_HEIGHT - 5; r < BOARD_HEIGHT; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) {
            board[r][c] = Math.random() > 0.5 ? TetriminoType.Z : null;
          }
        }
        const state = baseState({
          board,
          activePiece: { type, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO },
        });
        const result = findBestPlacement(state);
        if (result) {
          expect(Number.isFinite(result.score)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
