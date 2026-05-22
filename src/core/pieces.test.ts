import { describe, it, expect } from "vitest";
import {
  spawnPiece,
  movePiece,
  tryRotateCW,
  tryRotateCCW,
  getGhostY,
} from "./pieces.ts";
import { createBoard, checkCollision } from "./board.ts";
import { TetriminoType, RotationState } from "./types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT } from "./constants.ts";

describe("spawnPiece", () => {
  it("should spawn a standard piece at the standard spawn position", () => {
    const piece = spawnPiece(TetriminoType.T);
    expect(piece.type).toBe(TetriminoType.T);
    expect(piece.pos).toEqual({ x: 3, y: 19 });
    expect(piece.rotation).toBe(RotationState.ZERO);
  });

  it("should spawn L-piece at the standard spawn position", () => {
    const piece = spawnPiece(TetriminoType.L);
    expect(piece.type).toBe(TetriminoType.L);
    expect(piece.pos).toEqual({ x: 3, y: 19 });
    expect(piece.rotation).toBe(RotationState.ZERO);
  });

  it("should spawn I-piece at I_SPAWN_POSITION (x=3, y=18)", () => {
    const piece = spawnPiece(TetriminoType.I);
    expect(piece.type).toBe(TetriminoType.I);
    expect(piece.pos).toEqual({ x: 3, y: 18 });
    expect(piece.rotation).toBe(RotationState.ZERO);
  });

  it("should set rotation to ZERO for all piece types", () => {
    const types = [
      TetriminoType.I,
      TetriminoType.O,
      TetriminoType.T,
      TetriminoType.S,
      TetriminoType.Z,
      TetriminoType.J,
      TetriminoType.L,
    ];
    for (const type of types) {
      const piece = spawnPiece(type);
      expect(piece.rotation).toBe(RotationState.ZERO);
    }
  });

  it("should spawn S-piece at standard spawn position (x=3, y=19)", () => {
    const piece = spawnPiece(TetriminoType.S);
    expect(piece.type).toBe(TetriminoType.S);
    expect(piece.pos).toEqual({ x: 3, y: 19 });
    expect(piece.rotation).toBe(RotationState.ZERO);
  });

  it("should spawn Z-piece at standard spawn position (x=3, y=19)", () => {
    const piece = spawnPiece(TetriminoType.Z);
    expect(piece.type).toBe(TetriminoType.Z);
    expect(piece.pos).toEqual({ x: 3, y: 19 });
    expect(piece.rotation).toBe(RotationState.ZERO);
  });

  it("should spawn J-piece at standard spawn position (x=3, y=19)", () => {
    const piece = spawnPiece(TetriminoType.J);
    expect(piece.type).toBe(TetriminoType.J);
    expect(piece.pos).toEqual({ x: 3, y: 19 });
    expect(piece.rotation).toBe(RotationState.ZERO);
  });

  it("should spawn O-piece at standard spawn position (x=3, y=19)", () => {
    const piece = spawnPiece(TetriminoType.O);
    expect(piece.type).toBe(TetriminoType.O);
    expect(piece.pos).toEqual({ x: 3, y: 19 });
    expect(piece.rotation).toBe(RotationState.ZERO);
  });
});

describe("movePiece", () => {
  it("should apply dx and dy correctly", () => {
    const piece = { type: TetriminoType.T, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO };
    const moved = movePiece(piece, 2, 3);
    expect(moved.pos.x).toBe(5);
    expect(moved.pos.y).toBe(3);
  });

  it("should handle negative deltas", () => {
    const piece = { type: TetriminoType.T, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO };
    const moved = movePiece(piece, -1, -2);
    expect(moved.pos.x).toBe(2);
    expect(moved.pos.y).toBe(-2);
  });

  it("should not mutate the original piece", () => {
    const piece = { type: TetriminoType.T, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO };
    const originalX = piece.pos.x;
    const originalY = piece.pos.y;

    movePiece(piece, 5, 5);

    expect(piece.pos.x).toBe(originalX);
    expect(piece.pos.y).toBe(originalY);
  });

  it("should return a new object reference", () => {
    const piece = spawnPiece(TetriminoType.T);
    const moved = movePiece(piece, 1, 0);
    expect(moved).not.toBe(piece);
    expect(moved.pos).not.toBe(piece.pos);
  });

  it("should preserve rotation state when moving I-piece in every rotation state", () => {
    const states = [
      RotationState.ZERO,
      RotationState.R,
      RotationState.TWO,
      RotationState.L,
    ];
    for (const rot of states) {
      const piece = {
        type: TetriminoType.I as TetriminoType,
        pos: { x: 3, y: 5 },
        rotation: rot as RotationState,
      };
      const moved = movePiece(piece, 1, 0);
      expect(moved.rotation).toBe(rot);
      expect(moved.pos).toEqual({ x: 4, y: 5 });
    }
  });

  it("should move O-piece to the right edge boundary (x=8)", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.O);
    // O-piece: filled at (row 0, col 0) and (row 0, col 1).
    // At x=8: boardX = 8, 9.  Both in bounds.
    const moved = movePiece(piece, 5, 0);
    expect(moved.pos).toEqual({ x: 8, y: 19 });
    expect(moved.rotation).toBe(RotationState.ZERO);
    // Verify the moved piece does not collide with the right wall
    expect(checkCollision(board, moved)).toBe(false);
  });

  it("should move O-piece past the right edge (x=9) and collide", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.O);
    const moved = movePiece(piece, 6, 0); // x=9
    // At x=9: col 1 maps to boardX=10 which is OOB => collision
    expect(checkCollision(board, moved)).toBe(true);
  });

  it("should move I-piece to right edge and verify boundary", () => {
    const board = createBoard();
    // I-piece rotation 0: filled at shape row 1, cols 0-3.
    // At x=6: boardX = 6, 7, 8, 9.  All in bounds => no collision.
    const piece = {
      type: TetriminoType.I as TetriminoType,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO as RotationState,
    };
    const moved = movePiece(piece, 3, 0);
    expect(moved.pos).toEqual({ x: 6, y: 5 });
    expect(checkCollision(board, moved)).toBe(false);

    // At x=7: boardX = 7, 8, 9, 10.  x=10 is OOB => collision.
    const moved2 = movePiece(piece, 4, 0);
    expect(checkCollision(board, moved2)).toBe(true);
  });
});

describe("tryRotateCW", () => {
  it("should rotate a T-piece CW to rotation state R", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.T);
    const result = tryRotateCW(piece, board);

    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate I-piece CW to rotation state R", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.I);
    const result = tryRotateCW(piece, board);

    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
  });

  it("should return O-piece unchanged (no-op)", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.O);
    const result = tryRotateCW(piece, board);

    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.ZERO);
    expect(result!.kicked).toBe(false);
    expect(result!.piece.type).toBe(TetriminoType.O);
  });

  it("should apply a wall kick when rotation is blocked by a filled cell", () => {
    const board = createBoard();
    // Place a filled cell at (4, 7) which blocks T rotation R's bottom cell
    // when the piece is at x=3, y=5
    board[7][4] = TetriminoType.S;

    const piece = {
      type: TetriminoType.T as TetriminoType,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO as RotationState,
    } as const;

    const result = tryRotateCW(piece, board);

    // Kick 1 (-1, 0) should move piece to x=2, which avoids the obstruction
    expect(result).not.toBeNull();
    expect(result!.kicked).toBe(true);
    expect(result!.piece.pos.x).toBe(2);
    expect(result!.piece.pos.y).toBe(5);
    expect(result!.piece.rotation).toBe(RotationState.R);
  });

  it("should return null when all wall kicks fail", () => {
    const board = createBoard();

    // Fill every cell
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        board[y][x] = TetriminoType.S;
      }
    }

    // Clear only the cells that the T-piece occupies at rotation 0, pos (3, 5)
    // T-piece rotation 0:
    //   [false, true, false, false]  -> (4, 5)
    //   [true, true, true, false]    -> (3, 6), (4, 6), (5, 6)
    board[5][4] = null;
    board[6][3] = null;
    board[6][4] = null;
    board[6][5] = null;

    const piece = {
      type: TetriminoType.T as TetriminoType,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO as RotationState,
    } as const;

    // All wall kick positions for the rotated piece should collide with
    // the surrounding filled cells. Expect null.
    const result = tryRotateCW(piece, board);
    expect(result).toBeNull();
  });

  it("should rotate S-piece CW to rotation state R", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.S);
    const result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate Z-piece CW to rotation state R", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.Z);
    const result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate J-piece CW to rotation state R", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.J);
    const result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate L-piece CW to rotation state R", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.L);
    const result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate T-piece CW through all transitions (0->R, R->2, 2->L, L->0)", () => {
    const board = createBoard();
    let piece = spawnPiece(TetriminoType.T);

    // 0 -> R: basic non-kicked rotation
    let result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);

    // R -> 2
    result = tryRotateCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.TWO);
    expect(result!.kicked).toBe(false);

    // 2 -> L
    result = tryRotateCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);

    // L -> 0
    result = tryRotateCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.ZERO);
    expect(result!.kicked).toBe(false);

    // Position should be unchanged after full cycle
    expect(result!.piece.pos).toEqual({ x: 3, y: 19 });
  });

  it("should rotate I-piece CW through all transitions (0->R, R->2, 2->L, L->0)", () => {
    const board = createBoard();
    let piece = spawnPiece(TetriminoType.I);

    // 0 -> R: I-piece at spawn (3,19).  I rot R: col 2 -> x=5, rows 0-3 -> y=19-22
    let result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);

    // R -> 2
    result = tryRotateCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.TWO);
    expect(result!.kicked).toBe(false);

    // 2 -> L
    result = tryRotateCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);

    // L -> 0 (back to original)
    result = tryRotateCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.ZERO);
    expect(result!.kicked).toBe(false);

    expect(result!.piece.pos).toEqual({ x: 3, y: 18 });
  });

  it("should apply JLSTZ-specific wall kick (-1,0) for T-piece 0->R when basic rotation is blocked", () => {
    const board = createBoard();
    // T-piece rotation 0 at (3, 5).  Rot R shape cells:
    //   (0,1) -> (4, 5), (1,1) -> (4, 6), (1,2) -> (5, 6), (2,1) -> (4, 7)
    // Block (4, 5) to make kick 0 (0,0) fail.
    board[5][4] = TetriminoType.S;

    // JLSTZ 0->R kicks: [(0,0), (-1,0), (-1,-1), (0,2), (-1,2)]
    // Kick 1 (-1,0): x=2.  T rot R at (2,5):
    //   (0,1)->(3,5), (1,1)->(3,6), (1,2)->(4,6), (2,1)->(3,7)  All clear => success.
    const piece = {
      type: TetriminoType.T as TetriminoType,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO as RotationState,
    };
    const result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.kicked).toBe(true);
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.piece.pos).toEqual({ x: 2, y: 5 });
  });

  it("should apply I-piece-specific wall kick (-1,0) for I-piece R->2 at the right wall", () => {
    const board = createBoard();
    // I-piece rotation R at (7, 5).  Rot R: col 2 filled -> boardX=9 (right wall).
    // I R->2 kicks: [(0,0), (-1,0), (2,0), (-1,-2), (2,1)]
    // Kick 0 (0,0): I rot 2 at x=7 -> row 2 cols 0-3 -> boardX 7,8,9,10.
    //   x=10 is OOB => collision.
    // Kick 1 (-1,0): I rot 2 at x=6 -> boardX 6,7,8,9 => all in bounds => success.
    const piece = {
      type: TetriminoType.I as TetriminoType,
      pos: { x: 7, y: 5 },
      rotation: RotationState.R as RotationState,
    };
    const result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.kicked).toBe(true);
    expect(result!.piece.rotation).toBe(RotationState.TWO);
    expect(result!.piece.pos).toEqual({ x: 6, y: 5 });
  });
});

describe("tryRotateCCW", () => {
  it("should rotate a T-piece CCW to rotation state L", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.T);
    const result = tryRotateCCW(piece, board);

    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate I-piece CCW to rotation state L", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.I);
    const result = tryRotateCCW(piece, board);

    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
  });

  it("should return O-piece unchanged (no-op)", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.O);
    const result = tryRotateCCW(piece, board);

    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.ZERO);
    expect(result!.kicked).toBe(false);
  });

  it("should apply a wall kick when CCW rotation is blocked by a filled cell", () => {
    const board = createBoard();
    // Place a filled cell at (4, 7) which blocks T rotation L's bottom cell
    // when the piece is at x=3, y=5
    board[7][4] = TetriminoType.S;

    const piece = {
      type: TetriminoType.T as TetriminoType,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO as RotationState,
    } as const;

    const result = tryRotateCCW(piece, board);

    // Kick 2 (1, 0) should move piece to x=4, which avoids the obstruction
    expect(result).not.toBeNull();
    expect(result!.kicked).toBe(true);
    expect(result!.piece.pos.x).toBe(4);
    expect(result!.piece.pos.y).toBe(5);
    expect(result!.piece.rotation).toBe(RotationState.L);
  });

  it("should return null when all CCW wall kicks fail", () => {
    const board = createBoard();

    // Fill every cell
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        board[y][x] = TetriminoType.S;
      }
    }

    // Clear only the cells the T-piece occupies at rotation 0, pos (3, 5)
    board[5][4] = null;
    board[6][3] = null;
    board[6][4] = null;
    board[6][5] = null;

    const piece = {
      type: TetriminoType.T as TetriminoType,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO as RotationState,
    } as const;

    const result = tryRotateCCW(piece, board);
    expect(result).toBeNull();
  });

  it("should rotate S-piece CCW to rotation state L", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.S);
    const result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate Z-piece CCW to rotation state L", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.Z);
    const result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate J-piece CCW to rotation state L", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.J);
    const result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate L-piece CCW to rotation state L", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.L);
    const result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);
  });

  it("should rotate T-piece CCW through all transitions (0->L, L->2, 2->R, R->0)", () => {
    const board = createBoard();
    let piece = spawnPiece(TetriminoType.T);

    // 0 -> L
    let result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);

    // L -> 2
    result = tryRotateCCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.TWO);
    expect(result!.kicked).toBe(false);

    // 2 -> R
    result = tryRotateCCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);

    // R -> 0
    result = tryRotateCCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.ZERO);
    expect(result!.kicked).toBe(false);

    expect(result!.piece.pos).toEqual({ x: 3, y: 19 });
  });

  it("should rotate I-piece CCW through all transitions (0->L, L->2, 2->R, R->0)", () => {
    const board = createBoard();
    let piece = spawnPiece(TetriminoType.I);

    // 0 -> L
    let result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.kicked).toBe(false);

    // L -> 2
    result = tryRotateCCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.TWO);
    expect(result!.kicked).toBe(false);

    // 2 -> R
    result = tryRotateCCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.R);
    expect(result!.kicked).toBe(false);

    // R -> 0
    result = tryRotateCCW(result!.piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.ZERO);
    expect(result!.kicked).toBe(false);

    expect(result!.piece.pos).toEqual({ x: 3, y: 18 });
  });

  it("should apply JLSTZ-specific wall kick for T-piece 0->L CCW when basic rotation is blocked", () => {
    const board = createBoard();
    // T-piece rotation 0 at (3, 5).  Rot L shape cells:
    //   (0,1)->(4,5), (1,0)->(3,6), (1,1)->(4,6), (2,1)->(4,7)
    // Block (4,5) to make kick 0 (0,0) for 0->3 fail.
    // JLSTZ 0->3 kicks: [(0,0), (1,0), (1,-1), (0,2), (1,2)]
    // Kick 1 (1,0): x=4.  T rot L at (4,5):
    //   (0,1)->(5,5), (1,0)->(4,6), (1,1)->(5,6), (2,1)->(5,7)  All clear => success.
    board[5][4] = TetriminoType.S;

    const piece = {
      type: TetriminoType.T as TetriminoType,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO as RotationState,
    };
    const result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.kicked).toBe(true);
    expect(result!.piece.rotation).toBe(RotationState.L);
    expect(result!.piece.pos).toEqual({ x: 4, y: 5 });
  });

  it("should apply I-piece-specific wall kick for I-piece L->2 CCW at the right wall", () => {
    const board = createBoard();
    // I-piece rotation L at (7, 5).  Rot L: col 1 filled -> boardX=8.
    // I L->2 kicks: [(0,0), (-2,0), (1,0), (-2,1), (1,-2)]
    // Kick 0 (0,0): I rot 2 at x=7 -> row 2 cols 0-3 -> boardX 7,8,9,10.
    //   x=10 is OOB => collision.
    // Kick 1 (-2,0): I rot 2 at x=5 -> boardX 5,6,7,8 => all in bounds => success.
    const piece = {
      type: TetriminoType.I as TetriminoType,
      pos: { x: 7, y: 5 },
      rotation: RotationState.L as RotationState,
    };
    const result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.kicked).toBe(true);
    expect(result!.piece.rotation).toBe(RotationState.TWO);
    expect(result!.piece.pos).toEqual({ x: 5, y: 5 });
  });
});

describe("getGhostY", () => {
  it("should drop a piece to the floor on an empty board", () => {
    const board = createBoard();
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 0 },
      rotation: RotationState.ZERO,
    };
    const ghostY = getGhostY(board, piece);

    // T-piece rotation 0: lowest filled cell is at shape row 1 (y+1).
    // Floor at BOARD_HEIGHT=40.
    // ghostY=38 puts bottom cell at y=39. ghostY=39 puts bottom at y=40 (collision).
    expect(ghostY).toBe(38);
  });

  it("should land on top of other locked pieces", () => {
    const board = createBoard();
    // Fill the bottom row completely
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[BOARD_HEIGHT - 1][x] = TetriminoType.S;
    }

    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 0 },
      rotation: RotationState.ZERO,
    };
    const ghostY = getGhostY(board, piece);

    // T's lowest cell at y+1 collides with board row 39.
    // ghostY=37 puts bottom cell at y=38 (above filled row). ghostY=38 puts
    // bottom cell at y=39 which is on the filled row -> collision.
    expect(ghostY).toBe(37);
  });

  it("should land on a piece suspended above the floor", () => {
    const board = createBoard();
    // Place a row of blocks at row 20
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[20][x] = TetriminoType.S;
    }

    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 0 },
      rotation: RotationState.ZERO,
    };
    const ghostY = getGhostY(board, piece);

    // T's lowest cell at y+1. Filled row at board row 20.
    // ghostY=18 puts bottom cell at y=19 (just above filled row).
    // ghostY=19 puts bottom cell at y=20 which is on the filled row -> collision.
    expect(ghostY).toBe(18);
  });

  it("should handle I-piece ghost position", () => {
    const board = createBoard();
    // I-piece rotation 0: filled cells at shape row 1. Lowest cell at y+1.
    const piece = {
      type: TetriminoType.I,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO,
    };
    const ghostY = getGhostY(board, piece);

    // I-piece lowest cell at y+1. Floor at 40.
    // ghostY=38 puts bottom at y=39. ghostY=39 puts bottom at y=40 -> collision.
    expect(ghostY).toBe(38);
  });

  it("should compute correct ghostY for I-piece in rotation R (vertical)", () => {
    const board = createBoard();
    // I-piece rotation R: col 2 filled in all 4 rows (rows 0-3).
    // Lowest cell at shape row 3, so board offset is y+3.
    const piece = {
      type: TetriminoType.I,
      pos: { x: 3, y: 5 },
      rotation: RotationState.R,
    };
    const ghostY = getGhostY(board, piece);

    // Lowest cell at y+3.  Floor at BOARD_HEIGHT=40.
    // ghostY=36 puts lowest at 36+3=39.  ghostY=37 puts lowest at 40 -> collision.
    expect(ghostY).toBe(36);
  });

  it("should stop ghost at obstructions in buffer rows below the piece", () => {
    const board = createBoard();
    // Place a filled row at buffer row 15 (rows 0-19 are buffer).
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[15][x] = TetriminoType.S;
    }

    // T-piece at y=0, rotation 0: lowest filled cell at shape row 1 (y+1).
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 0 },
      rotation: RotationState.ZERO,
    };
    const ghostY = getGhostY(board, piece);

    // Lowest cell at y+1.  Obstruction at row 15.
    // ghostY=13 puts lowest at y+1=14 (above obstruction).
    // ghostY=14 puts lowest at y+1=15 (on obstruction) -> collision.
    expect(ghostY).toBe(13);
  });

  it("should stop ghost at obstructions at various heights", () => {
    const board = createBoard();
    // Place obstructions at different rows.  Closest obstruction wins.
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[10][x] = TetriminoType.J; // obstruction at row 10
    }

    // T-piece at y=0, rotation 0: lowest at y+1.
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 0 },
      rotation: RotationState.ZERO,
    };
    const ghostY = getGhostY(board, piece);

    // ghostY=8 puts lowest at 9 (above row 10).
    // ghostY=9 puts lowest at 10 (on obstruction) -> collision.
    expect(ghostY).toBe(8);
  });

  it("should stop ghost at a specific obstruction when multiple exist at different levels", () => {
    const board = createBoard();
    // Obstructions at rows 12 and 25.
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[12][x] = TetriminoType.Z;
    }
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[25][x] = TetriminoType.J;
    }

    // T-piece at y=5, rotation 0: lowest at y+1.
    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 5 },
      rotation: RotationState.ZERO,
    };
    const ghostY = getGhostY(board, piece);

    // Closest obstruction below the piece is at row 12.
    // ghostY=10 puts lowest at 11 (above row 12).
    // ghostY=11 puts lowest at 12 (on obstruction) -> collision.
    expect(ghostY).toBe(10);
  });

  it("should return ghostY >= piece's current Y for any piece", () => {
    const board = createBoard();
    const types = [
      TetriminoType.I,
      TetriminoType.O,
      TetriminoType.T,
      TetriminoType.S,
      TetriminoType.Z,
      TetriminoType.J,
      TetriminoType.L,
    ];
    const rotations = [
      RotationState.ZERO,
      RotationState.R,
      RotationState.TWO,
      RotationState.L,
    ];

    for (const type of types) {
      for (const rotation of rotations) {
        const piece = {
          type,
          pos: { x: 3, y: 10 },
          rotation,
        };
        const ghostY = getGhostY(board, piece);
        expect(ghostY).toBeGreaterThanOrEqual(piece.pos.y);
      }
    }
  });

  it("should return ghostY >= piece's current Y even when blocked immediately", () => {
    const board = createBoard();
    // Fill row immediately below the piece.
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[11][x] = TetriminoType.S;
    }

    const piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: 10 },
      rotation: RotationState.ZERO,
    };
    const ghostY = getGhostY(board, piece);

    // Piece at y=10, lowest at y+1=11 which is blocked.
    // getGhostY starts at y=10 and checks y=11.  Collision at y=11 -> returns 10.
    expect(ghostY).toBe(10);
    expect(ghostY).toBeGreaterThanOrEqual(piece.pos.y);
  });

  it("should return O-piece unchanged (same position, same rotation) through CW rotation", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.O);
    const result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.ZERO);
    expect(result!.piece.pos).toEqual(piece.pos);
    expect(result!.kicked).toBe(false);
  });

  it("should return O-piece unchanged (same position, same rotation) through CCW rotation", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.O);
    const result = tryRotateCCW(piece, board);
    expect(result).not.toBeNull();
    expect(result!.piece.rotation).toBe(RotationState.ZERO);
    expect(result!.piece.pos).toEqual(piece.pos);
    expect(result!.kicked).toBe(false);
  });

  it("should not change O-piece position after multiple CW rotations", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.O);

    // Multiple CW rotations should all return the same piece.
    const r1 = tryRotateCW(piece, board);
    expect(r1!.piece.pos).toEqual(piece.pos);

    const r2 = tryRotateCW(r1!.piece, board);
    expect(r2!.piece.pos).toEqual(piece.pos);

    const r3 = tryRotateCW(r2!.piece, board);
    expect(r3!.piece.pos).toEqual(piece.pos);
  });

  it("should not change O-piece position after multiple CCW rotations", () => {
    const board = createBoard();
    const piece = spawnPiece(TetriminoType.O);

    const r1 = tryRotateCCW(piece, board);
    expect(r1!.piece.pos).toEqual(piece.pos);

    const r2 = tryRotateCCW(r1!.piece, board);
    expect(r2!.piece.pos).toEqual(piece.pos);

    const r3 = tryRotateCCW(r2!.piece, board);
    expect(r3!.piece.pos).toEqual(piece.pos);
  });
});
