import { TetriminoType, type Position, RotationState } from "./types.ts";

// Board dimensions
export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 40; // 20 visible + 20 buffer above
export const VISIBLE_HEIGHT = 20;
export const BUFFER_HEIGHT = 20;

// Spawn positions (in board coordinates)
// Board is 40 rows: rows 0-19 = buffer (hidden), rows 20-39 = visible
// Spawn 1 row into buffer zone (TDG: pieces spawn just above skyline)
export const SPAWN_POSITION: Position = { x: 3, y: 19 };
export const I_SPAWN_POSITION: Position = { x: 3, y: 18 };

// Timing constants (ms) — aligned with TDG §13
export const DAS_DELAY = 300;   // was 167 (TDG: ~300ms initial delay before autorepeat)
export const ARR_RATE = 50;     // was 33  (TDG: ~50ms between autorepeat steps)
export const LOCK_DELAY = 500;  // unchanged (TDG: 500ms lock delay)
export const MAX_LOCK_RESETS = 15; // unchanged
export const ENTRY_DELAY = 200; // was 267 (TDG: 200ms between piece lock and spawn)
export const LINE_CLEAR_ANIM_DURATION = 300; // ms — line clear flash animation duration

// Piece colors (strings for Canvas fillStyle)
export const PIECE_COLORS: Record<TetriminoType, string> = {
  [TetriminoType.I]: "#00f0f0",
  [TetriminoType.O]: "#f0f000",
  [TetriminoType.T]: "#a000f0",
  [TetriminoType.S]: "#00f000",
  [TetriminoType.Z]: "#f00000",
  [TetriminoType.J]: "#0000f0",
  [TetriminoType.L]: "#f0a000",
};

// Ghost piece opacity
export const GHOST_OPACITY = 0.3;

// Piece shapes: [rotationState][row][col] — true = filled, false = empty
// Each piece is defined as a 4x4 grid for all 4 rotation states.
// Row 0 is the top of the bounding box.

export const PIECE_SHAPES: Record<
  TetriminoType,
  boolean[][][]
> = {
  [TetriminoType.I]: [
    // 0
    [
      [false, false, false, false],
      [true, true, true, true],
      [false, false, false, false],
      [false, false, false, false],
    ],
    // R
    [
      [false, false, true, false],
      [false, false, true, false],
      [false, false, true, false],
      [false, false, true, false],
    ],
    // 2
    [
      [false, false, false, false],
      [false, false, false, false],
      [true, true, true, true],
      [false, false, false, false],
    ],
    // L
    [
      [false, true, false, false],
      [false, true, false, false],
      [false, true, false, false],
      [false, true, false, false],
    ],
  ],
  [TetriminoType.O]: [
    // All rotations identical (2x2 in top-left of 4x4)
    [
      [true, true, false, false],
      [true, true, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    [
      [true, true, false, false],
      [true, true, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    [
      [true, true, false, false],
      [true, true, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    [
      [true, true, false, false],
      [true, true, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
  ],
  [TetriminoType.T]: [
    // 0
    [
      [false, true, false, false],
      [true, true, true, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    // R
    [
      [false, true, false, false],
      [false, true, true, false],
      [false, true, false, false],
      [false, false, false, false],
    ],
    // 2
    [
      [false, false, false, false],
      [true, true, true, false],
      [false, true, false, false],
      [false, false, false, false],
    ],
    // L
    [
      [false, true, false, false],
      [true, true, false, false],
      [false, true, false, false],
      [false, false, false, false],
    ],
  ],
  [TetriminoType.S]: [
    // 0
    [
      [false, true, true, false],
      [true, true, false, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    // R
    [
      [false, true, false, false],
      [false, true, true, false],
      [false, false, true, false],
      [false, false, false, false],
    ],
    // 2
    [
      [false, false, false, false],
      [false, true, true, false],
      [true, true, false, false],
      [false, false, false, false],
    ],
    // L
    [
      [true, false, false, false],
      [true, true, false, false],
      [false, true, false, false],
      [false, false, false, false],
    ],
  ],
  [TetriminoType.Z]: [
    // 0
    [
      [true, true, false, false],
      [false, true, true, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    // R
    [
      [false, false, true, false],
      [false, true, true, false],
      [false, true, false, false],
      [false, false, false, false],
    ],
    // 2
    [
      [false, false, false, false],
      [true, true, false, false],
      [false, true, true, false],
      [false, false, false, false],
    ],
    // L
    [
      [false, true, false, false],
      [true, true, false, false],
      [true, false, false, false],
      [false, false, false, false],
    ],
  ],
  [TetriminoType.J]: [
    // 0
    [
      [true, false, false, false],
      [true, true, true, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    // R
    [
      [false, true, true, false],
      [false, true, false, false],
      [false, true, false, false],
      [false, false, false, false],
    ],
    // 2
    [
      [false, false, false, false],
      [true, true, true, false],
      [false, false, true, false],
      [false, false, false, false],
    ],
    // L
    [
      [false, true, false, false],
      [false, true, false, false],
      [true, true, false, false],
      [false, false, false, false],
    ],
  ],
  [TetriminoType.L]: [
    // 0
    [
      [false, false, true, false],
      [true, true, true, false],
      [false, false, false, false],
      [false, false, false, false],
    ],
    // R
    [
      [false, true, false, false],
      [false, true, false, false],
      [false, true, true, false],
      [false, false, false, false],
    ],
    // 2
    [
      [false, false, false, false],
      [true, true, true, false],
      [true, false, false, false],
      [false, false, false, false],
    ],
    // L
    [
      [true, true, false, false],
      [false, true, false, false],
      [false, true, false, false],
      [false, false, false, false],
    ],
  ],
};

// SRS Wall Kick Data
// Offsets are (x, y) where positive x = right, positive y = down (Canvas coords).
// TDG tables use y-up; values here are INVERTED to y-down for our coordinate system.

// JLSTZ wall kick offsets: 5 tests per rotation transition
// Key format: "fromRotation-toRotation"
export const WALL_KICKS_JLSTZ: Record<string, Position[]> = {
  "0->1": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ],
  "1->0": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ],
  "1->2": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ],
  "2->1": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ],
  "2->3": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
  "3->2": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ],
  "3->0": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ],
  "0->3": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
};

// I-piece has its own wall kick table with different values
export const WALL_KICKS_I: Record<string, Position[]> = {
  "0->1": [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 1 },
    { x: 1, y: -2 },
  ],
  "1->0": [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: -1 },
    { x: -1, y: 2 },
  ],
  "1->2": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: -2 },
    { x: 2, y: 1 },
  ],
  "2->1": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 2 },
    { x: -2, y: -1 },
  ],
  "2->3": [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: -1 },
    { x: -1, y: 2 },
  ],
  "3->2": [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 1 },
    { x: 1, y: -2 },
  ],
  "3->0": [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 2 },
    { x: -2, y: -1 },
  ],
  "0->3": [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: -2 },
    { x: 2, y: 1 },
  ],
};

export function getWallKicks(
  type: TetriminoType,
  from: RotationState,
  to: RotationState
): Position[] {
  // O-piece: identity rotation, no kicks
  if (type === TetriminoType.O) {
    return [{ x: 0, y: 0 }];
  }
  const key = `${from}->${to}`;
  if (type === TetriminoType.I) {
    return WALL_KICKS_I[key] || [{ x: 0, y: 0 }];
  }
  return WALL_KICKS_JLSTZ[key] || [{ x: 0, y: 0 }];
}

// Scoring table: index = lines cleared (0-4), value = base points
export const LINE_CLEAR_SCORES = [0, 100, 300, 500, 800];

// T-spin scores (× (level + 1))
export const TSPIN_SCORES: Record<string, number> = {
  "0": 400, // T-spin with no lines
  "1": 800, // T-spin single
  "2": 1200, // T-spin double
  "3": 1600, // T-spin triple
};

export const TSPIN_MINI_SCORES: Record<string, number> = {
  "0": 100, // T-spin Mini with no lines (TDG §7: 100 × (level + 1))
  "1": 200, // T-spin Mini single (TDG §7: 200 × (level + 1))
  "2": 400, // T-spin Mini double (TDG §7: 400 × (level + 1))
};

export const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]; // TDG §7 by line count
export const PERFECT_CLEAR_B2B_TETRIS = 3200; // TDG §7 B2B Tetris Perfect Clear

// Back-to-back multiplier
export const B2B_MULTIPLIER = 1.5;

// Combo scoring: 50 × combo × (level + 1)
export const COMBO_BASE = 50;

// Soft drop: 1 point per cell
export const SOFT_DROP_SCORE = 1;
// Hard drop: 2 points per cell
export const HARD_DROP_SCORE = 2;

// Gravity speed curve: index = level, value = ms per drop
// Based on TDG speed curve (NES-inspired timing)
export const GRAVITY_SPEED_CURVE: number[] = [
  1000, // Level 0
  793, // Level 1
  618, // Level 2
  473, // Level 3
  355, // Level 4
  262, // Level 5
  190, // Level 6
  135, // Level 7
  94, // Level 8
  64, // Level 9
  43, // Level 10
  28, // Level 11
  18, // Level 12
  11, // Level 13
  7, // Level 14
  5, // Level 15+
];

// Lines per level (standard: level up every 10 lines)
export const LINES_PER_LEVEL = 10;

export const MARATHON_MAX_LEVEL = 15;
export const ULTRA_DURATION_MS = 3 * 60 * 1000;
export const SPRINT_LINE_TARGET = 40;
