import { describe, it, expect } from "vitest";
import {
  PIECE_SHAPES,
  PIECE_COLORS,
  getWallKicks,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from "./constants.ts";
import { TetriminoType, RotationState } from "./types.ts";

const ALL_TYPES = [
  TetriminoType.I,
  TetriminoType.O,
  TetriminoType.T,
  TetriminoType.S,
  TetriminoType.Z,
  TetriminoType.J,
  TetriminoType.L,
] as const;

const TRANSITIONS: [RotationState, RotationState][] = [
  [RotationState.ZERO, RotationState.R],
  [RotationState.R, RotationState.TWO],
  [RotationState.TWO, RotationState.L],
  [RotationState.L, RotationState.ZERO],
  [RotationState.R, RotationState.ZERO],
  [RotationState.TWO, RotationState.R],
  [RotationState.L, RotationState.TWO],
  [RotationState.ZERO, RotationState.L],
];

describe("PIECE_COLORS", () => {
  it("should have an entry for every TetriminoType", () => {
    for (const t of ALL_TYPES) {
      expect(PIECE_COLORS[t]).toBeDefined();
      expect(typeof PIECE_COLORS[t]).toBe("string");
    }
  });

  it("should have valid hex color strings", () => {
    for (const t of ALL_TYPES) {
      expect(PIECE_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("PIECE_SHAPES", () => {
  it("should have an entry for every TetriminoType", () => {
    for (const t of ALL_TYPES) {
      expect(PIECE_SHAPES[t]).toBeDefined();
    }
  });

  it("should have exactly 4 rotation states per piece", () => {
    for (const t of ALL_TYPES) {
      expect(PIECE_SHAPES[t]).toHaveLength(4);
    }
  });

  it("should have a 4x4 grid for each rotation state", () => {
    for (const t of ALL_TYPES) {
      for (let r = 0; r < 4; r++) {
        const grid = PIECE_SHAPES[t][r];
        expect(grid).toHaveLength(4);
        for (let row = 0; row < 4; row++) {
          expect(grid[row]).toHaveLength(4);
        }
      }
    }
  });

  it("should have exactly 4 filled cells per rotation state", () => {
    for (const t of ALL_TYPES) {
      for (let r = 0; r < 4; r++) {
        const grid = PIECE_SHAPES[t][r];
        let count = 0;
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 4; col++) {
            if (grid[row][col]) count++;
          }
        }
        expect(count).toBe(4);
      }
    }
  });

  it("should have all 4 O-piece rotations identical", () => {
    const o0 = PIECE_SHAPES[TetriminoType.O][0];
    for (let r = 1; r < 4; r++) {
      expect(PIECE_SHAPES[TetriminoType.O][r]).toEqual(o0);
    }
  });

  it("should not have filled cells beyond board left/right edges when spawned at default position", () => {
    // Spawn X = 3 for standard, 3 for I.  The shape uses cols 0-3 of the 4x4 grid.
    // Board coord = spawnX + col.  Must be < BOARD_WIDTH (no overflow on right).
    for (const t of ALL_TYPES) {
      for (let r = 0; r < 4; r++) {
        const grid = PIECE_SHAPES[t][r];
        const spawnX = t === TetriminoType.I ? 3 : 3;
        for (let col = 0; col < 4; col++) {
          if (!grid.some(row => row[col])) continue;
          // Filled cell in this column — must map to a valid board column
          const boardX = spawnX + col;
          expect(boardX).toBeLessThan(BOARD_WIDTH);
        }
      }
    }
  });

  it("should not have filled cells above board height when spawned", () => {
    // All pieces spawn at y=19 (or y=18 for I).  The 4x4 shape grid rows 0-3
    // map to board rows 19-22 (or 18-21).  No cells should be below BOARD_HEIGHT.
    for (const t of ALL_TYPES) {
      for (let r = 0; r < 4; r++) {
        const grid = PIECE_SHAPES[t][r];
        const spawnY = t === TetriminoType.I ? 18 : 19;
        for (let row = 0; row < 4; row++) {
          if (!grid[row].some(c => c)) continue;
          const boardY = spawnY + row;
          expect(boardY).toBeLessThan(BOARD_HEIGHT);
        }
      }
    }
  });

  it("should leave the rightmost column empty for standard pieces to allow x=6 movement", () => {
    // Standard pieces in their 4x4 bounding box: the rightmost column (col 3)
    // should be empty so the piece can move to column 6 without OOB.
    // This is a convention for SRS-compatible bounding boxes.
    for (const t of ALL_TYPES) {
      if (t === TetriminoType.I) continue; // I has col 3 filled in some rotations
      if (t === TetriminoType.O) continue; // O only uses cols 0-1
      for (let r = 0; r < 4; r++) {
        const grid = PIECE_SHAPES[t][r];
        for (let row = 0; row < 4; row++) {
          expect(grid[row][3]).toBe(false);
        }
      }
    }
  });
});

describe("getWallKicks", () => {
  it("should cover all rotation transitions for I-piece", () => {
    for (const [from, to] of TRANSITIONS) {
      const kicks = getWallKicks(TetriminoType.I, from, to);
      expect(kicks).toBeDefined();
      expect(kicks).toHaveLength(5);
    }
  });

  it("should cover all rotation transitions for JLSTZ pieces", () => {
    const jlstz = [
      TetriminoType.J,
      TetriminoType.L,
      TetriminoType.S,
      TetriminoType.T,
      TetriminoType.Z,
    ];
    for (const t of jlstz) {
      for (const [from, to] of TRANSITIONS) {
        const kicks = getWallKicks(t, from, to);
        expect(kicks).toBeDefined();
        expect(kicks).toHaveLength(5);
      }
    }
  });

  it("should return only identity kick for O-piece", () => {
    for (const [from, to] of TRANSITIONS) {
      const kicks = getWallKicks(TetriminoType.O, from, to);
      expect(kicks).toHaveLength(1);
      expect(kicks[0]).toEqual({ x: 0, y: 0 });
    }
  });

  it("should include identity kick (0,0) as first offset for all I-piece transitions", () => {
    for (const [from, to] of TRANSITIONS) {
      const kicks = getWallKicks(TetriminoType.I, from, to);
      expect(kicks[0]).toEqual({ x: 0, y: 0 });
    }
  });

  it("should include identity kick (0,0) as first offset for all JLSTZ transitions", () => {
    const jlstz = [
      TetriminoType.J,
      TetriminoType.L,
      TetriminoType.S,
      TetriminoType.T,
      TetriminoType.Z,
    ];
    for (const t of jlstz) {
      for (const [from, to] of TRANSITIONS) {
        const kicks = getWallKicks(t, from, to);
        expect(kicks[0]).toEqual({ x: 0, y: 0 });
      }
    }
  });

  it("should return symmetrical kicks for reverse transitions (I-piece)", () => {
    // If 0->R kick[n] = (dx, dy), then R->0 kick[n] should be (-dx, -dy)
    // Use toEqual to handle -0 vs 0 correctly (Object.is distinguishes them).
    const cw: [RotationState, RotationState][] = [
      [RotationState.ZERO, RotationState.R],
      [RotationState.R, RotationState.TWO],
      [RotationState.TWO, RotationState.L],
      [RotationState.L, RotationState.ZERO],
    ];
    const ccw: [RotationState, RotationState][] = [
      [RotationState.R, RotationState.ZERO],
      [RotationState.TWO, RotationState.R],
      [RotationState.L, RotationState.TWO],
      [RotationState.ZERO, RotationState.L],
    ];
    for (let i = 0; i < cw.length; i++) {
      const forward = getWallKicks(TetriminoType.I, cw[i][0], cw[i][1]);
      const backward = getWallKicks(TetriminoType.I, ccw[i][0], ccw[i][1]);
      for (let k = 0; k < 5; k++) {
        // Sum-to-zero avoids -0 vs +0 comparison issues
        expect(backward[k].x + forward[k].x).toBe(0);
        expect(backward[k].y + forward[k].y).toBe(0);
      }
    }
  });
});
