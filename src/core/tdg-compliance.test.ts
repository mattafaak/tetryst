/**
 * TDG Compliance Test Suite
 * 2009 Tetris Design Guideline — section-by-section verification.
 */
import { describe, it, expect } from "vitest";
import { createInitialState, startGame, spawnNextPiece, holdPiece } from "./state.ts";
import { processAction } from "./actions.ts";
import { detectTSpin, evaluateClear, effectiveLinesFor, calculateLevelFromEffective, isB2BEligible } from "./scoring.ts";
import { createBoard, isLockOut } from "./board.ts";
import { spawnPiece, getGhostY, tryRotateCW, tryRotateCCW } from "./pieces.ts";
import { checkModeVictory } from "./mode-rules.ts";
import { applyGravity, getGravityDelay } from "./gravity.ts";
import { drawFromBag, createFirstBag, createBag } from "./randomizer.ts";
import {
  BOARD_WIDTH, BOARD_HEIGHT, VISIBLE_HEIGHT, BUFFER_HEIGHT,
  SPAWN_POSITION, I_SPAWN_POSITION,
  LOCK_DELAY, MAX_LOCK_RESETS, ENTRY_DELAY,
  DAS_DELAY, ARR_RATE,
  NEXT_QUEUE_SIZE,
  LEVEL_GOAL_CUMULATIVE,
  GRAVITY_SPEED_CURVE,
  MARATHON_MAX_LEVEL,
} from "./constants.ts";
import {
  GameMode, GamePhase, TetriminoType, RotationState,
  type GameState, type Board,
} from "./types.ts";

function emptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<string | null>(BOARD_WIDTH).fill(null),
  );
}

function baseState(overrides?: Partial<GameState>): GameState {
  return {
    board: emptyBoard(),
    activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
    ghostY: BOARD_HEIGHT - 2,
    heldPiece: null,
    hasSwappedThisTurn: false,
    nextQueue: [{ type: TetriminoType.I }],
    score: 0,
    level: 0,
    lines: 0,
    effectiveLines: 0,
    combo: -1,
    backToBack: false,
    phase: GamePhase.Playing,
    gravityTimer: 0,
    lockState: { timer: 0, resets: 0, onGround: false, lowestY: -1 },
    entryDelayTimer: 0,
    bag: [],
    lineClearTimer: 0,
    clearedRowIndices: [],
    lastClearWasB2B: false,
    mode: GameMode.Marathon,
    modeTimer: 0,
    popups: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TDG §2: Playfield Dimensions
// ---------------------------------------------------------------------------

describe("TDG §2: Playfield Dimensions", () => {
  it("playfield is 10 cells wide", () => {
    expect(BOARD_WIDTH).toBe(10);
  });
  it("visible area is 20 rows", () => {
    expect(VISIBLE_HEIGHT).toBe(20);
  });
  it("buffer zone is 20 rows above skyline", () => {
    expect(BUFFER_HEIGHT).toBe(20);
  });
  it("board stores 40 rows total (visible + buffer)", () => {
    expect(BOARD_HEIGHT).toBe(40);
  });
  it("createBoard returns 40×10 grid of nulls", () => {
    const board = createBoard();
    expect(board.length).toBe(BOARD_HEIGHT);
    expect(board[0].length).toBe(BOARD_WIDTH);
    expect(board[0][0]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TDG §2: Spawn Positions
// ---------------------------------------------------------------------------

describe("TDG §2: Spawn Positions", () => {
  it("non-I pieces spawn at x=3", () => {
    expect(SPAWN_POSITION.x).toBe(3);
  });
  it("non-I pieces spawn at y=19 (just above skyline)", () => {
    expect(SPAWN_POSITION.y).toBe(19);
  });
  it("I-piece spawns at y=18", () => {
    expect(I_SPAWN_POSITION.y).toBe(18);
  });
  it("T-piece spawns in North (ZERO) orientation", () => {
    const piece = spawnPiece(TetriminoType.T);
    expect(piece.rotation).toBe(RotationState.ZERO);
  });
  it("I-piece spawns at its specific position", () => {
    const piece = spawnPiece(TetriminoType.I);
    expect(piece.pos.x).toBe(I_SPAWN_POSITION.x);
    expect(piece.pos.y).toBe(I_SPAWN_POSITION.y);
  });
  it("all pieces spawn in North (ZERO) orientation", () => {
    for (const type of Object.values(TetriminoType)) {
      expect(spawnPiece(type).rotation).toBe(RotationState.ZERO);
    }
  });
});

// ---------------------------------------------------------------------------
// TDG §5: 7-Bag Randomizer
// ---------------------------------------------------------------------------

describe("TDG §5: 7-Bag Randomizer", () => {
  it("each bag contains exactly 7 unique pieces", () => {
    const bag = createBag();
    expect(bag.length).toBe(7);
    expect(new Set(bag).size).toBe(7);
  });
  it("drawing 7 from a bag yields all 7 types exactly once", () => {
    let bag = createBag();
    const drawn: TetriminoType[] = [];
    for (let i = 0; i < 7; i++) {
      const result = drawFromBag(bag);
      drawn.push(result.piece);
      bag = result.bag;
    }
    for (const t of Object.values(TetriminoType)) {
      expect(drawn.filter((p) => p === t).length).toBe(1);
    }
  });
  it("first bag never starts with O, S, or Z", () => {
    const forbidden = new Set([TetriminoType.O, TetriminoType.S, TetriminoType.Z]);
    for (let i = 0; i < 50; i++) {
      const bag = createFirstBag();
      const first = drawFromBag(bag).piece;
      expect(forbidden.has(first)).toBe(false);
    }
  });
  it("across 700 draws, each piece appears roughly 100 times (±15%)", () => {
    let bag = createBag();
    const counts: Record<string, number> = {};
    for (const t of Object.values(TetriminoType)) counts[t] = 0;
    for (let i = 0; i < 700; i++) {
      const result = drawFromBag(bag);
      counts[result.piece]++;
      bag = result.bag;
      if (result.needsNewBag) bag = createBag();
    }
    for (const c of Object.values(counts)) {
      expect(c).toBeGreaterThanOrEqual(85);
      expect(c).toBeLessThanOrEqual(115);
    }
  });
});

// ---------------------------------------------------------------------------
// TDG §8: Next Queue
// ---------------------------------------------------------------------------

describe("TDG §8: Next Queue Size", () => {
  it("NEXT_QUEUE_SIZE is between 4 and 6", () => {
    expect(NEXT_QUEUE_SIZE).toBeGreaterThanOrEqual(4);
    expect(NEXT_QUEUE_SIZE).toBeLessThanOrEqual(6);
  });
  it("startGame initializes queue to NEXT_QUEUE_SIZE", () => {
    const state = startGame(createInitialState(GameMode.Marathon));
    expect(state.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
  });
  it("spawnNextPiece maintains queue at NEXT_QUEUE_SIZE", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    state = spawnNextPiece({ ...state, phase: GamePhase.EntryDelay });
    expect(state.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
  });
});

// ---------------------------------------------------------------------------
// TDG §3: Super Rotation System
// ---------------------------------------------------------------------------

describe("TDG §3: Super Rotation System", () => {
  it("T-piece CW rotation cycles through all 4 states and back", () => {
    const board = emptyBoard();
    let piece = spawnPiece(TetriminoType.T);
    const states = [RotationState.ZERO, RotationState.R, RotationState.TWO, RotationState.L];
    for (let i = 0; i < 4; i++) {
      expect(piece.rotation).toBe(states[i]);
      const result = tryRotateCW(piece, board);
      expect(result).not.toBeNull();
      piece = result!.piece;
    }
    expect(piece.rotation).toBe(RotationState.ZERO);
  });
  it("T-piece CCW rotation cycles through all 4 states", () => {
    const board = emptyBoard();
    let piece = spawnPiece(TetriminoType.T);
    for (let i = 0; i < 4; i++) {
      const result = tryRotateCCW(piece, board);
      expect(result).not.toBeNull();
      piece = result!.piece;
    }
    expect(piece.rotation).toBe(RotationState.ZERO);
  });
  it("O-piece rotation succeeds (identity — no kick needed)", () => {
    const board = emptyBoard();
    const piece = spawnPiece(TetriminoType.O);
    expect(tryRotateCW(piece, board)).not.toBeNull();
    expect(tryRotateCCW(piece, board)).not.toBeNull();
  });
  it("I-piece completes full CW rotation cycle", () => {
    const board = emptyBoard();
    let piece = spawnPiece(TetriminoType.I);
    for (let i = 0; i < 4; i++) {
      const result = tryRotateCW(piece, board);
      expect(result).not.toBeNull();
      piece = result!.piece;
    }
    expect(piece.rotation).toBe(RotationState.ZERO);
  });
  it("wall kick allows T-piece to rotate at left wall", () => {
    const board = emptyBoard();
    const piece = { type: TetriminoType.T, pos: { x: 0, y: 22 }, rotation: RotationState.R };
    expect(tryRotateCW(piece, board)).not.toBeNull();
  });
  it("O-piece rotation is identity — piece stays in same position through full cycle", () => {
    const board = emptyBoard();
    const piece = spawnPiece(TetriminoType.O);
    // O rotates through all 4 states but mino positions never change
    let current = piece;
    for (let i = 0; i < 4; i++) {
      const result = tryRotateCW(current, board);
      expect(result).not.toBeNull();
      current = result!.piece;
    }
    // After 4 rotations, back to original position
    expect(current.pos.x).toBe(piece.pos.x);
    expect(current.pos.y).toBe(piece.pos.y);
    expect(current.rotation).toBe(piece.rotation);
  });
});

// ---------------------------------------------------------------------------
// TDG §6: Ghost Piece
// ---------------------------------------------------------------------------

describe("TDG §6: Ghost Piece", () => {
  it("ghost Y is at or below current piece Y", () => {
    const board = emptyBoard();
    const piece = spawnPiece(TetriminoType.T);
    expect(getGhostY(board, piece)).toBeGreaterThanOrEqual(piece.pos.y);
  });
  it("ghost lands on top of existing blocks", () => {
    const board = emptyBoard();
    for (let c = 0; c < BOARD_WIDTH; c++) board[30][c] = TetriminoType.I;
    const piece = spawnPiece(TetriminoType.T);
    const ghostY = getGhostY(board, piece);
    expect(ghostY).toBeLessThan(30);
  });
  it("ghost Y equals piece Y when piece is directly on floor", () => {
    const board = emptyBoard();
    const piece = spawnPiece(TetriminoType.T);
    // Place piece as low as it can go on empty board
    const ghostY = getGhostY(board, piece);
    // Put piece at the ghost position — ghost should equal piece Y
    const piece2 = { ...piece, pos: { ...piece.pos, y: ghostY } };
    const ghostY2 = getGhostY(board, piece2);
    expect(ghostY2).toBe(piece2.pos.y);
  });
});

// ---------------------------------------------------------------------------
// TDG §7: Scoring — Line Clears
// ---------------------------------------------------------------------------

describe("TDG §7: Scoring — Line Clears", () => {
  it("Single = 100 × (level+1)", () => {
    expect(evaluateClear(1, { isTSpin: false, isMini: false }, 0, false, false).score).toBe(100);
  });
  it("Double = 300 × (level+1)", () => {
    expect(evaluateClear(2, { isTSpin: false, isMini: false }, 0, false, false).score).toBe(300);
  });
  it("Triple = 500 × (level+1)", () => {
    expect(evaluateClear(3, { isTSpin: false, isMini: false }, 0, false, false).score).toBe(500);
  });
  it("Tetris = 800 × (level+1)", () => {
    expect(evaluateClear(4, { isTSpin: false, isMini: false }, 0, false, false).score).toBe(800);
  });
  it("T-Spin (0 lines) = 400 × (level+1)", () => {
    expect(evaluateClear(0, { isTSpin: true, isMini: false }, 0, false, false).score).toBe(400);
  });
  it("T-Spin Single = 800 × (level+1)", () => {
    expect(evaluateClear(1, { isTSpin: true, isMini: false }, 0, false, false).score).toBe(800);
  });
  it("T-Spin Double = 1200 × (level+1)", () => {
    expect(evaluateClear(2, { isTSpin: true, isMini: false }, 0, false, false).score).toBe(1200);
  });
  it("T-Spin Triple = 1600 × (level+1)", () => {
    expect(evaluateClear(3, { isTSpin: true, isMini: false }, 0, false, false).score).toBe(1600);
  });
  it("Mini T-Spin (0 lines) = 100 × (level+1)", () => {
    expect(evaluateClear(0, { isTSpin: true, isMini: true }, 0, false, false).score).toBe(100);
  });
  it("Mini T-Spin Single = 200 × (level+1)", () => {
    expect(evaluateClear(1, { isTSpin: true, isMini: true }, 0, false, false).score).toBe(200);
  });
  it("all scores multiply by (level+1)", () => {
    expect(evaluateClear(4, { isTSpin: false, isMini: false }, 3, false, false).score).toBe(3200);
  });
});

// ---------------------------------------------------------------------------
// TDG §7: Scoring — Back-to-Back
// ---------------------------------------------------------------------------

describe("TDG §7: Scoring — Back-to-Back", () => {
  it("B2B Tetris = 800 × 1.5 = 1200 at level 0", () => {
    expect(evaluateClear(4, { isTSpin: false, isMini: false }, 0, true, false).score).toBe(1200);
  });
  it("B2B T-Spin Double = 1200 × 1.5 = 1800 at level 0", () => {
    expect(evaluateClear(2, { isTSpin: true, isMini: false }, 0, true, false).score).toBe(1800);
  });
  it("Tetris is B2B eligible", () => {
    expect(isB2BEligible(4, { isTSpin: false, isMini: false })).toBe(true);
  });
  it("T-Spin is B2B eligible", () => {
    expect(isB2BEligible(1, { isTSpin: true, isMini: false })).toBe(true);
  });
  it("Single is NOT B2B eligible", () => {
    expect(isB2BEligible(1, { isTSpin: false, isMini: false })).toBe(false);
  });
  it("Double is NOT B2B eligible", () => {
    expect(isB2BEligible(2, { isTSpin: false, isMini: false })).toBe(false);
  });
  it("Triple is NOT B2B eligible", () => {
    expect(isB2BEligible(3, { isTSpin: false, isMini: false })).toBe(false);
  });
  it("Single breaks B2B chain (isB2BBroken=true)", () => {
    const result = evaluateClear(1, { isTSpin: false, isMini: false }, 0, true, false);
    expect(result.isB2BBroken).toBe(true);
  });
  it("non-clearing lock does NOT break B2B (backToBack preserved)", () => {
    const board = emptyBoard();
    const s = baseState({ backToBack: true, board });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.backToBack).toBe(true);
  });
  it("T-Spin with 0 lines cleared sets backToBack=true (extends B2B chain)", () => {
    const result = evaluateClear(0, { isTSpin: true, isMini: false }, 0, true, false);
    expect(result.isB2B).toBe(true);
    expect(result.isB2BBroken).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TDG §7: Scoring — Perfect Clear
// ---------------------------------------------------------------------------

describe("TDG §7: Scoring — Perfect Clear", () => {
  it("Perfect Clear Single = 800 × (level+1)", () => {
    const result = evaluateClear(1, { isTSpin: false, isMini: false }, 0, false, true);
    expect(result.score).toBe(800);
  });
  it("Perfect Clear Double = 1200 × (level+1)", () => {
    const result = evaluateClear(2, { isTSpin: false, isMini: false }, 0, false, true);
    expect(result.score).toBe(1200);
  });
  it("Perfect Clear Triple = 1800 × (level+1)", () => {
    const result = evaluateClear(3, { isTSpin: false, isMini: false }, 0, false, true);
    expect(result.score).toBe(1800);
  });
  it("Perfect Clear Tetris = 2000 × (level+1)", () => {
    expect(evaluateClear(4, { isTSpin: false, isMini: false }, 0, false, true).score).toBe(2000);
  });
  it("B2B Perfect Clear Tetris = 3200 × (level+1)", () => {
    expect(evaluateClear(4, { isTSpin: false, isMini: false }, 0, true, true).score).toBe(3200);
  });
});

// ---------------------------------------------------------------------------
// TDG §7: Scoring — Drop Bonuses
// ---------------------------------------------------------------------------

describe("TDG §7: Scoring — Drop Bonuses", () => {
  it("soft drop awards 1 point per cell", () => {
    const s = baseState({
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 22 }, rotation: RotationState.ZERO },
    });
    const next = processAction(s, { type: "SoftDrop" });
    expect(next.score).toBe(1);
    expect(next.activePiece?.pos.y).toBe(23);
  });
  it("hard drop awards 2 points per cell fallen", () => {
    const s = baseState({
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO },
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.score).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// TDG §7: Hold Piece
// ---------------------------------------------------------------------------

describe("TDG §7: Hold Piece", () => {
  it("hold places current piece in hold box", () => {
    const state = startGame(createInitialState(GameMode.Marathon));
    const currentType = state.activePiece!.type;
    const next = holdPiece(state);
    expect(next.heldPiece).toBe(currentType);
  });
  it("cannot hold twice in same spawn (one per piece)", () => {
    const state = startGame(createInitialState(GameMode.Marathon));
    const after1 = holdPiece(state);
    expect(after1.hasSwappedThisTurn).toBe(true);
    const after2 = holdPiece(after1);
    expect(after2).toStrictEqual(after1); // second hold is no-op
  });
  it("held piece swaps back in North orientation", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    state = holdPiece(state);
    state = { ...state, hasSwappedThisTurn: false };
    const after = holdPiece(state);
    expect(after.activePiece?.rotation).toBe(RotationState.ZERO);
  });
  it("Block-Out via hold: game over when swapped piece collides at spawn", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    // Do a first hold to have a held piece
    state = holdPiece(state);
    // Allow another hold by resetting the swap flag
    state = { ...state, hasSwappedThisTurn: false };
    // Fill the spawn rows so any swap causes a collision
    const board = state.board.map((r) => [...r]);
    for (let c = 0; c < BOARD_WIDTH; c++) {
      board[19][c] = TetriminoType.Z;
      board[20][c] = TetriminoType.Z;
    }
    state = { ...state, board };
    const next = holdPiece(state);
    expect(next.phase).toBe(GamePhase.GameOver);
  });
});

// ---------------------------------------------------------------------------
// TDG §8: Lock Down
// ---------------------------------------------------------------------------

describe("TDG §8: Lock Down", () => {
  it("LOCK_DELAY is 500ms", () => {
    expect(LOCK_DELAY).toBe(500);
  });
  it("MAX_LOCK_RESETS is 15 (Extended Placement)", () => {
    expect(MAX_LOCK_RESETS).toBe(15);
  });
  it("ENTRY_DELAY (ARE) is 200ms", () => {
    expect(ENTRY_DELAY).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// TDG §8: Game Over — Lock-Out
// ---------------------------------------------------------------------------

describe("TDG §8: Game Over — Lock-Out", () => {
  it("Lock-Out: piece entirely in buffer zone triggers game over", () => {
    const board = emptyBoard();
    // Fill row 20 (first visible row) so I-piece at y=18 can't drop further
    board[20] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const s = baseState({
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO },
    });
    expect(processAction(s, { type: "HardDrop" }).phase).toBe(GamePhase.GameOver);
  });
  it("isLockOut true when all minos above skyline (I at y=18)", () => {
    // I ZERO shape: row1 has minos at y+1=19. BUFFER_HEIGHT=20 so 19 < 20 -> all in buffer
    const piece = { type: TetriminoType.I, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO };
    expect(isLockOut(piece)).toBe(true);
  });
  it("isLockOut false when minos extend to visible area (I at y=19)", () => {
    // I ZERO row1 minos at y+1=20, 20 >= BUFFER_HEIGHT=20 -> extends to visible -> not lockout
    const piece = { type: TetriminoType.I, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO };
    expect(isLockOut(piece)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TDG §8: Game Over — Block-Out
// ---------------------------------------------------------------------------

describe("TDG §8: Game Over — Block-Out", () => {
  it("Block-Out: spawn collision triggers game over", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    const board = state.board.map((r) => [...r]);
    for (let c = 0; c < BOARD_WIDTH; c++) {
      board[18][c] = TetriminoType.Z;
      board[19][c] = TetriminoType.Z;
      board[20][c] = TetriminoType.Z;
      board[21][c] = TetriminoType.Z;
    }
    state = { ...state, board, phase: GamePhase.EntryDelay };
    expect(spawnNextPiece(state).phase).toBe(GamePhase.GameOver);
  });
});

// ---------------------------------------------------------------------------
// TDG §9: T-Spin Detection
// ---------------------------------------------------------------------------

describe("TDG §9: T-Spin Detection", () => {
  it("non-T pieces never produce T-spin", () => {
    const board = emptyBoard();
    for (const type of [TetriminoType.I, TetriminoType.O, TetriminoType.S]) {
      const piece = { type, pos: { x: 1, y: 20 }, rotation: RotationState.ZERO };
      expect(detectTSpin(board, piece).isTSpin).toBe(false);
    }
  });
  it("3+ corners occupied → T-spin (ZERO rotation)", () => {
    const board = emptyBoard();
    const px = 1, py = 20;
    // Set TL, TR, BL: 3 corners occupied; ZERO back = TL+TR -> both occupied -> full T-spin
    board[py][px] = TetriminoType.Z;         // TL (back)
    board[py][px + 2] = TetriminoType.Z;     // TR (back)
    board[py + 2][px] = TetriminoType.Z;     // BL (front)
    const piece = { type: TetriminoType.T, pos: { x: px, y: py }, rotation: RotationState.ZERO };
    expect(detectTSpin(board, piece).isTSpin).toBe(true);
  });
  it("Full T-spin: both back corners occupied → not mini", () => {
    const board = emptyBoard();
    const px = 1, py = 20;
    board[py][px] = TetriminoType.Z;         // TL (back for ZERO)
    board[py][px + 2] = TetriminoType.Z;     // TR (back for ZERO)
    board[py + 2][px] = TetriminoType.Z;     // BL (front — 3rd corner)
    const piece = { type: TetriminoType.T, pos: { x: px, y: py }, rotation: RotationState.ZERO };
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(false);
  });
  it("Mini T-spin: only one back corner occupied", () => {
    const board = emptyBoard();
    const px = 1, py = 20;
    // BL and BR (both front), plus TL (one back) = 3 corners; only 1 back -> mini
    board[py + 2][px] = TetriminoType.Z;     // BL (front)
    board[py + 2][px + 2] = TetriminoType.Z; // BR (front)
    board[py][px] = TetriminoType.Z;         // TL (back — only one back)
    const piece = { type: TetriminoType.T, pos: { x: px, y: py }, rotation: RotationState.ZERO };
    const result = detectTSpin(board, piece);
    expect(result.isTSpin).toBe(true);
    expect(result.isMini).toBe(true);
  });
  it("fewer than 3 corners → no T-spin", () => {
    const board = emptyBoard();
    const px = 1, py = 20;
    board[py][px] = TetriminoType.Z; // only 1 corner
    const piece = { type: TetriminoType.T, pos: { x: px, y: py }, rotation: RotationState.ZERO };
    expect(detectTSpin(board, piece).isTSpin).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TDG §11: Variable Goal Level System
// ---------------------------------------------------------------------------

describe("TDG §11: Variable Goal Level System", () => {
  it("effective lines correct for all action types", () => {
    expect(effectiveLinesFor(1, { isTSpin: false, isMini: false }, false)).toBe(1);
    expect(effectiveLinesFor(2, { isTSpin: false, isMini: false }, false)).toBe(3);
    expect(effectiveLinesFor(3, { isTSpin: false, isMini: false }, false)).toBe(5);
    expect(effectiveLinesFor(4, { isTSpin: false, isMini: false }, false)).toBe(8);
    expect(effectiveLinesFor(0, { isTSpin: true, isMini: false }, false)).toBe(4);
    expect(effectiveLinesFor(1, { isTSpin: true, isMini: false }, false)).toBe(8);
    expect(effectiveLinesFor(2, { isTSpin: true, isMini: false }, false)).toBe(12);
    expect(effectiveLinesFor(3, { isTSpin: true, isMini: false }, false)).toBe(16);
    expect(effectiveLinesFor(0, { isTSpin: true, isMini: true }, false)).toBe(1);
    expect(effectiveLinesFor(1, { isTSpin: true, isMini: true }, false)).toBe(2);
  });
  it("B2B adds 50% effective lines (floor)", () => {
    expect(effectiveLinesFor(4, { isTSpin: false, isMini: false }, true)).toBe(12);
    expect(effectiveLinesFor(2, { isTSpin: true, isMini: false }, true)).toBe(18);
  });
  it("no clear, no T-spin = 0 effective lines", () => {
    expect(effectiveLinesFor(0, { isTSpin: false, isMini: false }, false)).toBe(0);
  });
  it("level thresholds are correct", () => {
    expect(calculateLevelFromEffective(0)).toBe(0);
    expect(calculateLevelFromEffective(5)).toBe(1);
    expect(calculateLevelFromEffective(15)).toBe(2);
    expect(calculateLevelFromEffective(599)).toBe(14);
    expect(calculateLevelFromEffective(600)).toBe(15);
    expect(calculateLevelFromEffective(999)).toBe(15);
  });
  it("LEVEL_GOAL_CUMULATIVE has 16 entries (0–15)", () => {
    expect(LEVEL_GOAL_CUMULATIVE.length).toBe(16);
    expect(LEVEL_GOAL_CUMULATIVE[0]).toBe(0);
    expect(LEVEL_GOAL_CUMULATIVE[15]).toBe(600);
  });
  it("75 Tetrises (8 eff each = 600) reach level 15", () => {
    expect(calculateLevelFromEffective(75 * 8)).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// TDG §12: Fall Speed (Gravity Curve)
// ---------------------------------------------------------------------------

describe("TDG §12: Fall Speed (Gravity Curve)", () => {
  it("GRAVITY_SPEED_CURVE covers all 15+ levels", () => {
    expect(GRAVITY_SPEED_CURVE.length).toBeGreaterThanOrEqual(15);
  });
  it("Level 0 = 1000ms (TDG formula)", () => {
    expect(getGravityDelay(0)).toBe(1000);
  });
  it("Level 1 = 793ms", () => {
    expect(getGravityDelay(1)).toBe(793);
  });
  it("Level 13 = 11ms", () => {
    expect(getGravityDelay(13)).toBe(11);
  });
  it("Level 14 = 7ms", () => {
    expect(getGravityDelay(14)).toBe(7);
  });
  it("Level 15+ speed is very fast (≤10ms)", () => {
    expect(getGravityDelay(15)).toBeLessThanOrEqual(10);
  });
  it("gravity delay strictly decreases with level", () => {
    for (let i = 1; i < GRAVITY_SPEED_CURVE.length; i++) {
      expect(GRAVITY_SPEED_CURVE[i]).toBeLessThan(GRAVITY_SPEED_CURVE[i - 1]);
    }
  });
  it("gravity drops piece when timer exceeds delay", () => {
    const state = baseState({
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 22 }, rotation: RotationState.ZERO },
    });
    const result = applyGravity(state, 1100); // > 1000ms level-0 delay
    expect(result.state.activePiece?.pos.y).toBeGreaterThan(22);
  });
});

// ---------------------------------------------------------------------------
// TDG §13: DAS/ARR Autorepeat Timing
// ---------------------------------------------------------------------------

describe("TDG §13: DAS/ARR Autorepeat Timing", () => {
  it("DAS_DELAY is ~300ms (TDG §13)", () => {
    expect(DAS_DELAY).toBeGreaterThanOrEqual(100);
    expect(DAS_DELAY).toBeLessThanOrEqual(500);
  });
  it("ARR_RATE is less than DAS_DELAY", () => {
    expect(ARR_RATE).toBeLessThan(DAS_DELAY);
  });
});

// ---------------------------------------------------------------------------
// TDG §15: Sprint Mode (no level-up)
// ---------------------------------------------------------------------------

describe("TDG §15: Sprint Mode (no level-up)", () => {
  it("Sprint victory at 40 lines", () => {
    expect(checkModeVictory({ ...baseState({ mode: GameMode.Sprint, lines: 40 }) })).toBe(true);
  });
  it("Sprint not victory at 39 lines", () => {
    expect(checkModeVictory({ ...baseState({ mode: GameMode.Sprint, lines: 39 }) })).toBe(false);
  });
  it("Sprint: level does not increase after clearing lines", () => {
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const s = baseState({
      mode: GameMode.Sprint,
      level: 0,
      lines: 0,
      effectiveLines: 0,
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 3,
    });
    expect(processAction(s, { type: "HardDrop" }).level).toBe(0);
  });
  it("Sprint: starting level preserved at non-zero after line clears", () => {
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const s = baseState({
      mode: GameMode.Sprint,
      level: 3,
      lines: 0,
      effectiveLines: 0,
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 3,
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.level).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// TDG §15: Ultra Mode (no level-up)
// ---------------------------------------------------------------------------

describe("TDG §15: Ultra Mode (no level-up)", () => {
  it("Ultra victory when timer reaches 0", () => {
    expect(checkModeVictory({ ...baseState({ mode: GameMode.Ultra, modeTimer: 0 }) })).toBe(true);
  });
  it("Ultra not victory when timer > 0", () => {
    expect(checkModeVictory({ ...baseState({ mode: GameMode.Ultra, modeTimer: 1000 }) })).toBe(false);
  });
  it("Ultra: level does not increase after clearing lines", () => {
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const s = baseState({
      mode: GameMode.Ultra,
      level: 1,
      lines: 0,
      effectiveLines: 0,
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 3,
    });
    expect(processAction(s, { type: "HardDrop" }).level).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TDG §15: Marathon Mode
// ---------------------------------------------------------------------------

describe("TDG §15: Marathon Mode", () => {
  it("Marathon victory at level 15", () => {
    expect(checkModeVictory({ ...baseState({ mode: GameMode.Marathon, level: 15 }) })).toBe(true);
  });
  it("Marathon not victory at level 14", () => {
    expect(checkModeVictory({ ...baseState({ mode: GameMode.Marathon, level: 14 }) })).toBe(false);
  });
  it("Marathon MARATHON_MAX_LEVEL is 15", () => {
    expect(MARATHON_MAX_LEVEL).toBe(15);
  });
  it("Marathon: level increases via Variable Goal", () => {
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const s = baseState({
      mode: GameMode.Marathon,
      level: 0,
      effectiveLines: 4, // one single (1 eff) will push to 5 → level 1
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 3,
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.level).toBe(1);
  });
});
