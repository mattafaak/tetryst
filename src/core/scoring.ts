import {
  type Board,
  type Piece,
  type ScoreResult,
  type TSpinResult,
  type GameState,
  TetriminoType,
  RotationState,
} from "./types.ts";
import {
  LINE_CLEAR_SCORES,
  TSPIN_SCORES,
  TSPIN_MINI_SCORES,
  PERFECT_CLEAR_SCORES,
  PERFECT_CLEAR_B2B_TETRIS,
  B2B_MULTIPLIER,
  SOFT_DROP_SCORE,
  HARD_DROP_SCORE,
  LINES_PER_LEVEL,
  BOARD_WIDTH,
} from "./constants.ts";

/**
 * Check if a board cell is occupied.
 * Out-of-bounds cells count as occupied for T-spin corner detection.
 */
function isOccupied(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= board.length) {
    return true;
  }
  return board[y][x] !== null;
}

/**
 * T-spin 3-corner detection geometry.
 *
 * The T-piece sits within a 3x3 area of the playfield starting at
 * (piece.pos.x, piece.pos.y). The 4 corners checked for occupancy are:
 *
 *   TL = (px,   py  )   TR = (px+2, py  )
 *   BL = (px,   py+2)   BR = (px+2, py+2)
 *
 * Front corners are the 2 corners on the same side as the T's flat edge
 * (the row/column with 3 filled cells). Back corners are the 2 corners on
 * the stem side (the single block).
 *
 * Rotation conventions (stem position / flat edge direction):
 *   0 (ZERO): stem up,   flat down   -> front = BL,BR   back = TL,TR
 *   R (   1): stem right, flat left  -> front = TL,BL   back = TR,BR
 *   2 ( TWO): stem down,  flat up    -> front = TL,TR   back = BL,BR
 *   L (   3): stem left,  flat right -> front = TR,BR   back = TL,BL
 */
function getCornerInfo(
  piece: Piece,
): {
  corners: Array<{ x: number; y: number }>;
  backIndices: [number, number];
} {
  const px = piece.pos.x;
  const py = piece.pos.y;

  const corners = [
    { x: px, y: py },       // 0: top-left
    { x: px + 2, y: py },   // 1: top-right
    { x: px, y: py + 2 },   // 2: bottom-left
    { x: px + 2, y: py + 2 }, // 3: bottom-right
  ];

  let backIndices: [number, number];
  switch (piece.rotation) {
    case RotationState.ZERO:
      // Stem up, flat down -> back = TL, TR
      backIndices = [0, 1];
      break;
    case RotationState.R:
      // Stem right, flat left -> back = TR, BR
      backIndices = [1, 3];
      break;
    case RotationState.TWO:
      // Stem down, flat up -> back = BL, BR
      backIndices = [2, 3];
      break;
    case RotationState.L:
      // Stem left, flat right -> back = TL, BL
      backIndices = [0, 2];
      break;
    default:
      backIndices = [0, 1];
  }

  return { corners, backIndices };
}

/**
 * Detect a T-spin using the 3-corner rule.
 * Only valid for T-piece; returns {isTSpin:false, isMini:false} for others.
 *
 * Algorithm:
 *   1. Check the 4 diagonal corners of the T-piece's 3x3 bounding box.
 *   2. If fewer than 3 corners are occupied -> not a T-spin.
 *   3. If both back corners (stem side) are occupied -> full T-spin.
 *   4. If exactly 3 corners but NOT both back corners -> T-spin Mini.
 */
export function detectTSpin(board: Board, piece: Piece): TSpinResult {
  if (piece.type !== TetriminoType.T) {
    return { isTSpin: false, isMini: false };
  }

  const { corners, backIndices } = getCornerInfo(piece);

  let occupiedCount = 0;
  const occupiedSet = new Set<number>();
  for (let i = 0; i < corners.length; i++) {
    if (isOccupied(board, corners[i].x, corners[i].y)) {
      occupiedCount++;
      occupiedSet.add(i);
    }
  }

  if (occupiedCount < 3) {
    return { isTSpin: false, isMini: false };
  }

  const bothBackOccupied =
    backIndices[0] !== undefined &&
    backIndices[1] !== undefined &&
    occupiedSet.has(backIndices[0]) &&
    occupiedSet.has(backIndices[1]);

  if (bothBackOccupied) {
    return { isTSpin: true, isMini: false };
  }

  // Exactly 3 corners but NOT both back -> T-spin Mini
  // (both front corners on the flat-edge side are occupied)
  if (occupiedCount === 3) {
    return { isTSpin: true, isMini: true };
  }

  return { isTSpin: false, isMini: false };
}

/**
 * Evaluate the score for a line clear, accounting for T-spin,
 * back-to-back, and perfect-clear bonuses.
 */
export function evaluateClear(
  linesCleared: number,
  tSpinResult: TSpinResult,
  level: number,
  isB2BActive: boolean,
  isPerfectClear: boolean,
): ScoreResult {
  const multiplier = level + 1;
  let score = 0;
  let isB2B = false;
  let isB2BBroken = false;

  const currentEligible = isB2BEligible(linesCleared, tSpinResult);

  if (isPerfectClear) {
    // B2B Tetris PC has its own fixed total (TDG §7 — not 2000×1.5)
    if (currentEligible && isB2BActive && linesCleared === 4 && !tSpinResult.isTSpin) {
      score = PERFECT_CLEAR_B2B_TETRIS * multiplier;
      isB2B = true;
    } else {
      const pcBase = PERFECT_CLEAR_SCORES[linesCleared] ?? 0;
      score = currentEligible && isB2BActive
        ? Math.floor(pcBase * multiplier * B2B_MULTIPLIER)
        : pcBase * multiplier;
      if (currentEligible) {
        isB2B = true;
      } else if (isB2BActive) {
        isB2BBroken = true;
      }
    }
    return { score, isB2B, isB2BBroken };
  }

  // Normal (non-PC) scoring
  if (tSpinResult.isTSpin && !tSpinResult.isMini) {
    score = (TSPIN_SCORES[String(Math.min(linesCleared, 3))] ?? 0) * multiplier;
  } else if (tSpinResult.isMini) {
    score = (TSPIN_MINI_SCORES[String(Math.min(linesCleared, 2))] ?? 0) * multiplier;
  } else {
    score = (LINE_CLEAR_SCORES[linesCleared] ?? 0) * multiplier;
  }

  if (currentEligible && isB2BActive) {
    score = Math.floor(score * B2B_MULTIPLIER);
    isB2B = true;
  } else if (currentEligible) {
    isB2B = true;
  } else if (isB2BActive) {
    isB2BBroken = true;
  }

  return { score, isB2B, isB2BBroken };
}

/**
 * Determine whether a clear is back-to-back eligible.
 * Tetris (4 lines) and any T-spin are eligible.
 */
export function isB2BEligible(
  linesCleared: number,
  tSpinResult: TSpinResult,
): boolean {
  return linesCleared === 4 || tSpinResult.isTSpin;
}

/**
 * Calculate score for soft-drop (1 point per cell).
 */
export function addSoftDropScore(
  _state: GameState,
  rowsDropped: number,
): number {
  return rowsDropped * SOFT_DROP_SCORE;
}

/**
 * Calculate score for hard-drop (2 points per cell).
 */
export function addHardDropScore(
  _state: GameState,
  rowsDropped: number,
): number {
  return rowsDropped * HARD_DROP_SCORE;
}

/**
 * Calculate player level from total lines cleared.
 * Level 0 at start, increments every 10 lines.
 */
export function calculateLevel(totalLines: number): number {
  return Math.floor(totalLines / LINES_PER_LEVEL);
}
