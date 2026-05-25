import { describe, it, expect } from "vitest";
import {
  detectTSpin,
  evaluateClear,
  isB2BEligible,
  addHardDropScore,
  effectiveLinesFor,
  calculateLevelFromEffective,
} from "./scoring.ts";
import { TetriminoType, RotationState, type GameState, type Board } from "./types.ts";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants.ts";

function emptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<string | null>(BOARD_WIDTH).fill(null),
  );
}

function makeTSPiece(rot: RotationState, x: number, y: number) {
  return { type: TetriminoType.T, pos: { x, y }, rotation: rot };
}

describe("detectTSpin", () => {
  it("should return false for non-T pieces", () => {
    const board = emptyBoard();
    const piece = { type: TetriminoType.S, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO };
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(false);
    expect(result.isMini).toBe(false);
  });

  it("should return false when fewer than 3 corners occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.ZERO, 3, 18);
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(false);
  });

  it("should detect a T-spin when 3+ corners include both back", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.ZERO, 3, 18);
    // For rot 0 (ZERO): back = TL(3,18), TR(5,18). Front = BL(3,20), BR(5,20)
    // Fill both back corners + 1 front corner
    board[18][3] = TetriminoType.Z; // TL (back)
    board[18][5] = TetriminoType.Z; // TR (back)
    board[20][3] = TetriminoType.Z; // BL (front) — 3rd

    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it("should detect T-spin Mini when 3 corners but 1 back free", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.ZERO, 3, 18);
    // For rot 0: back = TL(3,18), TR(5,18)
    // Fill TL (back), BL (front), BR (front). Leave TR (back) free.
    board[18][3] = TetriminoType.Z; // TL (back)
    board[20][3] = TetriminoType.Z; // BL (front)
    board[20][5] = TetriminoType.Z; // BR (front)

    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(true);
  });

  it("should consider out-of-bounds as occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.TWO, 3, -1);
    // For rot 2 (TWO): back = BL(3,1), BR(5,1). Front = TL(3,-1), TR(5,-1)
    // TL and TR are OOB → occupied
    // Fill BL and BR
    board[1][3] = TetriminoType.Z; // BL (back)
    board[1][5] = TetriminoType.Z; // BR (back)
    // That gives 4 occupied (2 OOB + 2 filled), both back filled → T-spin

    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
  });

  it("should test each rotation state", () => {
    const board = emptyBoard();
    // Piece at (3, 10) rot R: corners TL(3,10), TR(5,10), BL(3,12), BR(5,12)
    // For rot R: back = TR(5,10), BR(5,12)
    board[10][5] = TetriminoType.T; // TR (back)
    board[12][5] = TetriminoType.T; // BR (back)
    board[10][3] = TetriminoType.T; // TL (front) — 3rd

    const result = detectTSpin(board, makeTSPiece(RotationState.R, 3, 10));
    expect(result.isTSpin).toBe(true);
  });
});

describe("evaluateClear", () => {
  const r = { isTSpin: false, isMini: false };

  it("should score line clears × level", () => {
    expect(evaluateClear(1, r, 0, false, false).score).toBe(100);
    expect(evaluateClear(2, r, 0, false, false).score).toBe(300);
    expect(evaluateClear(3, r, 0, false, false).score).toBe(500);
    expect(evaluateClear(4, r, 0, false, false).score).toBe(800);
    expect(evaluateClear(1, r, 4, false, false).score).toBe(500);
  });

  it("should score T-spin bonuses", () => {
    const ts = { isTSpin: true, isMini: false };
    expect(evaluateClear(0, ts, 0, false, false).score).toBe(400);
    expect(evaluateClear(1, ts, 0, false, false).score).toBe(800);
    expect(evaluateClear(2, ts, 0, false, false).score).toBe(1200);
    expect(evaluateClear(3, ts, 0, false, false).score).toBe(1600);
  });

  it("should score T-spin Mini bonuses", () => {
    const m = { isTSpin: true, isMini: true };
    expect(evaluateClear(0, m, 0, false, false).score).toBe(100);
    expect(evaluateClear(1, m, 0, false, false).score).toBe(200);
    // Mini can clear at most 1 line; linesCleared=2 is geometrically impossible,
    // but the scorer clamps to 1 (same as single).
    expect(evaluateClear(2, m, 0, false, false).score).toBe(200);
  });

  it("should apply back-to-back multiplier", () => {
    const ts = { isTSpin: true, isMini: false };
    const result = evaluateClear(2, ts, 0, true, false);
    expect(result.score).toBe(1200 * 1.5);
    expect(result.isB2B).toBe(true);
  });

  it("should break back-to-back on non-eligible clear", () => {
    const normal = { isTSpin: false, isMini: false };
    const broke = evaluateClear(1, normal, 1, true, false);
    expect(broke.isB2B).toBe(false);
    expect(broke.isB2BBroken).toBe(true);
  });

  it("scores 100 at game start (level 0 = TDG Level 1)", () => {
    expect(evaluateClear(1, { isTSpin: false, isMini: false }, 0, false, false).score).toBe(100);
  });

  it("scores 800 for Tetris at game start (level 0 = TDG Level 1)", () => {
    expect(evaluateClear(4, { isTSpin: false, isMini: false }, 0, false, false).score).toBe(800);
  });

  it("scores 400 for T-spin no-clear at game start", () => {
    expect(evaluateClear(0, { isTSpin: true, isMini: false }, 0, false, false).score).toBe(400);
  });
});

describe("Mini T-Spin scoring", () => {
  it("Mini T-Spin with 0 lines cleared scores 100 × level", () => {
    const result = evaluateClear(
      0,
      { isTSpin: true, isMini: true },
      0,   // level (0-based, so TDG Level 1)
      false,
      false,
    );
    expect(result.score).toBe(100); // 100 × (0+1) = 100
  });

  it("Mini T-Spin with 0 lines at level 3 scores 300", () => {
    const result = evaluateClear(
      0,
      { isTSpin: true, isMini: true },
      2,   // level (0-based, so TDG Level 3)
      false,
      false,
    );
    expect(result.score).toBe(300); // 100 × (2+1) = 300
  });
});

describe("isB2BEligible", () => {
  it("should return true for Tetris and T-spins", () => {
    expect(isB2BEligible(4, { isTSpin: false, isMini: false })).toBe(true);
    expect(isB2BEligible(1, { isTSpin: true, isMini: false })).toBe(true);
    expect(isB2BEligible(0, { isTSpin: true, isMini: true })).toBe(true);
  });

  it("should return false for non-Tetris standard clears", () => {
    expect(isB2BEligible(1, { isTSpin: false, isMini: false })).toBe(false);
    expect(isB2BEligible(3, { isTSpin: false, isMini: false })).toBe(false);
  });
});

describe("drop scoring", () => {
  const s = { level: 1 } as GameState;
  it("should score hard drop 2 per cell", () => {
    expect(addHardDropScore(s, 5)).toBe(10);
  });
});

describe("detectTSpin - rotation state ZERO", () => {
  it("full T-spin: both back (TL, TR) + 1 front occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.ZERO, 3, 18);
    // ZERO: back = TL(3,18), TR(5,18), front = BL(3,20), BR(5,20)
    board[18][3] = TetriminoType.Z; // TL - back
    board[18][5] = TetriminoType.Z; // TR - back
    board[20][3] = TetriminoType.Z; // BL - front (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it("T-spin Mini: both front (BL, BR) + 1 back occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.ZERO, 3, 18);
    board[20][3] = TetriminoType.Z; // BL - front
    board[20][5] = TetriminoType.Z; // BR - front
    board[18][3] = TetriminoType.Z; // TL - back (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(true);
  });

  it("returns false when only 2 front corners occupied (fewer than 3)", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.ZERO, 3, 18);
    board[20][3] = TetriminoType.Z; // BL - front
    board[20][5] = TetriminoType.Z; // BR - front
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(false);
    expect(result.isMini).toBe(false);
  });
});

describe("detectTSpin - rotation state R", () => {
  it("full T-spin: both back (TR, BR) + 1 front occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.R, 3, 18);
    // R: back = TR(5,18), BR(5,20), front = TL(3,18), BL(3,20)
    board[18][5] = TetriminoType.Z; // TR - back
    board[20][5] = TetriminoType.Z; // BR - back
    board[18][3] = TetriminoType.Z; // TL - front (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it("T-spin Mini: both front (TL, BL) + 1 back occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.R, 3, 18);
    board[18][3] = TetriminoType.Z; // TL - front
    board[20][3] = TetriminoType.Z; // BL - front
    board[18][5] = TetriminoType.Z; // TR - back (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(true);
  });

  it("returns false when only 2 front corners occupied (fewer than 3)", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.R, 3, 18);
    board[18][3] = TetriminoType.Z; // TL - front
    board[20][3] = TetriminoType.Z; // BL - front
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(false);
    expect(result.isMini).toBe(false);
  });
});

describe("detectTSpin - rotation state TWO", () => {
  it("full T-spin: both back (BL, BR) + 1 front occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.TWO, 3, 18);
    // TWO: back = BL(3,20), BR(5,20), front = TL(3,18), TR(5,18)
    board[20][3] = TetriminoType.Z; // BL - back
    board[20][5] = TetriminoType.Z; // BR - back
    board[18][3] = TetriminoType.Z; // TL - front (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it("T-spin Mini: both front (TL, TR) + 1 back occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.TWO, 3, 18);
    board[18][3] = TetriminoType.Z; // TL - front
    board[18][5] = TetriminoType.Z; // TR - front
    board[20][3] = TetriminoType.Z; // BL - back (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(true);
  });

  it("returns false when only 2 front corners occupied (fewer than 3)", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.TWO, 3, 18);
    board[18][3] = TetriminoType.Z; // TL - front
    board[18][5] = TetriminoType.Z; // TR - front
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(false);
    expect(result.isMini).toBe(false);
  });
});

describe("detectTSpin - rotation state L", () => {
  it("full T-spin: both back (TL, BL) + 1 front occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.L, 3, 18);
    // L: back = TL(3,18), BL(3,20), front = TR(5,18), BR(5,20)
    board[18][3] = TetriminoType.Z; // TL - back
    board[20][3] = TetriminoType.Z; // BL - back
    board[18][5] = TetriminoType.Z; // TR - front (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it("T-spin Mini: both front (TR, BR) + 1 back occupied", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.L, 3, 18);
    board[18][5] = TetriminoType.Z; // TR - front
    board[20][5] = TetriminoType.Z; // BR - front
    board[18][3] = TetriminoType.Z; // TL - back (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(true);
  });

  it("returns false when only 2 front corners occupied (fewer than 3)", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.L, 3, 18);
    board[18][5] = TetriminoType.Z; // TR - front
    board[20][5] = TetriminoType.Z; // BR - front
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(false);
    expect(result.isMini).toBe(false);
  });
});

describe("detectTSpin - edge cases", () => {
  it("all 4 corners occupied is a full T-spin", () => {
    const board = emptyBoard();
    const piece = makeTSPiece(RotationState.ZERO, 3, 18);
    board[18][3] = TetriminoType.Z;
    board[18][5] = TetriminoType.Z;
    board[20][3] = TetriminoType.Z;
    board[20][5] = TetriminoType.Z;
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it("flush against floor: OOB bottom corners count as occupied", () => {
    const board = emptyBoard();
    // 40 rows (indices 0-39). Piece at y=38.
    // BL(3,40) and BR(5,40) are OOB -> occupied.
    const piece = makeTSPiece(RotationState.TWO, 3, 38);
    // TWO: back = BL(3,40) OOB, BR(5,40) OOB -> both occupied
    board[38][3] = TetriminoType.Z; // TL - front (3rd corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it("flush against wall: OOB side corners count as occupied", () => {
    const board = emptyBoard();
    // Piece at x=-1: TL(-1,18) and BL(-1,20) are OOB
    const piece = makeTSPiece(RotationState.ZERO, -1, 18);
    // ZERO: back = TL(-1,18) OOB occupied, TR(1,18)
    board[18][1] = TetriminoType.Z; // TR - back (2nd back corner)
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it.each([
    TetriminoType.I,
    TetriminoType.O,
    TetriminoType.S,
    TetriminoType.Z,
    TetriminoType.J,
    TetriminoType.L,
  ])("returns false for non-T piece %s", (type) => {
    const board = emptyBoard();
    const piece = { type, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO };
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(false);
    expect(result.isMini).toBe(false);
  });
});

describe("evaluateClear - level scaling", () => {
  const r = { isTSpin: false, isMini: false };

  it("all line clear values scaled by level 5", () => {
    expect(evaluateClear(1, r, 4, false, false).score).toBe(500);  // 100 * (4+1)
    expect(evaluateClear(2, r, 4, false, false).score).toBe(1500); // 300 * (4+1)
    expect(evaluateClear(3, r, 4, false, false).score).toBe(2500); // 500 * (4+1)
    expect(evaluateClear(4, r, 4, false, false).score).toBe(4000); // 800 * (4+1)
  });

  it("T-spin scores scaled by level 5", () => {
    const ts = { isTSpin: true, isMini: false };
    expect(evaluateClear(0, ts, 4, false, false).score).toBe(2000);  // 400 * (4+1)
    expect(evaluateClear(1, ts, 4, false, false).score).toBe(4000);  // 800 * (4+1)
    expect(evaluateClear(2, ts, 4, false, false).score).toBe(6000);  // 1200 * (4+1)
    expect(evaluateClear(3, ts, 4, false, false).score).toBe(8000);  // 1600 * (4+1)
  });

  it("T-spin Mini scores scaled by level 5", () => {
    const m = { isTSpin: true, isMini: true };
    expect(evaluateClear(0, m, 4, false, false).score).toBe(500);  // 100 * (4+1)
    expect(evaluateClear(1, m, 4, false, false).score).toBe(1000); // 200 * (4+1)
    expect(evaluateClear(2, m, 4, false, false).score).toBe(1000); // clamped to 1-line score
  });
});

describe("evaluateClear - back-to-back", () => {
  const r = { isTSpin: false, isMini: false };
  const ts = { isTSpin: true, isMini: false };

  it("B2B becomes true on first eligible clear but no multiplier yet", () => {
    // Tetris eligible, isB2BActive=false -> streak starts, no multiplier
    const result = evaluateClear(4, r, 0, false, false);
    expect(result.score).toBe(800);
    expect(result.isB2B).toBe(true);
    expect(result.isB2BBroken).toBe(false);
  });

  it("second consecutive eligible clear gets B2B multiplier", () => {
    // Tetris eligible, isB2BActive=true -> streak continues, multiplier applied
    const result = evaluateClear(4, r, 0, true, false);
    expect(result.score).toBe(Math.floor(800 * 1.5));
    expect(result.isB2B).toBe(true);
    expect(result.isB2BBroken).toBe(false);
  });

  it("first T-spin with isB2BActive=false starts B2B without multiplier", () => {
    const result = evaluateClear(1, ts, 0, false, false);
    expect(result.score).toBe(800); // base T-spin single, no multiplier
    expect(result.isB2B).toBe(true);
    expect(result.isB2BBroken).toBe(false);
  });
});

describe("Perfect Clear scoring", () => {
  const r = { isTSpin: false, isMini: false };

  it("PC Single: 800 × (level+1)", () => {
    expect(evaluateClear(1, r, 0, false, true).score).toBe(800);   // 800*(0+1)
    expect(evaluateClear(1, r, 1, false, true).score).toBe(1600);  // 800*(1+1)
  });

  it("PC Double: 1200 × (level+1)", () => {
    expect(evaluateClear(2, r, 0, false, true).score).toBe(1200);
  });

  it("PC Triple: 1800 × (level+1)", () => {
    expect(evaluateClear(3, r, 0, false, true).score).toBe(1800);
  });

  it("PC Tetris: 2000 × (level+1)", () => {
    const result = evaluateClear(4, r, 0, false, true);
    expect(result.score).toBe(2000);
    expect(result.isB2B).toBe(true); // Tetris PC starts a B2B streak
  });

  it("B2B PC Tetris: 3200 × (level+1)", () => {
    expect(evaluateClear(4, r, 0, true, true).score).toBe(3200);   // (0+1)*3200
    expect(evaluateClear(4, r, 1, true, true).score).toBe(6400);   // (1+1)*3200
    expect(evaluateClear(4, r, 0, true, true).isB2B).toBe(true);
  });

  it("PC Single breaks B2B streak (not B2B-eligible)", () => {
    const result = evaluateClear(1, r, 0, true, true);
    expect(result.isB2B).toBe(false);
    expect(result.isB2BBroken).toBe(true);
  });
});

describe("drop scoring - level independence", () => {
  it("hard drop is always 2 per cell regardless of level", () => {
    const low = { level: 0 } as GameState;
    const high = { level: 99 } as GameState;
    expect(addHardDropScore(low, 5)).toBe(10);
    expect(addHardDropScore(high, 5)).toBe(10);
  });
});

describe("effectiveLinesFor (Variable Goal TDG §11)", () => {
  it("Single = 1 effective line", () => {
    expect(effectiveLinesFor(1, { isTSpin: false, isMini: false }, false)).toBe(1);
  });
  it("Double = 3 effective lines", () => {
    expect(effectiveLinesFor(2, { isTSpin: false, isMini: false }, false)).toBe(3);
  });
  it("Triple = 5 effective lines", () => {
    expect(effectiveLinesFor(3, { isTSpin: false, isMini: false }, false)).toBe(5);
  });
  it("Tetris = 8 effective lines", () => {
    expect(effectiveLinesFor(4, { isTSpin: false, isMini: false }, false)).toBe(8);
  });
  it("T-Spin zero lines = 4 effective lines", () => {
    expect(effectiveLinesFor(0, { isTSpin: true, isMini: false }, false)).toBe(4);
  });
  it("T-Spin Single = 8 effective lines", () => {
    expect(effectiveLinesFor(1, { isTSpin: true, isMini: false }, false)).toBe(8);
  });
  it("T-Spin Double = 12 effective lines", () => {
    expect(effectiveLinesFor(2, { isTSpin: true, isMini: false }, false)).toBe(12);
  });
  it("T-Spin Triple = 16 effective lines", () => {
    expect(effectiveLinesFor(3, { isTSpin: true, isMini: false }, false)).toBe(16);
  });
  it("Mini T-Spin zero = 1 effective line", () => {
    expect(effectiveLinesFor(0, { isTSpin: true, isMini: true }, false)).toBe(1);
  });
  it("Mini T-Spin Single = 2 effective lines", () => {
    expect(effectiveLinesFor(1, { isTSpin: true, isMini: true }, false)).toBe(2);
  });
  it("B2B Tetris = floor(8 * 1.5) = 12", () => {
    expect(effectiveLinesFor(4, { isTSpin: false, isMini: false }, true)).toBe(12);
  });
  it("B2B T-Spin Double = floor(12 * 1.5) = 18", () => {
    expect(effectiveLinesFor(2, { isTSpin: true, isMini: false }, true)).toBe(18);
  });
  it("no clear, no T-spin = 0 effective lines", () => {
    expect(effectiveLinesFor(0, { isTSpin: false, isMini: false }, false)).toBe(0);
  });
});

describe("calculateLevelFromEffective (Variable Goal TDG §11)", () => {
  it("0 effective lines = level 0", () => {
    expect(calculateLevelFromEffective(0)).toBe(0);
  });
  it("4 effective lines = level 0", () => {
    expect(calculateLevelFromEffective(4)).toBe(0);
  });
  it("5 effective lines = level 1", () => {
    expect(calculateLevelFromEffective(5)).toBe(1);
  });
  it("14 effective lines = level 1", () => {
    expect(calculateLevelFromEffective(14)).toBe(1);
  });
  it("15 effective lines = level 2", () => {
    expect(calculateLevelFromEffective(15)).toBe(2);
  });
  it("599 effective lines = level 14", () => {
    expect(calculateLevelFromEffective(599)).toBe(14);
  });
  it("600 effective lines = level 15", () => {
    expect(calculateLevelFromEffective(600)).toBe(15);
  });
  it("beyond 600 stays at level 15", () => {
    expect(calculateLevelFromEffective(999)).toBe(15);
  });
});
