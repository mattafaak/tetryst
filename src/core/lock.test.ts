import { describe, it, expect } from "vitest";
import { executeLock } from "./lock.ts";
import { lockPiece, createBoard } from "./board.ts";
import { TetriminoType, RotationState, GamePhase, GameMode } from "./types.ts";
import type { GameState, Cell } from "./types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT, SPRINT_LINE_TARGET, MARATHON_MAX_LEVEL } from "./constants.ts";
import { baseState, fillRows } from "../test-utils/test-utils.ts";

/** Shortcut: lock a piece into a board copy and return the result. */
function lockAndExecute(
  board: Cell[][],
  piece: { type: TetriminoType; pos: { x: number; y: number }; rotation: RotationState },
  overrides?: Partial<GameState>,
) {
  const boardWithPiece = lockPiece(board, piece);
  const state = baseState({
    phase: GamePhase.Playing,
    lockState: { timer: 0, resets: 0, onGround: true, lowestY: 0, lastRotationKickIndex: null },
    board: boardWithPiece,
    ...overrides,
  });
  return executeLock(state, piece);
}

describe("executeLock", () => {
  it("Tetris 4-line clear awards score and sets phase to LineClear", () => {
    const board = fillRows(4);
    // I-piece ZERO: filled row at shape row 1 → y+1 = BOARD_HEIGHT-3 + 1 = BOARD_HEIGHT-2
    // But we need the I-piece to be part of the bottom 4 rows. Position at y=BOARD_HEIGHT-2
    // so shape row 1 at y-1+1 = y = BOARD_HEIGHT-2, shape row 1 fills (0, BOARD_HEIGHT-2)-(3, BOARD_HEIGHT-2)
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 4 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece);
    expect(result.linesCleared).toBe(4);
    expect(result.state.phase).toBe(GamePhase.LineClear);
    expect(result.state.score).toBeGreaterThan(0);
    expect(result.popupInfo.some((p) => p.text === "TETRIS!")).toBe(true);
  });

  it("zero-clear lock sets phase to EntryDelay and resets clearedRowIndices", () => {
    const board = createBoard();
    // Place a block at bottom-left so no row is full
    board[BOARD_HEIGHT - 1][0] = TetriminoType.S;
    // I-piece ZERO: filled cells at shape row 1 → y+1. At y=BOARD_HEIGHT-2, fills (0, BOARD_HEIGHT-2)-(3, BOARD_HEIGHT-2)
    // Row BOARD_HEIGHT-1 has 1 block at col 0, not full → 0 lines cleared
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, { clearedRowIndices: [3, 7] });
    expect(result.linesCleared).toBe(0);
    expect(result.state.phase).toBe(GamePhase.EntryDelay);
    expect(result.state.clearedRowIndices).toEqual([]);
  });

  it("T-Spin Single with B2B active applies B2B multiplier", () => {
    const board = createBoard();
    const row = BOARD_HEIGHT - 1;
    // Fill bottom row to get 1 line clear
    for (let x = 0; x < BOARD_WIDTH; x++) board[row][x] = TetriminoType.J;
    // T-piece at (3, BOARD_HEIGHT-3), ZERO rotation.
    // 3x3 box corners: TL=(3,py), TR=(5,py), BL=(3,py+2), BR=(5,py+2)
    // Back for ZERO (stem up) = [0,1] = TL, TR
    const py = BOARD_HEIGHT - 3;
    board[py][3] = TetriminoType.S; // TL
    board[py][5] = TetriminoType.Z; // TR
    // BL=(3,BOARD_HEIGHT-1) is in the filled row → occupied. 3 corners, both back → Full T-Spin
    const piece = { type: TetriminoType.T, pos: { x: 3, y: py }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, { backToBack: true, level: 0 });
    expect(result.linesCleared).toBe(1);
    expect(result.tSpinResult.isTSpin).toBe(true);
    expect(result.state.score).toBeGreaterThan(0);
  });

  it("T-Spin Triple shows correct popup", () => {
    const board = createBoard();
    // Fill 3 bottom rows
    for (let i = 0; i < 3; i++) {
      const r = BOARD_HEIGHT - 1 - i;
      for (let x = 0; x < BOARD_WIDTH; x++) board[r][x] = TetriminoType.J;
    }
    // T in TWO rotation: stem down, flat up, back = BL, BR
    // Place T so flat edge fills the 3 cleared rows
    // T at (3, BOARD_HEIGHT-5): flat at rows BOARD_HEIGHT-3, BOARD_HEIGHT-4, stem at (4, BOARD_HEIGHT-3)?
    // No, TWO rotation:
    // Row 0: [0, 0, 0]
    // Row 1: [0, 0, 0]
    // Row 2: [1, 1, 1]  ← flat
    // Row 3: [0, 1, 0]  ← stem
    // So flat at y+2 = BOARD_HEIGHT-3, stem at y+3 = BOARD_HEIGHT-2
    // For 3 lines cleared, rows BOARD_HEIGHT-1, BOARD_HEIGHT-2, BOARD_HEIGHT-3 must be full
    // T's flat adds cells to BOARD_HEIGHT-3 (already full), stem adds to BOARD_HEIGHT-2 (already full)
    // Occupy 3 corners: BL=(3, BOARD_HEIGHT-3) and BR=(5, BOARD_HEIGHT-3) are back
    const py = BOARD_HEIGHT - 5;
    board[py][3] = TetriminoType.S; // TL of 3x3 at (3, py)
    board[py + 2][5] = TetriminoType.Z; // BR
    board[py + 2][3] = TetriminoType.O; // BL (back)
    // Check: TWO rotation, back = [2, 3] = BL, BR. BL at (3, py+2), BR at (5, py+2)
    // TL at (3, py) is occupied, BL at (3, py+2) is occupied, BR at (5, py+2) is occupied. 3 corners.
    // Both back (BL and BR) are occupied → Full T-Spin.
    const piece = { type: TetriminoType.T, pos: { x: 3, y: py }, rotation: RotationState.TWO };
    const result = lockAndExecute(board, piece);
    expect(result.popupInfo.some((p) => p.text === "T-SPIN TRIPLE")).toBe(true);
  });

  it("T-Spin Mini shows T-SPIN MINI popup", () => {
    // T-piece ZERO rotation at (3, 20). Piece cells: (4,20), (3,21), (4,21), (5,21).
    // 3×3 bounding box corners: TL=(3,20), TR=(5,20), BL=(3,22), BR=(5,22).
    // For ZERO: back=[TL, TR]. Mini requires 3 corners occupied but NOT both back.
    // Setup: TL + BL + BR occupied (3 corners), TR absent → NOT both back → isMini.
    const board = createBoard();
    board[20][3] = TetriminoType.I; // TL (one back corner — occupied)
    board[22][3] = TetriminoType.I; // BL (front corner — occupied)
    board[22][5] = TetriminoType.I; // BR (front corner — occupied)
    // TR (5, 20) intentionally left empty → only one back corner occupied → Mini ✓
    const piece = { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, { level: 0 });
    // Assertion is unconditional: the geometry above guarantees isMini = true
    expect(result.tSpinResult.isTSpin).toBe(true);
    expect(result.tSpinResult.isMini).toBe(true);
    expect(result.popupInfo.some((p) => p.text === "T-SPIN MINI")).toBe(true);
  });

  it("Perfect Clear shows PERFECT CLEAR popup", () => {
    const board = createBoard();
    // Fill one row; after clear the board will be empty
    for (let x = 0; x < BOARD_WIDTH; x++) board[BOARD_HEIGHT - 1][x] = TetriminoType.I;
    // I-piece at y=BOARD_HEIGHT-1: ZERO rotation, filled row at y+1 = BOARD_HEIGHT (out of bounds)
    // Piece adds no cells, the row clears → PC
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 1 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece);
    expect(result.isPerfectClear).toBe(true);
    expect(result.popupInfo.some((p) => p.text === "PERFECT CLEAR!")).toBe(true);
  });

  it("B2B consecutive Tetris shows BACK-TO-BACK popup", () => {
    const board = fillRows(4);
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 4 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, { backToBack: true });
    expect(result.linesCleared).toBe(4);
    expect(result.popupInfo.some((p) => p.text === "BACK-TO-BACK")).toBe(true);
  });

  it("B2B break shows BREAK popup", () => {
    const board = createBoard();
    // Fill bottom row + add a column-0 block one row above to prevent PC
    for (let x = 0; x < BOARD_WIDTH; x++) board[BOARD_HEIGHT - 1][x] = TetriminoType.J;
    board[BOARD_HEIGHT - 2][0] = TetriminoType.S; // Stays after clear → not PC
    // I-piece that adds no cells (filled row at y+1 out of bounds)
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 1 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, { backToBack: true });
    // 1 line cleared, not PC, not T-spin, not Tetris → B2B broken
    expect(result.popupInfo.some((p) => p.text === "BREAK")).toBe(true);
  });

  it("combo chain awards increasing bonus", () => {
    const board = fillRows(2);
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 4 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, { combo: 3, level: 0 });
    expect(result.comboBonus).toBeGreaterThan(0);
    expect(result.popupInfo.some((p) => p.text.includes("COMBO"))).toBe(true);
  });

  it("Marathon level advances with effective lines", () => {
    const board = fillRows(4);
    // I-piece at y=BOARD_HEIGHT-4: ZERO rotation, fills cols 0-3 at row BOARD_HEIGHT-3
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 4 }, rotation: RotationState.ZERO };
    // Tetris (4 lines) = 8 effective lines. 7 + 8 = 15 → level 2
    const result = lockAndExecute(board, piece, { mode: GameMode.Marathon, level: 1, effectiveLines: 7 });
    expect(result.state.level).toBeGreaterThan(1);
  });

  it("victory triggered on Sprint mode when lines >= target", () => {
    const board = fillRows(1);
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, {
      mode: GameMode.Sprint,
      lines: SPRINT_LINE_TARGET - 1,
      level: 0,
    });
    expect(result.victoryTriggered).toBe(true);
  });

  it("Level-up popup shows when Marathon level increases", () => {
    const board = fillRows(4);
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 4 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, {
      mode: GameMode.Marathon,
      level: 1,
      effectiveLines: 9,
    });
    expect(result.popupInfo.some((p) => p.text.includes("LEVEL"))).toBe(true);
  });

  it("T-spin no-clear at max Marathon level triggers victory", () => {
    const board = createBoard();
    const py = BOARD_HEIGHT - 3;
    // Populate 3 corners of the T-piece 3×3 bounding box
    board[py][3] = TetriminoType.S;               // TL corner
    board[py][5] = TetriminoType.Z;               // TR corner
    board[BOARD_HEIGHT - 1][3] = TetriminoType.J;  // BL corner
    // T-piece ZERO at (3, py): fills (4,py), (3,py+1),(4,py+1),(5,py+1)
    // Board rows py and py+1 are not full; bottom row has only 1 cell at col 3
    const piece = { type: TetriminoType.T, pos: { x: 3, y: py }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, { level: MARATHON_MAX_LEVEL });
    expect(result.linesCleared).toBe(0);
    expect(result.tSpinResult.isTSpin).toBe(true);
    expect(result.victoryTriggered).toBe(true);
  });

  it("non-T-spin no-clear at max Marathon level triggers victory", () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 1][0] = TetriminoType.S;
    // I-piece ZERO at (0, BOARD_HEIGHT-2): fills cols 0-3 at row BOARD_HEIGHT-2
    // Bottom row has 1 cell at col 0; row BOARD_HEIGHT-2 has 4 I-piece cells → neither full
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    const result = lockAndExecute(board, piece, { level: MARATHON_MAX_LEVEL });
    expect(result.linesCleared).toBe(0);
    expect(result.victoryTriggered).toBe(true);
  });
});
