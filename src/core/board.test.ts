import { describe, it, expect } from "vitest";
import {
  createBoard,
  checkCollision,
  lockPiece,
  clearLines,
} from "./board.ts";
import { TetriminoType, RotationState } from "./types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT } from "./constants.ts";

describe("createBoard", () => {
  it("should create a board with default dimensions (10x40)", () => {
    const board = createBoard();
    expect(board.length).toBe(BOARD_HEIGHT);
    expect(board[0].length).toBe(BOARD_WIDTH);
  });

  it("should fill all cells with null", () => {
    const board = createBoard();
    for (const row of board) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it("should accept custom dimensions", () => {
    const board = createBoard(5, 8);
    expect(board.length).toBe(8);
    expect(board[0].length).toBe(5);
  });
});

describe("checkCollision", () => {
  it("should detect left wall collision", () => {
    const board = createBoard();
    // T-piece at x=-1: its leftmost filled cell (col 0 in shape row 1)
    // maps to board column -1
    const piece = {
      type: TetriminoType.T,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should detect right wall collision", () => {
    const board = createBoard();
    // T-piece rotation 0: rightmost filled cell is shape col 2, row 1
    // At x=8 that cell maps to board column 10 which is out of bounds
    const piece = {
      type: TetriminoType.T,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should detect floor collision", () => {
    const board = createBoard();
    // T-piece rotation 0: lowest filled cells are at shape row 1
    // At y=39 those map to board row 40 which is out of bounds
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 39 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should detect collision with another locked piece", () => {
    const board = createBoard();
    // Place a locked cell at board position (4, 11)
    board[11][4] = TetriminoType.S;

    // T-piece at (3, 10) rotation 0: cell at shape row 1 col 1 maps to (4, 11)
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 10 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should return false for a piece in open space", () => {
    const board = createBoard();
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 10 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(false);
  });

  it("should not collide when piece cells are above the board (y < 0)", () => {
    const board = createBoard();
    // I-piece at spawn position y=-1: filled cells are at shape row 1
    // which maps to board row 0 -- within bounds and empty
    const piece = {
      type: TetriminoType.I,
      pos: { x: 3, y: -1 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(false);
  });

  it("should detect left wall collision for I-piece at x=-2 in rotation 0", () => {
    const board = createBoard();
    // I-piece rotation 0: filled at shape row 1, cols 0-3.
    // At x=-2: boardX = -2, -1, 0, 1.  Col 0 maps to x=-2 (< 0) => collision.
    const piece = {
      type: TetriminoType.I,
      pos: { x: -2, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should not detect left wall collision for I-piece at x=-2 in rotation R", () => {
    const board = createBoard();
    // I-piece rotation R: filled at col 2, rows 0-3.
    // At x=-2: boardX = 0.  In bounds and empty => no collision.
    const piece = {
      type: TetriminoType.I,
      pos: { x: -2, y: 5 },
      rotation: RotationState.R,
    };
    expect(checkCollision(board, piece)).toBe(false);
  });

  it("should detect left wall collision for I-piece at x=-2 in rotation 2", () => {
    const board = createBoard();
    // I-piece rotation 2: same filled pattern as rotation 0 (row 2, cols 0-3).
    // At x=-2: boardX = -2, -1, 0, 1.  Col 0 => x=-2 < 0 => collision.
    const piece = {
      type: TetriminoType.I,
      pos: { x: -2, y: 5 },
      rotation: RotationState.TWO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should detect left wall collision for I-piece at x=-2 in rotation L", () => {
    const board = createBoard();
    // I-piece rotation L: filled at col 1, rows 0-3.
    // At x=-2: boardX = -1 < 0 => collision.
    const piece = {
      type: TetriminoType.I,
      pos: { x: -2, y: 5 },
      rotation: RotationState.L,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should detect right wall collision for I-piece at x=8 in rotation 0", () => {
    const board = createBoard();
    // I-piece rotation 0: filled at shape row 1, cols 0-3.
    // At x=8: boardX = 8, 9, 10, 11.  Col 2 => x=10 >= BOARD_WIDTH => collision.
    const piece = {
      type: TetriminoType.I,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should detect right wall collision for I-piece at x=8 in rotation R", () => {
    const board = createBoard();
    // I-piece rotation R: filled at col 2, rows 0-3.
    // At x=8: boardX = 10 >= BOARD_WIDTH => collision.
    const piece = {
      type: TetriminoType.I,
      pos: { x: 8, y: 5 },
      rotation: RotationState.R,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should detect right wall collision for I-piece at x=8 in rotation 2", () => {
    const board = createBoard();
    const piece = {
      type: TetriminoType.I,
      pos: { x: 8, y: 5 },
      rotation: RotationState.TWO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should not detect right wall collision for I-piece at x=8 in rotation L", () => {
    const board = createBoard();
    // I-piece rotation L: filled at col 1, rows 0-3.
    // At x=8: boardX = 9 < BOARD_WIDTH => in bounds and empty => no collision.
    const piece = {
      type: TetriminoType.I,
      pos: { x: 8, y: 5 },
      rotation: RotationState.L,
    };
    expect(checkCollision(board, piece)).toBe(false);
  });

  it("should collide at x=9 for O-piece (right wall)", () => {
    const board = createBoard();
    // O-piece: filled at (row 0, col 0), (row 0, col 1), (row 1, col 0), (row 1, col 1).
    // At x=9: col 1 maps to boardX = 10 >= BOARD_WIDTH => collision.
    const piece = {
      type: TetriminoType.O,
      pos: { x: 9, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=-1 for O-piece (left wall)", () => {
    const board = createBoard();
    // At x=-1: col 0 maps to boardX = -1 < 0 => collision.
    const piece = {
      type: TetriminoType.O,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=8 for T-piece (right wall)", () => {
    const board = createBoard();
    // T-piece rotation 0: rightmost filled at shape row 1 col 2.
    // At x=8: boardX = 10 >= BOARD_WIDTH => collision.
    const piece = {
      type: TetriminoType.T,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=8 for S-piece (right wall)", () => {
    const board = createBoard();
    // S-piece rotation 0: rightmost filled at shape row 0 col 2.
    // At x=8: boardX = 10 >= BOARD_WIDTH => collision.
    const piece = {
      type: TetriminoType.S,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=8 for Z-piece (right wall)", () => {
    const board = createBoard();
    // Z-piece rotation 0: rightmost filled at shape row 1 col 2.
    // At x=8: boardX = 10 >= BOARD_WIDTH => collision.
    const piece = {
      type: TetriminoType.Z,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=8 for J-piece (right wall)", () => {
    const board = createBoard();
    // J-piece rotation 0: rightmost filled at shape row 1 col 2.
    // At x=8: boardX = 10 >= BOARD_WIDTH => collision.
    const piece = {
      type: TetriminoType.J,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=8 for L-piece (right wall)", () => {
    const board = createBoard();
    // L-piece rotation 0: rightmost filled at shape row 1 col 2.
    // At x=8: boardX = 10 >= BOARD_WIDTH => collision.
    const piece = {
      type: TetriminoType.L,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=-1 for T-piece (left wall)", () => {
    const board = createBoard();
    // T-piece rotation 0: leftmost filled at shape row 1 col 0.
    // At x=-1: boardX = -1 < 0 => collision.
    const piece = {
      type: TetriminoType.T,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=-1 for S-piece (left wall)", () => {
    const board = createBoard();
    // S-piece rotation 0: leftmost filled at shape row 1 col 0.
    // At x=-1: boardX = -1 < 0 => collision.
    const piece = {
      type: TetriminoType.S,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=-1 for Z-piece (left wall)", () => {
    const board = createBoard();
    // Z-piece rotation 0: leftmost filled at shape row 0 col 0.
    // At x=-1: boardX = -1 < 0 => collision.
    const piece = {
      type: TetriminoType.Z,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=-1 for J-piece (left wall)", () => {
    const board = createBoard();
    // J-piece rotation 0: leftmost filled at shape row 0 col 0 and row 1 col 0.
    // At x=-1: boardX = -1 < 0 => collision.
    const piece = {
      type: TetriminoType.J,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should collide at x=-1 for L-piece (left wall)", () => {
    const board = createBoard();
    // L-piece rotation 0: leftmost filled at shape row 1 col 0.
    // At x=-1: boardX = -1 < 0 => collision.
    const piece = {
      type: TetriminoType.L,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(true);
  });

  it("should allow piece fully above the board (all cells with negative y)", () => {
    const board = createBoard();
    // T-piece rotation 0 at y=-3:
    //   row 0 col 1 -> boardY = -3 < 0 -> skipped
    //   row 1 cols 0,1,2 -> boardY = -2 < 0 -> skipped
    // All cells above the board => no collision.
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: -3 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(false);
  });

  it("should allow piece partly above board (some cells negative y, some visible)", () => {
    const board = createBoard();
    // T-piece rotation 0 at y=-1:
    //   row 0 col 1 -> boardY = -1 < 0 -> skipped
    //   row 1 cols 0,1,2 -> boardY = 0 (visible, empty) -> no collision
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: -1 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(false);
  });

  it("should allow J-piece partly above board", () => {
    const board = createBoard();
    // J-piece rotation 0 at y=-1:
    //   row 0 col 0 -> boardY = -1 -> skipped
    //   row 1 cols 0,1,2 -> boardY = 0 -> visible, empty -> no collision
    const piece = {
      type: TetriminoType.J,
      pos: { x: 3, y: -1 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(false);
  });

  it("should only check the 2x2 occupied area for O-piece, not the full 4x4", () => {
    const board = createBoard();
    // O-piece at x=8: rightmost filled cell is at (9, 0) which is in bounds.
    // The empty cols 2-3 of the 4x4 bounding box would be at x=10-11 but are
    // not filled in the shape matrix, so they must NOT cause a collision.
    const piece = {
      type: TetriminoType.O,
      pos: { x: 8, y: 0 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece)).toBe(false);

    // O-piece at x=9: rightmost filled cell is at (10, 0) out of bounds
    const piece2 = {
      type: TetriminoType.O,
      pos: { x: 9, y: 0 },
      rotation: RotationState.ZERO,
    };
    expect(checkCollision(board, piece2)).toBe(true);
  });
});

describe("lockPiece", () => {
  it("should place piece cells onto the board", () => {
    const board = createBoard();
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 10 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);

    // T-piece rotation 0: filled cells at shape offsets:
    //   (col 1, row 0) -> board (4, 10)
    //   (col 0, row 1) -> board (3, 11)
    //   (col 1, row 1) -> board (4, 11)
    //   (col 2, row 1) -> board (5, 11)
    expect(result[10][4]).toBe(TetriminoType.T);
    expect(result[11][3]).toBe(TetriminoType.T);
    expect(result[11][4]).toBe(TetriminoType.T);
    expect(result[11][5]).toBe(TetriminoType.T);

    // Adjacent cells should still be null
    expect(result[10][3]).toBeNull();
    expect(result[10][5]).toBeNull();
    expect(result[12][4]).toBeNull();
  });

  it("should not mutate the original board", () => {
    const board = createBoard();
    const originalBoard = createBoard(); // fresh copy for comparison
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 10 },
      rotation: RotationState.ZERO,
    };
    lockPiece(board, piece);

    expect(board).toEqual(originalBoard);
  });

  it("should correctly place I-piece at its spawn y offset of -1", () => {
    const board = createBoard();
    // I-piece rotation 0: filled cells are at shape row 1 (cols 0-3)
    // With y=-1 this maps to board row 0
    const piece = {
      type: TetriminoType.I,
      pos: { x: 3, y: -1 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);

    expect(result[0][3]).toBe(TetriminoType.I);
    expect(result[0][4]).toBe(TetriminoType.I);
    expect(result[0][5]).toBe(TetriminoType.I);
    expect(result[0][6]).toBe(TetriminoType.I);

    // Ensure piece didn't write to non-filled cells of the 4x4 bounding box
    expect(result[0][2]).toBeNull();
    expect(result[0][7]).toBeNull();
  });

  it("should handle I-piece locked at positive y positions", () => {
    const board = createBoard();
    // I-piece rotation 0 at y=5: filled cells at shape row 1 -> board row 6
    const piece = {
      type: TetriminoType.I,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);
    expect(result[6][3]).toBe(TetriminoType.I);
    expect(result[6][4]).toBe(TetriminoType.I);
    expect(result[6][5]).toBe(TetriminoType.I);
    expect(result[6][6]).toBe(TetriminoType.I);
  });

  it("should ignore out-of-bounds cells when locking T-piece at x=-1", () => {
    const board = createBoard();
    // T-piece rotation 0 at x=-1, y=5:
    //   shape[0][1] -> boardX=0, boardY=5 -> placed
    //   shape[1][0] -> boardX=-1 -> out of bounds -> ignored
    //   shape[1][1] -> boardX=0, boardY=6 -> placed
    //   shape[1][2] -> boardX=1, boardY=6 -> placed
    const piece = {
      type: TetriminoType.T,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);

    // Cells within bounds should be placed
    expect(result[5][0]).toBe(TetriminoType.T);
    expect(result[6][0]).toBe(TetriminoType.T);
    expect(result[6][1]).toBe(TetriminoType.T);

    // Cell at x=-1 should have been ignored (no-op)
    // No cell should exist at index -1
  });

  it("should ignore out-of-bounds cells when locking S-piece at x=8", () => {
    const board = createBoard();
    // S-piece rotation 0 at x=8, y=5:
    //   shape[0][1] -> boardX=9, boardY=5 -> placed
    //   shape[0][2] -> boardX=10 -> out of bounds -> ignored
    //   shape[1][0] -> boardX=8, boardY=6 -> placed
    //   shape[1][1] -> boardX=9, boardY=6 -> placed
    const piece = {
      type: TetriminoType.S,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);

    expect(result[5][9]).toBe(TetriminoType.S);
    expect(result[6][8]).toBe(TetriminoType.S);
    expect(result[6][9]).toBe(TetriminoType.S);
  });

  it("should ignore out-of-bounds cells when locking Z-piece at x=8", () => {
    const board = createBoard();
    // Z-piece rotation 0 at x=8, y=5:
    //   shape[0][0] -> boardX=8, boardY=5 -> placed
    //   shape[0][1] -> boardX=9, boardY=5 -> placed
    //   shape[1][1] -> boardX=9, boardY=6 -> placed
    //   shape[1][2] -> boardX=10 -> out of bounds -> ignored
    const piece = {
      type: TetriminoType.Z,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);

    expect(result[5][8]).toBe(TetriminoType.Z);
    expect(result[5][9]).toBe(TetriminoType.Z);
    expect(result[6][9]).toBe(TetriminoType.Z);
  });

  it("should ignore out-of-bounds cells when locking J-piece at x=-1", () => {
    const board = createBoard();
    // J-piece rotation 0 at x=-1, y=5:
    //   shape[0][0] -> boardX=-1 -> out of bounds -> ignored
    //   shape[1][0] -> boardX=-1 -> out of bounds -> ignored
    //   shape[1][1] -> boardX=0, boardY=6 -> placed
    //   shape[1][2] -> boardX=1, boardY=6 -> placed
    const piece = {
      type: TetriminoType.J,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);

    expect(result[6][0]).toBe(TetriminoType.J);
    expect(result[6][1]).toBe(TetriminoType.J);
  });

  it("should ignore out-of-bounds cells when locking L-piece at x=-1", () => {
    const board = createBoard();
    // L-piece rotation 0 at x=-1, y=5:
    //   shape[0][2] -> boardX=1, boardY=5 -> placed
    //   shape[1][0] -> boardX=-1 -> out of bounds -> ignored
    //   shape[1][1] -> boardX=0, boardY=6 -> placed
    //   shape[1][2] -> boardX=1, boardY=6 -> placed
    const piece = {
      type: TetriminoType.L,
      pos: { x: -1, y: 5 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);

    expect(result[5][1]).toBe(TetriminoType.L);
    expect(result[6][0]).toBe(TetriminoType.L);
    expect(result[6][1]).toBe(TetriminoType.L);
  });

  it("should lock I-piece rotation R (vertical) at various x positions", () => {
    const board = createBoard();
    // I-piece rotation R: filled at col 2 in all 4 rows.
    // At x=0: boardX = 2.  boardY = 5,6,7,8.
    const piece1 = {
      type: TetriminoType.I,
      pos: { x: 0, y: 5 },
      rotation: RotationState.R,
    };
    const result1 = lockPiece(board, piece1);
    expect(result1[5][2]).toBe(TetriminoType.I);
    expect(result1[6][2]).toBe(TetriminoType.I);
    expect(result1[7][2]).toBe(TetriminoType.I);
    expect(result1[8][2]).toBe(TetriminoType.I);

    // At x=7: boardX = 9 (rightmost column).  boardY = 5,6,7,8.
    const piece2 = {
      type: TetriminoType.I,
      pos: { x: 7, y: 5 },
      rotation: RotationState.R,
    };
    const result2 = lockPiece(board, piece2);
    expect(result2[5][9]).toBe(TetriminoType.I);
    expect(result2[6][9]).toBe(TetriminoType.I);
    expect(result2[7][9]).toBe(TetriminoType.I);
    expect(result2[8][9]).toBe(TetriminoType.I);

    // At x=8: boardX = 10 -> out of bounds.  All cells ignored.
    const piece3 = {
      type: TetriminoType.I,
      pos: { x: 8, y: 5 },
      rotation: RotationState.R,
    };
    const result3 = lockPiece(board, piece3);
    // No cells should have been placed (all mapped to x=10 which is OOB)
    expect(result3[5][9]).toBeNull();
    expect(result3[6][9]).toBeNull();
    expect(result3[7][9]).toBeNull();
    expect(result3[8][9]).toBeNull();
  });

  it("should lock O-piece at the right edge (x=8)", () => {
    const board = createBoard();
    // O-piece at x=8, y=5:
    //   (0,0)->(8,5), (0,1)->(9,5), (1,0)->(8,6), (1,1)->(9,6)
    // All in bounds.
    const piece = {
      type: TetriminoType.O,
      pos: { x: 8, y: 5 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);
    expect(result[5][8]).toBe(TetriminoType.O);
    expect(result[5][9]).toBe(TetriminoType.O);
    expect(result[6][8]).toBe(TetriminoType.O);
    expect(result[6][9]).toBe(TetriminoType.O);
  });

  it("should lock O-piece with some cells above the board (y=-1)", () => {
    const board = createBoard();
    // O-piece at x=3, y=-1:
    //   (0,0)->(3,-1) out of bounds (y<0) -> ignored
    //   (0,1)->(4,-1) out of bounds (y<0) -> ignored
    //   (1,0)->(3,0) placed
    //   (1,1)->(4,0) placed
    const piece = {
      type: TetriminoType.O,
      pos: { x: 3, y: -1 },
      rotation: RotationState.ZERO,
    };
    const result = lockPiece(board, piece);
    expect(result[0][3]).toBe(TetriminoType.O);
    expect(result[0][4]).toBe(TetriminoType.O);
  });
});

describe("clearLines", () => {
  it("should return no cleared lines on an empty board", () => {
    const board = createBoard();
    const result = clearLines(board);

    expect(result.linesCleared).toBe(0);
    expect(result.clearedRowIndices).toEqual([]);
    expect(result.board).toEqual(board);
  });

  it("should clear a single full row", () => {
    const board = createBoard();
    // Fill the bottom row completely
    const bottomRow = BOARD_HEIGHT - 1;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[bottomRow][x] = TetriminoType.I;
    }

    const result = clearLines(board);

    expect(result.linesCleared).toBe(1);
    expect(result.clearedRowIndices).toEqual([bottomRow]);

    // The new board should still have 40 rows
    expect(result.board.length).toBe(BOARD_HEIGHT);

    // Top row should be empty (shifted down result)
    for (let x = 0; x < BOARD_WIDTH; x++) {
      expect(result.board[0][x]).toBeNull();
    }

    // Bottom row should now be whatever was above the cleared row (null)
    expect(result.board[bottomRow][0]).toBeNull();
  });

  it("should clear multiple full rows", () => {
    const board = createBoard();
    // Fill the bottom 3 rows completely
    for (let r = BOARD_HEIGHT - 3; r < BOARD_HEIGHT; r++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        board[r][x] = TetriminoType.I;
      }
    }

    // Place a piece above the filled rows to verify shifting
    board[BOARD_HEIGHT - 4][3] = TetriminoType.T;

    const result = clearLines(board);

    expect(result.linesCleared).toBe(3);
    expect(result.clearedRowIndices).toEqual([
      BOARD_HEIGHT - 3,
      BOARD_HEIGHT - 2,
      BOARD_HEIGHT - 1,
    ]);

    // The T piece that was above the cleared rows should now be at the bottom
    expect(result.board[BOARD_HEIGHT - 1][3]).toBe(TetriminoType.T);
  });

  it("should not clear partial rows", () => {
    const board = createBoard();
    const bottomRow = BOARD_HEIGHT - 1;

    // Fill all cells except the last one
    for (let x = 0; x < BOARD_WIDTH - 1; x++) {
      board[bottomRow][x] = TetriminoType.S;
    }

    const result = clearLines(board);

    expect(result.linesCleared).toBe(0);
    expect(result.clearedRowIndices).toEqual([]);
  });

  it("should maintain board dimensions after clearing", () => {
    const board = createBoard();
    // Fill bottom two rows completely
    board[BOARD_HEIGHT - 1] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.I);
    board[BOARD_HEIGHT - 2] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.S);

    const result = clearLines(board);

    expect(result.board.length).toBe(BOARD_HEIGHT);
    expect(result.board[0].length).toBe(BOARD_WIDTH);
  });

  it("should return correct clearedRowIndices", () => {
    const board = createBoard();
    // Fill rows at distinct positions
    board[5] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.I);
    board[10] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.S);
    board[15] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.Z);

    const result = clearLines(board);

    expect(result.linesCleared).toBe(3);
    expect(result.clearedRowIndices).toEqual([5, 10, 15]);
  });

  it("should shift a non-full row down when a full row below it is cleared", () => {
    const board = createBoard();
    // Fill bottom row (row 39) completely
    board[BOARD_HEIGHT - 1] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.I);

    // Fill row 38 partially (leave last cell empty)
    for (let x = 0; x < BOARD_WIDTH - 1; x++) {
      board[BOARD_HEIGHT - 2][x] = TetriminoType.T;
    }

    const result = clearLines(board);

    expect(result.linesCleared).toBe(1);
    expect(result.clearedRowIndices).toEqual([BOARD_HEIGHT - 1]);

    // The partial row that was at index 38 should now be at index 39
    for (let x = 0; x < BOARD_WIDTH - 1; x++) {
      expect(result.board[BOARD_HEIGHT - 1][x]).toBe(TetriminoType.T);
    }
    expect(result.board[BOARD_HEIGHT - 1][BOARD_WIDTH - 1]).toBeNull();

    // Top row should be empty (new row prepended at index 0)
    for (let x = 0; x < BOARD_WIDTH; x++) {
      expect(result.board[0][x]).toBeNull();
    }
  });

  it("should clear non-adjacent rows (rows 10 and 20 both full) and shift correctly", () => {
    const board = createBoard();

    // Fill rows 10 and 20 completely with distinct colors
    board[10] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.I);
    board[20] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.S);

    // Place marker pieces to verify shifting
    board[9][3] = TetriminoType.J;   // above row 10 clearance
    board[11][3] = TetriminoType.L;  // between rows 10 and 20
    board[19][3] = TetriminoType.Z;  // between rows 10 and 20
    board[21][3] = TetriminoType.T;  // below row 20

    const result = clearLines(board);

    expect(result.linesCleared).toBe(2);
    expect(result.clearedRowIndices).toEqual([10, 20]);

    // After filtering out rows 10,20 and prepending 2 empty rows:
    //   old row 9  -> filtered index 9  -> newBoard[11]
    //   old row 11 -> filtered index 10 -> newBoard[12]
    //   old row 19 -> filtered index 18 -> newBoard[20]
    //   old row 21 -> filtered index 19 -> newBoard[21]
    expect(result.board[11][3]).toBe(TetriminoType.J);
    expect(result.board[12][3]).toBe(TetriminoType.L);
    expect(result.board[20][3]).toBe(TetriminoType.Z);
    expect(result.board[21][3]).toBe(TetriminoType.T);

    // Top two rows should be empty
    for (let x = 0; x < BOARD_WIDTH; x++) {
      expect(result.board[0][x]).toBeNull();
      expect(result.board[1][x]).toBeNull();
    }
  });

  it("should clear all rows when every row is full", () => {
    const board = createBoard();
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        board[y][x] = TetriminoType.I;
      }
    }

    const result = clearLines(board);

    expect(result.linesCleared).toBe(BOARD_HEIGHT);
    expect(result.clearedRowIndices.length).toBe(BOARD_HEIGHT);

    // All 40 rows should now be empty
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        expect(result.board[y][x]).toBeNull();
      }
    }
    expect(result.board.length).toBe(BOARD_HEIGHT);
  });

  it("should return 0 lines when calling clearLines on an already-cleared board", () => {
    const board = createBoard();

    // Fill bottom 2 rows
    board[BOARD_HEIGHT - 1] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.I);
    board[BOARD_HEIGHT - 2] = Array.from({ length: BOARD_WIDTH }, () => TetriminoType.S);

    const firstResult = clearLines(board);
    expect(firstResult.linesCleared).toBe(2);

    // Call clearLines again on the result — no rows should be full
    const secondResult = clearLines(firstResult.board);
    expect(secondResult.linesCleared).toBe(0);
    expect(secondResult.clearedRowIndices).toEqual([]);
    expect(secondResult.board).toEqual(firstResult.board);
  });
});
