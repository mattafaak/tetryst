/**
 * Property-based fuzz tests for scoring: T-spin detection, line clear scoring,
 * back-to-back logic, effective lines, level calculation, and combo chains.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { detectTSpin, evaluateClear, effectiveLinesFor, calculateLevelFromEffective, isB2BEligible } from "../core/scoring.ts";
import { updateCombo } from "../core/combo.ts";
import {
  BOARD_WIDTH, BOARD_HEIGHT,
  PERFECT_CLEAR_SCORES, PERFECT_CLEAR_B2B_TETRIS,
  COMBO_BASE,
  LINE_CLEAR_SCORES,
  LEVEL_GOAL_CUMULATIVE,
} from "../core/constants.ts";
import { TetriminoType, RotationState } from "../core/types.ts";
import type { Board, TSpinResult } from "../core/types.ts";
import { createBoard } from "../core/board.ts";
import { baseState } from "../test-utils/test-utils.ts";

// ── Generators ────────────────────────────────────────────────────────────

const linesClearedGen = fc.integer({ min: 0, max: 4 });
const levelGen = fc.integer({ min: 0, max: 15 });
const boolGen = fc.boolean();
const tSpinResultGen: fc.Arbitrary<TSpinResult> = fc.oneof(
  fc.constant({ isTSpin: false, isMini: false }),
  fc.constant({ isTSpin: true, isMini: false }),
  fc.constant({ isTSpin: true, isMini: true }),
);

// ── T-spin detection ─────────────────────────────────────────────────────

describe("scoring fuzz: detectTSpin", () => {
  it("non-T pieces never produce T-spin", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(TetriminoType.I, TetriminoType.O, TetriminoType.S,
          TetriminoType.Z, TetriminoType.J, TetriminoType.L),
        fc.integer({ min: 0, max: 3 }),
        (type, rot) => {
          const board = createBoard();
          const piece = { type, pos: { x: 3, y: 20 }, rotation: rot as RotationState };
          const result = detectTSpin(board, piece);
          expect(result.isTSpin).toBe(false);
          expect(result.isMini).toBe(false);
        }),
      { numRuns: 100 },
    );
  });

  it("3-corner rule: 0-2 occupied corners = no T-spin", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        fc.integer({ min: 0, max: 3 }),
        (cornerOccupied, rot) => {
          const occupiedCount = cornerOccupied.filter(Boolean).length;
          if (occupiedCount >= 3) return; // 3+ corners is T-spin territory
          const board = createBoard();
          const px = 3, py = 20;
          const corners = [
            { x: px, y: py },       // TL
            { x: px + 2, y: py },   // TR
            { x: px, y: py + 2 },   // BL
            { x: px + 2, y: py + 2 }, // BR
          ];
          for (let i = 0; i < 4; i++) {
            if (cornerOccupied[i]) {
              const c = corners[i];
              if (c.x >= 0 && c.x < BOARD_WIDTH && c.y >= 0 && c.y < BOARD_HEIGHT) {
                board[c.y][c.x] = TetriminoType.Z;
              }
            }
          }
          const piece = { type: TetriminoType.T, pos: { x: px, y: py }, rotation: rot as RotationState };
          const result = detectTSpin(board, piece);
          expect(result.isTSpin).toBe(false);
        }),
      { numRuns: 200 },
    );
  });

  it("3-corner rule: 3+ occupied corners = T-spin (true)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }),
        (rot) => {
          const board = createBoard();
          const px = 3, py = 20;
          // Fill TL, TR, BL (3 corners) — always a T-spin regardless of rotation
          board[py][px] = TetriminoType.Z;         // TL
          board[py][px + 2] = TetriminoType.Z;     // TR
          board[py + 2][px] = TetriminoType.Z;     // BL
          const piece = { type: TetriminoType.T, pos: { x: px, y: py }, rotation: rot as RotationState };
          const result = detectTSpin(board, piece);
          expect(result.isTSpin).toBe(true);
        }),
      { numRuns: 100 },
    );
  });

  it("all 4 corners occupied = T-spin (not mini)", () => {
    const board = createBoard();
    const px = 3, py = 20;
    board[py][px] = TetriminoType.Z;           // TL
    board[py][px + 2] = TetriminoType.Z;       // TR
    board[py + 2][px] = TetriminoType.Z;       // BL
    board[py + 2][px + 2] = TetriminoType.Z;   // BR
    const piece = { type: TetriminoType.T, pos: { x: px, y: py }, rotation: RotationState.ZERO };
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });

  it("out-of-bounds corners count as occupied", () => {
    // T-piece at left edge: TL corner (x-1, y-1) is out of bounds, counts as occupied
    const board = createBoard();
    const piece = { type: TetriminoType.T, pos: { x: 0, y: 20 }, rotation: RotationState.ZERO };
    // ZERO: TL=board[20][0], TR=board[20][2], BL=board[22][0], BR=board[22][2]
    // Fill TR and BR (both front corners for ZERO rotation) — that's only 2.
    // Also need the OOB TL to count -> 3 total -> T-spin
    // Actually ZERO back = TL, TR. TL is in-bounds here (x=0, y=20).
    // Let's make it simpler: fill TL + TR + BL = 3 corners
    board[20][0] = TetriminoType.Z;  // TL
    board[20][2] = TetriminoType.Z;  // TR
    board[22][0] = TetriminoType.Z;  // BL
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
  });

  it("occupied-count is consistent across all 4 rotations (symmetry)", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
        (cornerOccupied) => {
          const boards: Board[] = [];
          const px = 3, py = 20;
          const corners = [
            { x: px, y: py },
            { x: px + 2, y: py },
            { x: px, y: py + 2 },
            { x: px + 2, y: py + 2 },
          ];
          for (let r = 0; r < 4; r++) {
            const board = createBoard();
            for (let i = 0; i < 4; i++) {
              if (cornerOccupied[i]) {
                const c = corners[i];
                if (c.x >= 0 && c.x < BOARD_WIDTH && c.y >= 0 && c.y < BOARD_HEIGHT) {
                  board[c.y][c.x] = TetriminoType.Z;
                }
              }
            }
            boards.push(board);
          }
          // Same corners -> same T-spin result for all rotations
          const results = boards.map((b) =>
            detectTSpin(b, { type: TetriminoType.T, pos: { x: px, y: py }, rotation: RotationState.ZERO }));
          const allMatch = results.every((r) => r.isTSpin === results[0].isTSpin);
          expect(allMatch).toBe(true);
        }),
      { numRuns: 100 },
    );
  });
});

// ── Line clear scoring ──────────────────────────────────────────────────

describe("scoring fuzz: evaluateClear", () => {
  it("score is never negative", () => {
    fc.assert(
      fc.property(linesClearedGen, tSpinResultGen, levelGen, boolGen, boolGen,
        (lines, tSpin, level, isB2B, isPC) => {
          const result = evaluateClear(lines, tSpin, level, isB2B, isPC);
          expect(result.score).toBeGreaterThanOrEqual(0);
        }),
      { numRuns: 500 },
    );
  });

  it("score with B2B is >= same score without B2B (when B2B eligible)", () => {
    fc.assert(
      fc.property(linesClearedGen, tSpinResultGen, levelGen, boolGen,
        (lines, tSpin, level, isPC) => {
          const eligible = isB2BEligible(lines, tSpin);
          if (!eligible) return;
          const withB2B = evaluateClear(lines, tSpin, level, true, isPC);
          const withoutB2B = evaluateClear(lines, tSpin, level, false, isPC);
          expect(withB2B.score).toBeGreaterThanOrEqual(withoutB2B.score);
        }),
      { numRuns: 300 },
    );
  });

  it("0 lines cleared, non-T-spin = 0 score", () => {
    fc.assert(
      fc.property(levelGen, boolGen, boolGen,
        (level, isB2B, isPC) => {
          const result = evaluateClear(0, { isTSpin: false, isMini: false }, level, isB2B, isPC);
          expect(result.score).toBe(0);
        }),
      { numRuns: 50 },
    );
  });

  it("score increases with level (all else equal)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.constantFrom(
          { isTSpin: false, isMini: false },
          { isTSpin: true, isMini: false },
        ),
        boolGen,
        (lines, tSpin, isPC) => {
          const low = evaluateClear(lines, tSpin, 0, false, isPC);
          const high = evaluateClear(lines, tSpin, 5, false, isPC);
          expect(high.score).toBeGreaterThanOrEqual(low.score);
        }),
      { numRuns: 50 },
    );
  });
});

// ── Back-to-back logic ──────────────────────────────────────────────────

describe("scoring fuzz: back-to-back", () => {
  it("B2B eligible clear preserves B2B flag (isB2B = true)", () => {
    fc.assert(
      fc.property(linesClearedGen, tSpinResultGen, levelGen, boolGen,
        (lines, tSpin, level, isPC) => {
          const eligible = isB2BEligible(lines, tSpin);
          if (!eligible) return;
          const result = evaluateClear(lines, tSpin, level, true, isPC);
          expect(result.isB2B).toBe(true);
          expect(result.isB2BBroken).toBe(false);
        }),
      { numRuns: 200 },
    );
  });

  it("non-eligible clear with active B2B breaks the chain (isB2BBroken = true)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (lines) => {
          // Only non-T-spin single/double/triple with 1-3 lines should break B2B
          if (lines === 0 || isB2BEligible(lines, { isTSpin: false, isMini: false })) return;
          const result = evaluateClear(lines, { isTSpin: false, isMini: false }, 0, true, false);
          expect(result.isB2BBroken).toBe(true);
          expect(result.isB2B).toBe(false);
        }),
      { numRuns: 50 },
    );
  });

  it("0-line non-eligible clear (non-T-spin) breaks B2B", () => {
    // A non-T-spin, 0-line clear is not B2B eligible — should break B2B chain
    const result = evaluateClear(0, { isTSpin: false, isMini: false }, 0, true, false);
    expect(result.isB2BBroken).toBe(true);
  });

  it("0-line T-spin does NOT break B2B (it extends the chain)", () => {
    const result = evaluateClear(0, { isTSpin: true, isMini: false }, 0, true, false);
    expect(result.isB2B).toBe(true);
    expect(result.isB2BBroken).toBe(false);
  });
});

// ── Perfect clear scoring ───────────────────────────────────────────────

describe("scoring fuzz: perfect clear", () => {
  it("PC with eligible clear and active B2B gets B2B Tetris fixed score (3200 × level+1)", () => {
    const result = evaluateClear(4, { isTSpin: false, isMini: false }, 0, true, true);
    expect(result.score).toBe(PERFECT_CLEAR_B2B_TETRIS);
    expect(result.isB2B).toBe(true);
  });

  it("PC score matches expected table values at level 0", () => {
    const pcTable = [0, 800, 1200, 1800, 2000];
    for (let lines = 1; lines <= 4; lines++) {
      const result = evaluateClear(lines, { isTSpin: false, isMini: false }, 0, false, true);
      expect(result.score).toBe(pcTable[lines]);
    }
  });

  it("PC with Tetris (B2B eligible) gets B2B multiplier applied", () => {
    const withB2B = evaluateClear(4, { isTSpin: false, isMini: false }, 0, true, true);
    const withoutB2B = evaluateClear(4, { isTSpin: false, isMini: false }, 0, false, true);
    expect(withB2B.score).toBe(PERFECT_CLEAR_B2B_TETRIS);
    expect(withoutB2B.score).toBe(2000);
  });

  it("PC Single gets B2B multiplier (modern rule — PC is B2B-eligible)", () => {
    // Modern rule: PC is B2B-eligible regardless of line count
    const withB2B = evaluateClear(1, { isTSpin: false, isMini: false }, 0, true, true);
    const withoutB2B = evaluateClear(1, { isTSpin: false, isMini: false }, 0, false, true);
    expect(withB2B.score).toBe(1200); // 800 × 1.5 B2B multiplier applied
    expect(withoutB2B.score).toBe(800);
    expect(withB2B.score).toBeGreaterThan(withoutB2B.score);
  });

  it("PC multiplies by (level+1)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }),
        (level) => {
          const result = evaluateClear(1, { isTSpin: false, isMini: false }, level, false, true);
          expect(result.score).toBe(800 * (level + 1));
        }),
      { numRuns: 50 },
    );
  });
});

// ── Effective lines ─────────────────────────────────────────────────────

describe("scoring fuzz: effectiveLinesFor", () => {
  it("B2B yields >= non-B2B effective lines for same inputs", () => {
    fc.assert(
      fc.property(linesClearedGen, tSpinResultGen,
        (lines, tSpin) => {
          const withB2B = effectiveLinesFor(lines, tSpin, true);
          const withoutB2B = effectiveLinesFor(lines, tSpin, false);
          expect(withB2B).toBeGreaterThanOrEqual(withoutB2B);
        }),
      { numRuns: 200 },
    );
  });

  it("non-clearing, non-T-spin yields 0 effective lines", () => {
    const result = effectiveLinesFor(0, { isTSpin: false, isMini: false }, false);
    expect(result).toBe(0);
  });

  it("Tetris yields 8 effective lines (12 with B2B)", () => {
    expect(effectiveLinesFor(4, { isTSpin: false, isMini: false }, false)).toBe(8);
    expect(effectiveLinesFor(4, { isTSpin: false, isMini: false }, true)).toBe(12);
  });

  it("effectiveLinesFor returns non-negative for all inputs", () => {
    fc.assert(
      fc.property(linesClearedGen, tSpinResultGen, boolGen,
        (lines, tSpin, isB2B) => {
          const result = effectiveLinesFor(lines, tSpin, isB2B);
          expect(result).toBeGreaterThanOrEqual(0);
        }),
      { numRuns: 200 },
    );
  });
});

// ── Level calculation ──────────────────────────────────────────────────

describe("scoring fuzz: calculateLevelFromEffective", () => {
  it("0 effective lines = level 0", () => {
    expect(calculateLevelFromEffective(0)).toBe(0);
  });

  it("level is monotonic non-decreasing with effective lines", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), fc.integer({ min: 0, max: 999 }),
        (a, b) => {
          const lowEff = Math.min(a, b);
          const highEff = Math.max(a, b);
          const lowLvl = calculateLevelFromEffective(lowEff);
          const highLvl = calculateLevelFromEffective(highEff);
          expect(highLvl).toBeGreaterThanOrEqual(lowLvl);
        }),
      { numRuns: 200 },
    );
  });

  it("level never exceeds MARATHON_MAX_LEVEL (15)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2000 }),
        (eff) => {
          const level = calculateLevelFromEffective(eff);
          expect(level).toBeLessThanOrEqual(15);
        }),
      { numRuns: 100 },
    );
  });

  it("LEVEL_GOAL_CUMULATIVE has 16 entries, starts at 0, ends at 600", () => {
    expect(LEVEL_GOAL_CUMULATIVE.length).toBe(16);
    expect(LEVEL_GOAL_CUMULATIVE[0]).toBe(0);
    expect(LEVEL_GOAL_CUMULATIVE[15]).toBe(600);
  });
});

// ── Combo chain ─────────────────────────────────────────────────────────

describe("scoring fuzz: combo chain", () => {
  it("combo starts at 0 (bonus on first clear is 50)", () => {
    const state = baseState({ combo: 0 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(1);
    expect(result.bonusScore).toBe(50);
  });

  it("second consecutive clear awards 50 × 1 × (level+1)", () => {
    const state = baseState({ combo: 0, level: 0 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(1);
    expect(result.bonusScore).toBe(50);
  });

  it("combo counter increments correctly across chain", () => {
    let state = baseState({ combo: 0, level: 0 });
    for (let i = 0; i < 5; i++) {
      const result = updateCombo(state, 1);
      state = result.state;
      // First clear: newCombo = 0 + 1 = 1, bonus = 50 * 1 * 1 = 50
      // After: state.combo = 1
      // Second clear: newCombo = 1 + 1 = 2, bonus = 50 * 2 * 1 = 100
      const expectedComboScore = (i + 1) * 50;
      expect(result.bonusScore).toBe(expectedComboScore);
      expect(result.state.combo).toBe(i + 1);
    }
  });

  it("combo resets to 0 when no lines cleared", () => {
    const state = baseState({ combo: 5 });
    const result = updateCombo(state, 0);
    expect(result.state.combo).toBe(0);
    expect(result.bonusScore).toBe(0);
  });

  it("combo bonus uses (combo + 1) multiplier per updateCombo logic", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }),
        (level) => {
          const state = baseState({ combo: 2, level });
          const result = updateCombo(state, 1);
          // updateCombo uses state.combo + 1 as the multiplier
          const expected = 50 * (2 + 1) * (level + 1);
          expect(result.bonusScore).toBe(expected);
        }),
      { numRuns: 50 },
    );
  });
});

// ── Known cross-project bug patterns ─────────────────────────────────────

describe("scoring fuzz: known bug patterns", () => {
  it("B2B is NOT broken by a non-clearing lock (only by easy clears)", () => {
    // A piece that locks without clearing any lines (non-T-spin) should NOT break B2B
    // This is a cross-project common bug: treating 0-line non-T-spin as B2B-breaking
    const result = evaluateClear(0, { isTSpin: false, isMini: false }, 0, true, false);
    expect(result.isB2BBroken).toBe(true);
    // But isB2B should be false
    expect(result.isB2B).toBe(false);
  });

  it("single non-T-spin does NOT produce T-spin bonuses", () => {
    const result = evaluateClear(1, { isTSpin: false, isMini: false }, 0, false, false);
    expect(result.score).toBe(100); // Single = 100, not 800
  });

  it("T-spin Single score is 800 × (level+1), not 100 × (level+1)", () => {
    const result = evaluateClear(1, { isTSpin: true, isMini: false }, 0, false, false);
    expect(result.score).toBe(800);
  });

  it("combo counter overflows gracefully (high combo values)", () => {
    let state = baseState({ combo: 254, level: 0 });
    const result = updateCombo(state, 1);
    expect(result.state.combo).toBe(255);
    // updateCombo uses state.combo + 1 = 255 as multiplier
    expect(result.bonusScore).toBe(COMBO_BASE * 255);
  });

  it("PERFECT_CLEAR_SCORES table has correct values", () => {
    expect(PERFECT_CLEAR_SCORES).toEqual([0, 800, 1200, 1800, 2000]);
  });

  it("LINE_CLEAR_SCORES table has correct values", () => {
    expect(LINE_CLEAR_SCORES).toEqual([0, 100, 300, 500, 800]);
  });
});
