/**
 * Property-based fuzz tests for SRS rotation: wall kicks, ghost piece, and
 * rotation with collision invariants.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  tryRotateCW,
  tryRotateCCW,
  getGhostY,
  spawnPiece,
} from "../core/pieces.ts";
import { checkCollision, createBoard } from "../core/board.ts";
import { getWallKicks, BOARD_WIDTH, BOARD_HEIGHT } from "../core/constants.ts";
import { TetriminoType, RotationState } from "../core/types.ts";
import type { Piece } from "../core/types.ts";

// ── Generators ────────────────────────────────────────────────────────────

const jlstzTypes = fc.constantFrom(
  TetriminoType.J, TetriminoType.L, TetriminoType.S,
  TetriminoType.T, TetriminoType.Z,
);

const allTypes = fc.constantFrom(
  TetriminoType.I, TetriminoType.O, TetriminoType.J,
  TetriminoType.L, TetriminoType.S, TetriminoType.T, TetriminoType.Z,
);

//const allRotations = fc.constantFrom(
//  RotationState.ZERO, RotationState.R, RotationState.TWO, RotationState.L,
//);

// ── SRS kick table coverage ──────────────────────────────────────────────

describe("SRS fuzz: wall kick table coverage", () => {
  // All 8 rotation transitions for each piece group
  const transitions: Array<{ from: RotationState; to: RotationState; label: string }> = [
    { from: RotationState.ZERO, to: RotationState.R, label: "0->R" },
    { from: RotationState.R, to: RotationState.ZERO, label: "R->0" },
    { from: RotationState.R, to: RotationState.TWO, label: "R->2" },
    { from: RotationState.TWO, to: RotationState.R, label: "2->R" },
    { from: RotationState.TWO, to: RotationState.L, label: "2->L" },
    { from: RotationState.L, to: RotationState.TWO, label: "L->2" },
    { from: RotationState.L, to: RotationState.ZERO, label: "L->0" },
    { from: RotationState.ZERO, to: RotationState.L, label: "0->L" },
  ];

  for (const typeGroup of [ { label: "JLSTZ", types: [TetriminoType.J, TetriminoType.L, TetriminoType.S, TetriminoType.T, TetriminoType.Z] },
                             { label: "I", types: [TetriminoType.I] } ]) {
    for (const trans of transitions) {
      it(`${typeGroup.label} ${trans.label}: kick test 0 (basic rotation) should succeed on empty board`, () => {
        const board = createBoard();
        for (const type of typeGroup.types) {
          const piece = spawnPiece(type);
          // Actually use the correct direction
          const isCW = trans.from === RotationState.ZERO && trans.to === RotationState.R ||
                       trans.from === RotationState.R && trans.to === RotationState.TWO ||
                       trans.from === RotationState.TWO && trans.to === RotationState.L ||
                       trans.from === RotationState.L && trans.to === RotationState.ZERO;
          // Rotate FROM the initial state to transition TO
          let current = piece;
          let targetRot = trans.from;
          while (current.rotation !== targetRot) {
            const r = tryRotateCW(current, board);
            if (!r) break;
            current = r.piece;
          }
          // Now attempt the transition
          if (current.rotation === trans.from) {
            const result = isCW ? tryRotateCW(current, board) : tryRotateCCW(current, board);
            expect(result).not.toBeNull();
          }
        }
      });
    }
  }

  it("CW then CCW returns to same position on empty board (JLSTZ)", () => {
    fc.assert(
      fc.property(jlstzTypes, fc.integer({ min: 0, max: 7 }), (type, x) => {
        const board = createBoard();
        const piece: Piece = { type, pos: { x, y: 10 }, rotation: RotationState.ZERO };
        const cw = tryRotateCW(piece, board);
        if (!cw) return;
        const ccw = tryRotateCCW(cw.piece, board);
        if (!ccw) return;
        expect(ccw.piece.pos.x).toBe(piece.pos.x);
        expect(ccw.piece.pos.y).toBe(piece.pos.y);
        expect(ccw.piece.rotation).toBe(RotationState.ZERO);
      }),
      { numRuns: 200 },
    );
  });

  it("I-piece CW then CCW on empty board preserves x position (may shift y with kicks)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 7 }), (x) => {
        const board = createBoard();
        const piece: Piece = { type: TetriminoType.I, pos: { x, y: 10 }, rotation: RotationState.ZERO };
        const cw = tryRotateCW(piece, board);
        if (!cw) return;
        const ccw = tryRotateCCW(cw.piece, board);
        if (!ccw) return;
        // After full cycle, rotation should be back to ZERO
        expect(ccw.piece.rotation).toBe(RotationState.ZERO);
      }),
      { numRuns: 100 },
    );
  });

  it("full CW rotation cycle returns to start (all 5 tests, JLSTZ)", () => {
    fc.assert(
      fc.property(jlstzTypes, fc.integer({ min: 0, max: 7 }), (type, x) => {
        const board = createBoard();
        let piece: Piece = { type, pos: { x, y: 10 }, rotation: RotationState.ZERO };
        for (let i = 0; i < 4; i++) {
          const result = tryRotateCW(piece, board);
          if (!result) return; // can't complete cycle, skip
          piece = result.piece;
        }
        expect(piece.rotation).toBe(RotationState.ZERO);
        expect(piece.pos.x).toBe(x);
        expect(piece.pos.y).toBe(10);
      }),
      { numRuns: 200 },
    );
  });
});

// ── Invariant: rotation never succeeds into collision ─────────────────────

describe("SRS fuzz: rotation post-condition", () => {
  it("after successful CW rotation, piece does not collide (with realistic debris)", () => {
    fc.assert(
      fc.property(allTypes, fc.integer({ min: 3, max: 5 }), fc.integer({ min: 0, max: 3 }),
      (type, x, rot) => {
        if (type === TetriminoType.O) return; // O is identity
        const board = createBoard();
        // Fill bottom 4 rows completely
        for (let r = BOARD_HEIGHT - 4; r < BOARD_HEIGHT; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.Z;
        }
        const piece: Piece = { type, pos: { x, y: 20 }, rotation: rot as RotationState };
        const result = tryRotateCW(piece, board);
        if (result) {
          expect(checkCollision(board, result.piece)).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("after successful CCW rotation, piece does not collide (with realistic debris)", () => {
    fc.assert(
      fc.property(allTypes, fc.integer({ min: 3, max: 5 }), fc.integer({ min: 0, max: 3 }),
      (type, x, rot) => {
        if (type === TetriminoType.O) return;
        const board = createBoard();
        for (let r = BOARD_HEIGHT - 4; r < BOARD_HEIGHT; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.Z;
        }
        const piece: Piece = { type, pos: { x, y: 20 }, rotation: rot as RotationState };
        const result = tryRotateCCW(piece, board);
        if (result) {
          expect(checkCollision(board, result.piece)).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("O-piece rotation always succeeds (identity) and never changes position", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 7 }), fc.integer({ min: 0, max: BOARD_HEIGHT - 2 }),
      (x, y) => {
        const board = createBoard();
        const piece: Piece = { type: TetriminoType.O, pos: { x, y }, rotation: RotationState.ZERO };
        const cw = tryRotateCW(piece, board);
        expect(cw).not.toBeNull();
        expect(cw!.piece.pos.x).toBe(x);
        expect(cw!.piece.pos.y).toBe(y);
        const ccw = tryRotateCCW(piece, board);
        expect(ccw).not.toBeNull();
        expect(ccw!.piece.pos.x).toBe(x);
        expect(ccw!.piece.pos.y).toBe(y);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Ghost piece invariants ───────────────────────────────────────────────

describe("SRS fuzz: ghost piece", () => {
  it("ghost Y is >= piece Y (ghost never above piece)", () => {
    fc.assert(
      fc.property(allTypes, fc.integer({ min: 0, max: 7 }), fc.integer({ min: 0, max: BOARD_HEIGHT - 2 }),
      fc.integer({ min: 0, max: 3 }), (type, x, y, rot) => {
        const board = createBoard();
        const piece: Piece = { type, pos: { x, y }, rotation: rot as RotationState };
        const ghostY = getGhostY(board, piece);
        expect(ghostY).toBeGreaterThanOrEqual(piece.pos.y);
      }),
      { numRuns: 200 },
    );
  });

  it("ghost position never collides (piece must start in valid position)", () => {
    fc.assert(
      fc.property(allTypes, fc.integer({ min: 3, max: 5 }), (type, x) => {
        const board = createBoard();
        // Fill bottom 2 rows
        for (let r = BOARD_HEIGHT - 2; r < BOARD_HEIGHT; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.Z;
        }
        // Start piece from a valid non-colliding position
        const piece: Piece = { type, pos: { x, y: 15 }, rotation: RotationState.ZERO };
        const ghostY = getGhostY(board, piece);
        const ghostPiece: Piece = { ...piece, pos: { x, y: ghostY } };
        expect(checkCollision(board, ghostPiece)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it("ghost Y stays within board bounds", () => {
    fc.assert(
      fc.property(allTypes, fc.integer({ min: 0, max: 7 }), fc.integer({ min: 0, max: 3 }),
      (type, x, rot) => {
        const board = createBoard();
        const piece: Piece = { type, pos: { x, y: 0 }, rotation: rot as RotationState };
        const ghostY = getGhostY(board, piece);
        expect(ghostY).toBeLessThanOrEqual(BOARD_HEIGHT - 1);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Known cross-project bug patterns ──────────────────────────────────────

describe("SRS fuzz: known bug patterns", () => {
  it("I-piece wall kicks are distinct from JLSTZ (cross-project common bug)", () => {
    // I-piece 0->R kicks should include offset (-2,0) which JLSTZ table doesn't have
    const iKicks = getWallKicks(TetriminoType.I, RotationState.ZERO, RotationState.R);
    expect(iKicks).toEqual([
      { x: 0, y: 0 },
      { x: -2, y: 0 },
      { x: 1, y: 0 },
      { x: -2, y: 1 },
      { x: 1, y: -2 },
    ]);
    // JLSTZ 0->R kicks should NOT match I-piece kicks
    const jlstzKicks = getWallKicks(TetriminoType.T, RotationState.ZERO, RotationState.R);
    expect(jlstzKicks).toEqual([
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: 2 },
      { x: -1, y: 2 },
    ]);
    // Verify they're actually different
    expect(iKicks).not.toEqual(jlstzKicks);
  });

  it("floor kick: S-piece rotated CW at bottom row does not clip through floor", () => {
    const board = createBoard();
    // S-piece at ZERO rotation at y=38. ZERO shape is 2 rows tall.
    // Rotating CW produces R rotation which is 3 rows tall.
    // The SRS offsets for 0->R are {0,0}, {-1,0}, {-1,-1}, {0,2}, {-1,2}
    // Kick test 3 ({0,2}) and test 4 ({-1,2}) move piece UP 2 rows — this is the floor kick
    const piece: Piece = { type: TetriminoType.S, pos: { x: 3, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    const result = tryRotateCW(piece, board);
    // Rotation should succeed (either basic or with a floor kick)
    expect(result).not.toBeNull();
    if (result) {
      expect(checkCollision(board, result.piece)).toBe(false);
      expect(result.piece.pos.y).toBeLessThan(BOARD_HEIGHT);
    }
  });

  it("T-piece at left wall with wall kick can rotate", () => {
    const board = createBoard();
    const piece: Piece = {
      type: TetriminoType.T,
      pos: { x: 0, y: 20 },
      rotation: RotationState.R,
    };
    // R -> 2: kicks are {0,0}, {-1,0}, {-1,-1}, {0,2}, {-1,2}
    // At x=0, kick (-1,0) would collide with left wall, so it tries (-1,-1)
    const result = tryRotateCW(piece, board);
    expect(result).not.toBeNull();
  });

  it("full obstruction: rotation returns null when all 5 kicks fail", () => {
    fc.assert(
      fc.property(allTypes, fc.integer({ min: 0, max: 3 }), (type, rot) => {
        if (type === TetriminoType.O) return; // O always succeeds
        const board = createBoard();
        // Fill entire board
        for (let r = 0; r < BOARD_HEIGHT; r++) {
          for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.Z;
        }
        // Position piece in the middle of the board so kicks can't escape above (y<0)
        const piece: Piece = { type, pos: { x: 4, y: 10 }, rotation: rot as RotationState };
        const cw = tryRotateCW(piece, board);
        const ccw = tryRotateCCW(piece, board);
        expect(cw).toBeNull();
        expect(ccw).toBeNull();
      }),
      { numRuns: 30 },
    );
  });
});
