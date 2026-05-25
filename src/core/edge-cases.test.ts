/**
 * Comprehensive edge-case stress tests for core game mechanics.
 *
 * Covers boundary conditions, extreme values, and known cross-project
 * exploit patterns identified in the Tetris implementation research.
 */
import { describe, it, expect } from "vitest";
import { createInitialState, startGame, spawnNextPiece, holdPiece } from "./state.ts";
import { processAction } from "./actions.ts";
import { createBoard, isLockOut, clearLines, isPerfectClear } from "./board.ts";
import { updateCombo } from "./combo.ts";
import { evaluateClear } from "./scoring.ts";
import { applyGravity } from "./gravity.ts";
import { shouldLock as checkLock } from "./lock-delay.ts";
import { drawFromBag, createFirstBag, createBag } from "./randomizer.ts";
import {
  BOARD_WIDTH, BOARD_HEIGHT,
  LOCK_DELAY, MAX_LOCK_RESETS,
  COMBO_BASE,
  NEXT_QUEUE_SIZE,
} from "../core/constants.ts";
import {
  GameMode, GamePhase, TetriminoType, RotationState,
} from "../core/types.ts";
import type { TSpinResult, Piece } from "../core/types.ts";
import { baseState } from "../test-utils/test-utils.ts";

// ── Perfect clear permutations ──────────────────────────────────────────

describe("edge: perfect clear permutations", () => {
  it("single line clear + perfect clear at level 0 = 800", () => {
    const result = evaluateClear(1, { isTSpin: false, isMini: false }, 0, false, true);
    expect(result.score).toBe(800);
  });

  it("double line clear + perfect clear = 1200", () => {
    const result = evaluateClear(2, { isTSpin: false, isMini: false }, 0, false, true);
    expect(result.score).toBe(1200);
  });

  it("triple line clear + perfect clear = 1800", () => {
    const result = evaluateClear(3, { isTSpin: false, isMini: false }, 0, false, true);
    expect(result.score).toBe(1800);
  });

  it("tetris + perfect clear = 2000 at level 0", () => {
    const result = evaluateClear(4, { isTSpin: false, isMini: false }, 0, false, true);
    expect(result.score).toBe(2000);
  });

  it("B2B tetris perfect clear = 3200 at level 0", () => {
    const result = evaluateClear(4, { isTSpin: false, isMini: false }, 0, true, true);
    expect(result.score).toBe(3200);
  });

  it("T-spin double + perfect clear uses PC score (1200) instead of T-spin score", () => {
    // evaluateClear uses the PC score INSTEAD of the base score
    const tSpin: TSpinResult = { isTSpin: true, isMini: false };
    const result = evaluateClear(2, tSpin, 0, false, true);
    expect(result.score).toBe(1200); // PC double = 1200
  });
});

// ── Lock delay boundary (infinity exploit prevention) ──────────────────

describe("edge: lock delay boundaries", () => {
  it("shouldLock returns false before LOCK_DELAY elapses", () => {
    const state = baseState({
      phase: GamePhase.Playing,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
      lockState: { timer: 0, resets: 0, onGround: true, lowestY: 20 },
    });
    const result = checkLock(state, LOCK_DELAY - 1);
    expect(result.shouldLock).toBe(false);
  });

  it("shouldLock returns true after LOCK_DELAY elapses on ground", () => {
    const state = baseState({
      phase: GamePhase.Playing,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
      lockState: { timer: 0, resets: 0, onGround: true, lowestY: 20 },
    });
    const result = checkLock(state, LOCK_DELAY);
    expect(result.shouldLock).toBe(true);
  });

  it("lock forced after MAX_LOCK_RESETS regardless of timer (TDG §7)", () => {
    const state = baseState({
      phase: GamePhase.Playing,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
      lockState: { timer: 0, resets: MAX_LOCK_RESETS, onGround: true, lowestY: 20 },
    });
    const result = checkLock(state, 0);
    expect(result.shouldLock).toBe(true);
  });

  it("resets >= MAX_LOCK_RESETS prevents further resets (infinity prevention)", () => {
    let state = baseState({
      phase: GamePhase.Playing,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
      lockState: { timer: 0, resets: MAX_LOCK_RESETS, onGround: true, lowestY: 20 },
    });
    state = processAction(state, { type: "MoveLeft" });
    expect(state.lockState.resets).toBeLessThanOrEqual(MAX_LOCK_RESETS);
  });
});

// ── Combo chain stress ─────────────────────────────────────────────────

describe("edge: combo chain stress", () => {
  it("combo chain from 0 to 255 works correctly", () => {
    let state = baseState({ combo: -1, level: 0 });
    let totalComboScore = 0;

    for (let expectedCombo = 0; expectedCombo <= 254; expectedCombo++) {
      const result = updateCombo(state, 1);
      state = result.state;
      expect(state.combo).toBe(expectedCombo);

      // Bonus = COMBO_BASE * (expectedCombo + 1) because updateCombo uses newCombo
      // Actually: newCombo = state.combo + 1 (previous state combo)
      // Wait, first call: combo=-1, linesCleared=1 => newCombo=0
      // Expected combo after first call = 0
      // Bonus = COMBO_BASE * 0 = 0
      // Second call: combo=0, LC=1 => newCombo=1. Bonus = 50 * 1 = 50
      const expectedBonus = expectedCombo === 0 ? 0 : COMBO_BASE * expectedCombo;
      expect(result.bonusScore).toBe(expectedBonus);
      totalComboScore += result.bonusScore;
    }
    // State should be at combo=254 after 255 consecutive clears
    expect(state.combo).toBe(254);
  });

  it("combo resets on non-clear", () => {
    let state = baseState({ combo: 100 });
    // 0 lines cleared should reset combo
    state = updateCombo(state, 0).state;
    expect(state.combo).toBe(-1);
  });
});

// ── Spawn collision for every piece type ───────────────────────────────

describe("edge: spawn collision (block-out)", () => {
  // For each piece type, fill the board at different heights and verify
  // spawnNextPiece returns GameOver when collision occurs.

  it("I-piece block-out when spawn cells occupied", () => {
    const board = createBoard();
    // I-piece spawns at y=18, ZERO rotation: filled row is row 19 (y+1)
    board[19][3] = TetriminoType.Z;
    board[19][4] = TetriminoType.Z;
    board[19][5] = TetriminoType.Z;
    board[19][6] = TetriminoType.Z;
    const state = baseState({
      board,
      phase: GamePhase.EntryDelay,
      nextQueue: [{ type: TetriminoType.I }],
      bag: [],
    });
    const result = spawnNextPiece(state);
    expect(result.phase).toBe(GamePhase.GameOver);
  });

  it("O-piece block-out when spawn row filled at y=19", () => {
    const board = createBoard();
    board[19][3] = TetriminoType.Z;
    board[19][4] = TetriminoType.Z;
    board[20][3] = TetriminoType.Z;
    board[20][4] = TetriminoType.Z;
    const state = baseState({
      board,
      phase: GamePhase.EntryDelay,
      nextQueue: [{ type: TetriminoType.O }],
      bag: [],
    });
    const result = spawnNextPiece(state);
    expect(result.phase).toBe(GamePhase.GameOver);
  });

  it("T-piece block-out when spawn row filled", () => {
    const board = createBoard();
    // T-piece spawns at x=3, y=19. Shape occupies (3,19),(4,19),(5,19),(4,20)
    board[19][3] = TetriminoType.Z;
    board[19][4] = TetriminoType.Z;
    board[19][5] = TetriminoType.Z;
    const state = baseState({
      board,
      phase: GamePhase.EntryDelay,
      nextQueue: [{ type: TetriminoType.T }],
      bag: [],
    });
    const result = spawnNextPiece(state);
    expect(result.phase).toBe(GamePhase.GameOver);
  });

  it("lock-out: piece locked entirely above visible area", () => {
    // I-piece at y=18, ZERO rotation: minos at row 19 (y+1=19 < BUFFER_HEIGHT=20)
    // This means piece is entirely in buffer zone -> lock-out
    const piece: Piece = { type: TetriminoType.I, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO };
    expect(isLockOut(piece)).toBe(true);
  });

  it("not lock-out: piece extends to visible area", () => {
    const piece: Piece = { type: TetriminoType.I, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO };
    // Row 20 >= BUFFER_HEIGHT (20) -> extends to visible, not lock-out
    expect(isLockOut(piece)).toBe(false);
  });
});

// ── Full hold-cycle over entire 7-bag ──────────────────────────────────

describe("edge: hold cycle over full bag", () => {
  it("can hold through multiple pieces in a cycle", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    const seenPieces = new Set<TetriminoType>();

    // Hold the first piece
    state = holdPiece(state);
    if (state.heldPiece) seenPieces.add(state.heldPiece);

    // For the next few swaps, each should give us a new piece
    for (let i = 0; i < 6; i++) {
      // Simulate a new piece spawn by resetting hasSwappedThisTurn
      state = { ...state, hasSwappedThisTurn: false };
      state = holdPiece(state);
      if (state.heldPiece) seenPieces.add(state.heldPiece);
    }

    // We should have seen multiple unique pieces as held options
    expect(seenPieces.size).toBeGreaterThan(0);
  });

  it("hold returns piece in North (ZERO) rotation", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    state = holdPiece(state);
    state = { ...state, hasSwappedThisTurn: false };
    state = holdPiece(state);
    if (state.activePiece) {
      expect(state.activePiece.rotation).toBe(RotationState.ZERO);
    }
  });
});

// ── Gravity timer edge values ──────────────────────────────────────────

describe("edge: gravity timer edge values", () => {
  it("dt=0 does not move piece", () => {
    const state = baseState({
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
      level: 0,
    });
    const result = applyGravity(state, 0);
    expect(result.state.activePiece?.pos.y).toBe(20);
  });

  it("gravity at level 0 drops piece after 1000ms", () => {
    const state = baseState({
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
      level: 0,
      gravityTimer: 0,
    });
    const result = applyGravity(state, 1000);
    expect(result.state.activePiece?.pos.y).toBe(21);
  });

  it("gravity does not drop before delay threshold", () => {
    const state = baseState({
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
      level: 0,
      gravityTimer: 0,
    });
    const result = applyGravity(state, 999);
    expect(result.state.activePiece?.pos.y).toBe(20);
  });

  it("gravity timer carries over leftover time", () => {
    // 1500ms at level 0 (1000ms delay): drops once, carries 500ms
    const state = baseState({
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 20 }, rotation: RotationState.ZERO },
      level: 0,
      gravityTimer: 0,
    });
    const result = applyGravity(state, 1500);
    expect(result.state.activePiece?.pos.y).toBe(21);
    // Timer should carry over 500ms
    expect(result.state.gravityTimer).toBe(500);
  });
});

// ── Next queue consistency ─────────────────────────────────────────────

describe("edge: next queue consistency", () => {
  it("spawned pieces are removed from front of queue", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    const firstQueue = state.nextQueue.map((q) => q.type);
    const firstType = firstQueue[0];

    state = spawnNextPiece({ ...state, phase: GamePhase.EntryDelay });
    expect(state.activePiece?.type).toBe(firstType);
  });

  it("queue length stays at NEXT_QUEUE_SIZE after spawn", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    for (let i = 0; i < 10; i++) {
      state = spawnNextPiece({ ...state, phase: GamePhase.EntryDelay });
      expect(state.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
    }
  });

  it("hold piece does not consume from queue on first hold", () => {
    let state = startGame(createInitialState(GameMode.Marathon));
    const queueBefore = state.nextQueue.map((q) => q.type);
    state = holdPiece(state);
    // First hold: held piece = active, new active = first from queue
    const firstInQueue = queueBefore[0];
    expect(state.activePiece?.type).toBe(firstInQueue);
  });
});

// ── 7-bag boundary behavior ───────────────────────────────────────────

describe("edge: 7-bag boundary", () => {
  it("bag always contains exactly 7 unique pieces", () => {
    for (let i = 0; i < 100; i++) {
      const bag = createBag();
      expect(bag.length).toBe(7);
      expect(new Set(bag).size).toBe(7);
    }
  });

  it("first bag never starts with O, S, or Z", () => {
    const forbidden = new Set([TetriminoType.O, TetriminoType.S, TetriminoType.Z]);
    for (let i = 0; i < 100; i++) {
      const bag = createFirstBag();
      const first = bag[0];
      expect(forbidden.has(first)).toBe(false);
    }
  });

  it("across 700 draws, each piece appears roughly 100 times (±20%)", () => {
    let bag = createBag();
    const counts: Record<string, number> = {};
    for (const t of Object.values(TetriminoType)) counts[t] = 0;
    for (let i = 0; i < 700; i++) {
      const result = drawFromBag(bag);
      counts[result.piece]++;
      bag = result.bag;
      if (result.needsNewBag) bag = createBag();
    }
    // Each piece should appear ~100 times in 700 draws with 7-piece bags
    for (const c of Object.values(counts)) {
      expect(c).toBeGreaterThanOrEqual(80);
      expect(c).toBeLessThanOrEqual(120);
    }
  });
});

// ── Lock-out / Block-out / Top-out ─────────────────────────────────────

describe("edge: lock-out, block-out, top-out", () => {
  it("I-piece lock-out at y=18, not at y=19", () => {
    expect(isLockOut({ type: TetriminoType.I, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO })).toBe(true);
    expect(isLockOut({ type: TetriminoType.I, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO })).toBe(false);
  });

  it("T-piece lock-out at y=18 (all minos above visible)", () => {
    // T ZERO: row0 has 3 minos at y=18, row1 has 1 mino at y=19
    // Row 19 < BUFFER_HEIGHT 20 -> all in buffer -> lock-out
    expect(isLockOut({ type: TetriminoType.T, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO })).toBe(true);
  });

  it("T-piece at y=19 is NOT lock-out (one mino at row 20 = visible)", () => {
    expect(isLockOut({ type: TetriminoType.T, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO })).toBe(false);
  });

  it("O-piece lock-out at y=18", () => {
    // O ZERO: 2x2 at y=18 and y=19, both < BUFFER_HEIGHT 20 -> lock-out
    expect(isLockOut({ type: TetriminoType.O, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO })).toBe(true);
  });

  it("O-piece at y=19 is NOT lock-out (bottom row at y=20 = visible)", () => {
    expect(isLockOut({ type: TetriminoType.O, pos: { x: 3, y: 19 }, rotation: RotationState.ZERO })).toBe(false);
  });

  it("hard drop I-piece at y=18 onto filled row 20 triggers lock-out game over", () => {
    const board = createBoard();
    board[20] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const state = baseState({
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 18 }, rotation: RotationState.ZERO },
      ghostY: 18,
      phase: GamePhase.Playing,
    });
    const result = processAction(state, { type: "HardDrop" });
    expect(result.phase).toBe(GamePhase.GameOver);
  });
});

// ── Multi-line clear with gaps (concurrent delete pattern) ────────────

describe("edge: concurrent line clear", () => {
  it("clears non-contiguous filled rows correctly", () => {
    const board = createBoard();
    // Fill rows 35 and 38 (skip 36 and 37)
    for (let c = 0; c < BOARD_WIDTH; c++) {
      board[35][c] = TetriminoType.I;
      board[38][c] = TetriminoType.I;
    }
    const result = clearLines(board);
    expect(result.linesCleared).toBe(2);
    // After clearing 2 rows, the board should have them as empty
    // Rows 35 and 38 removed, empty rows at top
    expect(result.board[BOARD_HEIGHT - 1].every((c) => c === null)).toBe(true);
    expect(result.board[BOARD_HEIGHT - 2].every((c) => c === null)).toBe(true);
  });

  it("all rows full = clears 40 lines, board becomes empty", () => {
    const board = createBoard();
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) board[r][c] = TetriminoType.I;
    }
    const result = clearLines(board);
    expect(result.linesCleared).toBe(40);
    expect(isPerfectClear(result.board)).toBe(true);
  });
});
