import { describe, it, expect } from "vitest";
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
import { TetriminoType, RotationState } from "../core/types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT } from "../core/constants.ts";
import { createBoard } from "../core/board.ts";
import { createInitialState, startGame } from "../core/state.ts";

describe("computeColumnHeights", () => {
  it("returns all zeros for an empty board", () => {
    const board = createBoard();
    const heights = computeColumnHeights(board);
    expect(heights).toHaveLength(BOARD_WIDTH);
    expect(heights.every((h) => h === 0)).toBe(true);
  });

  it("finds height of a single block at the bottom of column 0", () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 1][0] = "I";
    const heights = computeColumnHeights(board);
    expect(heights[0]).toBe(1);
    for (let x = 1; x < BOARD_WIDTH; x++) {
      expect(heights[x]).toBe(0);
    }
  });

  it("finds height of a 3-block tower in column 5", () => {
    const board = createBoard();
    // Fill rows 37, 38, 39 in column 5 (height = 3)
    board[BOARD_HEIGHT - 3][5] = "I";
    board[BOARD_HEIGHT - 2][5] = "I";
    board[BOARD_HEIGHT - 1][5] = "I";
    const heights = computeColumnHeights(board);
    expect(heights[5]).toBe(3);
  });

  it("reports height 40 for a fully filled column", () => {
    const board = createBoard();
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      board[y][3] = "I";
    }
    const heights = computeColumnHeights(board);
    expect(heights[3]).toBe(BOARD_HEIGHT);
  });

  it("handles blocks at the top row correctly", () => {
    const board = createBoard();
    board[0][0] = "I"; // very top of board
    expect(computeColumnHeights(board)[0]).toBe(BOARD_HEIGHT);
  });
});

describe("countHoles", () => {
  it("returns 0 for an empty board", () => {
    const board = createBoard();
    expect(countHoles(board, computeColumnHeights(board))).toBe(0);
  });

  it("counts one hole under a block", () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 3][0] = "I"; // block at row 37
    // Rows 38-39 are empty below = 2 holes
    const heights = computeColumnHeights(board);
    expect(heights[0]).toBe(3);
    expect(countHoles(board, heights)).toBe(2);
  });

  it("counts multiple holes in the same column", () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 5][0] = "I"; // block at row 35
    board[BOARD_HEIGHT - 3][0] = "I"; // block at row 37
    // holes at rows 36, 38, 39 = 3 holes
    const heights = computeColumnHeights(board);
    expect(heights[0]).toBe(5);
    expect(countHoles(board, heights)).toBe(3);
  });

  it("counts holes across multiple columns", () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 3][2] = "I"; // height 3, 2 holes below
    board[BOARD_HEIGHT - 4][5] = "I"; // height 4, 3 holes below
    const heights = computeColumnHeights(board);
    expect(countHoles(board, heights)).toBe(5);
  });

  it("returns 0 for a solid column with no gaps", () => {
    const board = createBoard();
    for (let y = BOARD_HEIGHT - 5; y < BOARD_HEIGHT; y++) {
      board[y][0] = "I";
    }
    const heights = computeColumnHeights(board);
    expect(countHoles(board, heights)).toBe(0);
  });
});

describe("computeBumpiness", () => {
  it("returns 0 for flat heights", () => {
    expect(computeBumpiness([5, 5, 5, 5, 5, 5, 5, 5, 5, 5])).toBe(0);
  });

  it("computes alternating heights correctly", () => {
    // |3-1| + |1-3| + |3-1| + ...
    const heights = [3, 1, 3, 1, 3, 1, 3, 1, 3, 1];
    expect(computeBumpiness(heights)).toBe(9 * 2); // 9 adjacent pairs, each diff=2
  });

  it("computes a single step correctly", () => {
    expect(computeBumpiness([0, 0, 0, 5, 5, 5, 0, 0, 0, 0])).toBe(10);
    // 0->0=0, 0->0=0, 0->5=5, 5->5=0, 5->5=0, 5->0=5, 0->0=0, 0->0=0, 0->0=0
  });

  it("handles all-zeros", () => {
    expect(computeBumpiness([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
  });
});

describe("evaluateBoard", () => {
  it("returns 0 for empty board with no lines", () => {
    const board = createBoard();
    expect(evaluateBoard(board, 0)).toBe(0);
  });

  it("rewards line clears", () => {
    const board = createBoard();
    const noLines = evaluateBoard(board, 0);
    const tetris = evaluateBoard(board, 4);
    expect(tetris).toBeGreaterThan(noLines);
    expect(tetris).toBe(400); // 4 * 100
  });

  it("penalizes aggregate height", () => {
    const board = createBoard();
    const empty = evaluateBoard(board, 0);
    // Fill one column to height 10
    for (let y = BOARD_HEIGHT - 10; y < BOARD_HEIGHT; y++) {
      board[y][0] = "I";
    }
    const withHeight = evaluateBoard(board, 0);
    // Should be lower than empty since height is penalized
    expect(withHeight).toBeLessThan(empty);
  });

  it("penalizes holes heavily", () => {
    const board = createBoard();
    // Create a block in column 0 at row 35 (hole at row 36)
    board[BOARD_HEIGHT - 5][0] = "I";
    // Create a block in column 1 at row 39
    board[BOARD_HEIGHT - 1][1] = "I";
    const heights = computeColumnHeights(board);
    const holeCount = countHoles(board, heights);
    expect(holeCount).toBeGreaterThan(0);
    // Board with holes scores lower than a board with no holes but same height
    const board2 = createBoard();
    board2[BOARD_HEIGHT - 1][0] = "I";
    board2[BOARD_HEIGHT - 1][1] = "I";
    expect(evaluateBoard(board, 0)).toBeLessThan(evaluateBoard(board2, 0));
  });
});

describe("getPieceWidth", () => {
  it("O-piece always has width 2", () => {
    for (let rot = 0; rot < 4; rot++) {
      expect(getPieceWidth(TetriminoType.O, rot as RotationState)).toBe(2);
    }
  });

  it("T-piece rot 0 has width 3", () => {
    expect(getPieceWidth(TetriminoType.T, RotationState.ZERO)).toBe(3);
  });

  it("I-piece horizontal (rot 0) has width 4", () => {
    expect(getPieceWidth(TetriminoType.I, RotationState.ZERO)).toBe(4);
  });

  it("I-piece rot 2 also has width 4", () => {
    expect(getPieceWidth(TetriminoType.I, RotationState.TWO)).toBe(4);
  });

  it("all widths are between 1 and 4", () => {
    for (const type of Object.values(TetriminoType)) {
      for (let rot = 0; rot < 4; rot++) {
        const w = getPieceWidth(type, rot as RotationState);
        expect(w).toBeGreaterThanOrEqual(1);
        expect(w).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("simulatePlacement", () => {
  it("places a piece at the correct position", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const result = simulatePlacement(board, piece, 3, RotationState.ZERO);
    expect(result).not.toBeNull();
    expect(result!.targetX).toBe(3);
    expect(result!.targetRotation).toBe(RotationState.ZERO);
  });

  it("returns null for invalid placement (out of bounds)", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const result = simulatePlacement(board, piece, 9, RotationState.ZERO);
    expect(result).toBeNull();
  });

  it("returns null when target position collides", () => {
    const board = createBoard();
    // Fill the bottom of column 3-5
    board[BOARD_HEIGHT - 1][3] = "I";
    board[BOARD_HEIGHT - 1][4] = "I";
    board[BOARD_HEIGHT - 1][5] = "I";
    const piece = { type: TetriminoType.T, pos: { x: 3, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    // T-piece at x=3, y=BOARD_HEIGHT-2, the stem cell is at y=BOARD_HEIGHT-1 which collides
    // Actually T-shape at rotation 0: row 0 = [0,1,0], row 1 = [1,1,1]
    // At y=38: row 0 maps to y=38, row 1 maps to y=39
    // y=39 cells at x=3 (0), x=4 (0), x=5 (1) — but column 5 is filled
    // So there IS a collision at x=3, y=38 for the T-piece
    // Let me verify: T rot 0 at {x:3, y:38}:
    //   Row 0 (y=38): cell (4,38) -> board[38][4] is empty? board is 40 rows, last index 39
    //   Row 1 (y=39): cells (3,39), (4,39), (5,39) -> board[39][3] filled! collision!
    // So this should be null.
    expect(simulatePlacement(board, piece, 3, RotationState.ZERO)).toBeNull();
  });

  it("scores a placement that clears lines higher", () => {
    const board = createBoard();
    // Fill columns 0-5 in the bottom row (leave 6-9 empty → row not complete)
    for (let x = 0; x < 6; x++) {
      board[BOARD_HEIGHT - 1][x] = "I";
    }
    // I-piece horizontal at x=6 fills columns 6-9, completing the row
    const IPiece = { type: TetriminoType.I, pos: { x: 6, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    const result = simulatePlacement(board, IPiece, 6, RotationState.ZERO);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(100); // line clear bonus
  });
});

describe("generatePlacements", () => {
  it("generates placements for T-piece on empty board", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    // T-piece widths vary per rotation, but we can check there are many
    expect(placements.length).toBeGreaterThan(0);
    // All placements should have valid scores
    for (const p of placements) {
      expect(typeof p.score).toBe("number");
      expect(p.targetX).toBeGreaterThanOrEqual(0);
      expect(p.targetX).toBeLessThan(BOARD_WIDTH);
    }
  });

  it("generates placements for O-piece on empty board", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.O, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    // O-piece: width 2, but generatePlacements iterates all 4 rotations
    // All rotations produce the same shape, so 4 rotations × 9 X positions = 36
    expect(placements.length).toBe(36);
  });

  it("generates placements for I-piece on empty board", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.I, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    expect(placements.length).toBeGreaterThan(0);
  });

  it("returns empty array for full board", () => {
    const board = createBoard();
    // Fill every cell
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        board[y][x] = "I";
      }
    }
    const piece = { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    expect(placements).toHaveLength(0);
  });

  it("sorts placements by score descending", () => {
    const board = createBoard();
    // Fill columns 0-5 in the bottom row (gap at 6-9)
    for (let x = 0; x < 6; x++) {
      board[BOARD_HEIGHT - 1][x] = "I";
    }
    // I-piece horizontal fills columns 6-9 when at x=6
    const piece = { type: TetriminoType.I, pos: { x: 6, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    expect(placements.length).toBeGreaterThan(0);
    for (let i = 1; i < placements.length; i++) {
      expect(placements[i - 1].score).toBeGreaterThanOrEqual(placements[i].score);
    }
    // The best placement fills columns 6-9, completing the row → x=6 clears a line
    expect(placements[0].targetX).toBe(6);
  });
});

describe("findBestPlacement", () => {
  it("returns null when no active piece", () => {
    const state = createInitialState();
    expect(findBestPlacement(state)).toBeNull();
  });

  it("returns a valid placement on a fresh game state", () => {
    const state = startGame(createInitialState());
    const result = findBestPlacement(state);
    expect(result).not.toBeNull();
    expect(result!.targetX).toBeGreaterThanOrEqual(0);
    expect(result!.targetX).toBeLessThan(BOARD_WIDTH);
  });

  it("prefers a line-clearing placement over a non-clearing one", () => {
    const state = startGame(createInitialState());
    // Fill the board so only one placement clears lines
    state.board = createBoard();
    // Fill columns 0-5 in the bottom row (leave 6-9 empty)
    for (let x = 0; x < 6; x++) {
      state.board[BOARD_HEIGHT - 1][x] = "I";
    }
    // Create an I-piece that's horizontal and positioned to fill the gap
    state.activePiece = {
      type: TetriminoType.I,
      pos: { x: 6, y: BOARD_HEIGHT - 2 },
      rotation: RotationState.ZERO,
    };
    state.ghostY = state.activePiece.pos.y;

    const result = findBestPlacement(state);
    expect(result).not.toBeNull();
    // I-piece at x=6 fills columns 6-9, which clears a line
    expect(result!.targetX).toBe(6);
    // Score should be positive (line clear bonus)
    expect(result!.score).toBeGreaterThanOrEqual(100);
  });

  it("evaluates hold when hasSwappedThisTurn is false", () => {
    const state = startGame(createInitialState());
    state.hasSwappedThisTurn = false;
    state.heldPiece = TetriminoType.I; // Hold an I-piece
    const result = findBestPlacement(state);
    expect(result).not.toBeNull();
    // It should normally prefer something — just check it runs without error
  });

  it("does not evaluate hold when hasSwappedThisTurn is true", () => {
    const state = startGame(createInitialState());
    state.hasSwappedThisTurn = true;
    const result = findBestPlacement(state);
    expect(result).not.toBeNull();
  });

  it("evaluates hold with next queue piece when nothing held", () => {
    const state = startGame(createInitialState());
    state.hasSwappedThisTurn = false;
    state.heldPiece = null; // No held piece
    // nextQueue is populated from startGame
    const result = findBestPlacement(state);
    expect(result).not.toBeNull();
  });
});

describe("edge cases", () => {
  it("handles S-piece correctly", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.S, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    expect(placements.length).toBeGreaterThan(0);
  });

  it("handles Z-piece correctly", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.Z, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    expect(placements.length).toBeGreaterThan(0);
  });

  it("handles J-piece correctly", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.J, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    expect(placements.length).toBeGreaterThan(0);
  });

  it("handles L-piece correctly", () => {
    const board = createBoard();
    const piece = { type: TetriminoType.L, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const placements = generatePlacements(board, piece);
    expect(placements.length).toBeGreaterThan(0);
  });
});
