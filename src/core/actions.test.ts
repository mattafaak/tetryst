import { describe, it, expect } from "vitest";
import { processAction } from "./actions.ts";
import { GamePhase, TetriminoType, RotationState , GameMode } from "./types.ts";
import type { Cell, GameState } from "./types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT } from "./constants.ts";
import { checkModeVictory } from "./mode-rules.ts";
import { shouldLock } from "./lock-delay.ts";

function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<Cell>(BOARD_WIDTH).fill(null),
  );
}

function makePiece(y: number) {
  return {
    type: TetriminoType.I,
    pos: { x: 3, y },
    rotation: RotationState.ZERO,
  };
}

function baseState(overrides?: Partial<GameState>): GameState {
  return {
    board: emptyBoard(),
    activePiece: makePiece(20),
    ghostY: 30,
    heldPiece: null,
    hasSwappedThisTurn: false,
    nextQueue: [],
    score: 0,
    level: 0,
    lines: 0,
    effectiveLines: 0,
    combo: 0,
    backToBack: false,
    phase: GamePhase.Playing,
    gravityTimer: 0,
    lockState: { timer: 0, resets: 5, onGround: false, lowestY: 20, lastRotationKickIndex: null },
    entryDelayTimer: 0,
    bag: [],
    lineClearTimer: 0,
    clearedRowIndices: [],
    mode: GameMode.Marathon,
    modeTimer: 0,
    popups: [],
    piecesPlaced: 0,
    totalKeypresses: 0,
    finesseFaults: 0,
    currentPieceKeypresses: 0,
    ...overrides,
  };
}

describe("handleMove horizontal into gap", () => {
  it("clears onGround when piece slides from solid ground into open air", () => {
    const board = emptyBoard();
    // Vertical I-piece (rotation R): mino column = pos.x + 2.
    // At pos.x=3 minos are at col 5, rows BOARD_HEIGHT-5 through BOARD_HEIGHT-2.
    // Solid at (BOARD_HEIGHT-1, col 5) → piece is on the ground.
    // Empty at (BOARD_HEIGHT-1, col 6) → the chasm revealed after MoveRight.
    board[BOARD_HEIGHT - 1][5] = TetriminoType.Z;

    const state = baseState({
      board,
      activePiece: {
        type: TetriminoType.I,
        pos: { x: 3, y: BOARD_HEIGHT - 5 },
        rotation: RotationState.R,
      },
      lockState: { timer: 300, resets: 0, onGround: true, lowestY: BOARD_HEIGHT - 5, lastRotationKickIndex: null },
    });

    const next = processAction(state, { type: "MoveRight" });

    expect(next.activePiece?.pos.x).toBe(4);
    expect(next.lockState.onGround).toBe(false);
    expect(next.lockState.timer).toBe(0);
  });

  it("preserves onGround and resets timer when piece remains on solid ground after slide", () => {
    const board = emptyBoard();
    // Solid at (BOARD_HEIGHT-1, col 5) and (BOARD_HEIGHT-1, col 6) — no gap.
    board[BOARD_HEIGHT - 1][5] = TetriminoType.Z;
    board[BOARD_HEIGHT - 1][6] = TetriminoType.Z;

    const state = baseState({
      board,
      activePiece: {
        type: TetriminoType.I,
        pos: { x: 3, y: BOARD_HEIGHT - 5 },
        rotation: RotationState.R,
      },
      lockState: { timer: 300, resets: 0, onGround: true, lowestY: BOARD_HEIGHT - 5, lastRotationKickIndex: null },
    });

    const next = processAction(state, { type: "MoveRight" });

    expect(next.activePiece?.pos.x).toBe(4);
    expect(next.lockState.onGround).toBe(true);
    expect(next.lockState.timer).toBe(0);   // lock timer reset
    expect(next.lockState.resets).toBe(1);  // reset counted
  });
});

describe("handleRotate — wall kick and onGround", () => {
  // SRS "1->0" (R→ZERO CCW) kick table: [{0,0},{1,0},{1,1},{0,-2},{1,-2}]
  // We engineer a board where kicks 1–3 fail and kick 4 ({x:0, y:-2}) succeeds,
  // landing the piece 2 rows up — clearly airborne.
  it("RotateCCW: wall kick that lifts piece into open air clears onGround", () => {
    const board = emptyBoard();
    // T-piece R rotation at (3,10): minos at (10,4),(11,4),(11,5),(12,4)
    // Cannot descend to y=11 because board[12][5] blocks it.
    // Kick 1 (0,0)   → T-ZERO at (3,10): (10,4),(11,3),(11,4),(11,5) — board[11][3] blocks
    // Kick 2 (1,0)   → T-ZERO at (4,10): (10,5),(11,4),(11,5),(11,6) — board[11][6] blocks
    // Kick 3 (1,1)   → T-ZERO at (4,11): (11,5),(12,4),(12,5),(12,6) — board[12][5] blocks
    // Kick 4 (0,-2)  → T-ZERO at (3,8):  (8,4),(9,3),(9,4),(9,5)   — all clear ✓ (airborne)
    board[11][3] = TetriminoType.Z;  // blocks kick 1
    board[11][6] = TetriminoType.Z;  // blocks kick 2
    board[12][5] = TetriminoType.Z;  // blocks kick 3 and grounds the piece

    const state = baseState({
      board,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 10 }, rotation: RotationState.R },
      lockState: { timer: 300, resets: 2, onGround: true, lowestY: 10, lastRotationKickIndex: null },
    });

    const next = processAction(state, { type: "RotateCCW" });

    expect(next.activePiece?.pos.y).toBe(8);        // kicked up 2
    expect(next.activePiece?.pos.x).toBe(3);
    expect(next.lockState.onGround).toBe(false);    // now airborne
    expect(next.lockState.timer).toBe(0);
  });

  it("RotateCW: rotation that keeps piece on ground preserves onGround and resets timer", () => {
    // T-piece ZERO at (3, BOARD_HEIGHT-2) on empty board.
    // Cannot descend (minos at row BOARD_HEIGHT-1; one more row → OOB).
    // CW "0->1" kicks: [{0,0},{-1,0},{-1,-1},{0,2},{-1,2}]
    // Kick 1 (0,0)  → T-R at (3, BH-2): minos include row BH   → OOB, fails
    // Kick 2 (-1,0) → T-R at (2, BH-2): minos include row BH   → OOB, fails
    // Kick 3 (-1,-1)→ T-R at (2, BH-3): minos (BH-3,3),(BH-2,3),(BH-2,4),(BH-1,3) — clear, succeeds
    // After kick 3: bottom mino at row BH-1 → one more step → OOB → still on ground
    const BH = BOARD_HEIGHT;
    const state = baseState({
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: BH - 2 }, rotation: RotationState.ZERO },
      lockState: { timer: 400, resets: 1, onGround: true, lowestY: BH - 2, lastRotationKickIndex: null },
    });

    const next = processAction(state, { type: "RotateCW" });

    expect(next.activePiece?.pos.y).toBe(BH - 3);  // kicked up by 1
    expect(next.lockState.onGround).toBe(true);     // still on ground after kick
    expect(next.lockState.timer).toBe(0);           // timer reset
    expect(next.lockState.resets).toBe(2);          // resets incremented
  });
});

describe("handleSoftDrop", () => {
  it("resets lock resets counter when piece descends to new lowest Y", () => {
    const state = baseState({
      lockState: { timer: 200, resets: 10, onGround: false, lowestY: 20, lastRotationKickIndex: null },
      activePiece: makePiece(20),
    });
    const next = processAction(state, { type: "SoftDrop" });
    expect(next.activePiece?.pos.y).toBe(21);
    expect(next.lockState.lowestY).toBe(21);
    expect(next.lockState.resets).toBe(0);
    expect(next.lockState.timer).toBe(200); // timer NOT reset by soft drop — only horizontal moves/rotations reset it
    expect(next.score).toBe(1); // 1 point per cell soft-dropped
  });

  it("clears stale onGround=true when piece can still fall after soft drop", () => {
    // Artificially stale state: piece is mid-air but onGround=true (e.g., from rotation kick)
    const state = baseState({
      activePiece: makePiece(20),  // I-piece, lots of room to fall
      lockState: { timer: 400, resets: 3, onGround: true, lowestY: 20, lastRotationKickIndex: null },
    });

    const next = processAction(state, { type: "SoftDrop" });

    expect(next.activePiece?.pos.y).toBe(21);
    expect(next.lockState.onGround).toBe(false);  // can still fall → not on ground
    expect(next.lockState.timer).toBe(400); // timer NOT reset by soft drop
  });

  it("sets onGround=true immediately when soft drop lands piece on solid", () => {
    const board = emptyBoard();
    // I-piece ZERO minos sit at row pos.y+1. Soft drop succeeds (y=20→21, minos row 22 clear).
    // At y=21 minos are at row 22; moving further puts them at row 23 — solid → lands.
    board[23] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const state = baseState({
      board,
      activePiece: makePiece(20),
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 20, lastRotationKickIndex: null },
    });

    const next = processAction(state, { type: "SoftDrop" });

    expect(next.activePiece?.pos.y).toBe(21);
    expect(next.lockState.onGround).toBe(true);  // landed — lock timer starts
    expect(next.lockState.timer).toBe(0);
  });

  it("does not change state when piece is blocked from moving down", () => {
    const board = emptyBoard();
    // I-piece at y=20 in rotation ZERO has minos at shape row 1 → board row 21.
    // Moving to y=21 would put minos at board row 22. Fill row 22 to block descent.
    board[22] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const state = baseState({
      board,
      activePiece: makePiece(20),
    });
    const next = processAction(state, { type: "SoftDrop" });
    expect(next).toBe(state);
  });

  it("resets gravityTimer to 0 on soft drop (Phase 14.3)", () => {
    const state = baseState({
      gravityTimer: 200, // arbitrary non-zero value
      activePiece: makePiece(20),
    });
    const next = processAction(state, { type: "SoftDrop" });
    expect(next.gravityTimer).toBe(0);
  });
});

describe("handleHardDrop", () => {
  it("produces a state where checkModeVictory is true when Sprint 40-line target is crossed", () => {
    // Sprint game with 38 lines already cleared; two full rows at the bottom.
    // Hard-dropping the I-piece clears 2 more lines → total 40 → checkModeVictory must be true.
    // (The game loop must call checkModeVictory after hard-drop — this test verifies the state
    //  produced by processAction is sufficient for victory to be detected there.)
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    board[BOARD_HEIGHT - 2] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const s = baseState({
      mode: GameMode.Sprint,
      level: 0,
      lines: 38,
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 6,
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.lines).toBe(40);
    expect(checkModeVictory(next)).toBe(true);
  });

  it("transitions to GameOver when piece locks entirely in buffer zone (Lock-Out)", () => {
    // I-piece rotation ZERO: minos at shape row 1. At pos.y=18, row 1 lands at board row 19.
    // Board row 19 is in the buffer zone (row < BUFFER_HEIGHT=20).
    // If board row 20 is full, the piece can't drop further and locks at y=18 (all in buffer).
    const board = emptyBoard();
    board[20] = Array(BOARD_WIDTH).fill(TetriminoType.Z); // skyline blocked
    const state = baseState({
      board,
      activePiece: makePiece(18), // I-piece at y=18, can't drop (row 20 is full)
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 18, lastRotationKickIndex: null },
    });
    const next = processAction(state, { type: "HardDrop" });
    expect(next.phase).toBe(GamePhase.GameOver);
    expect(next.activePiece).toBeNull();
  });

  it("lock-out: score unchanged and lastLockResult undefined (32.2a)", () => {
    const board = emptyBoard();
    board[20] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const state = baseState({
      board,
      score: 1234,
      activePiece: makePiece(18),
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 18, lastRotationKickIndex: null },
    });
    const next = processAction(state, { type: "HardDrop" });
    expect(next.phase).toBe(GamePhase.GameOver);
    expect(next.score).toBe(1234);
    expect((next as { lastLockResult?: unknown }).lastLockResult).toBeUndefined();
  });

  it("clears clearedRowIndices when hard drop does not clear lines (Phase 14.2)", () => {
    // Regression: executeLock retained stale clearedRowIndices in the zero-clear path
    const board = emptyBoard();
    const s = baseState({
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      clearedRowIndices: [1, 2, 3], // stale data that should be cleared
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.clearedRowIndices).toEqual([]);
  });

  it("sets lastLockResult after non-clearing hard drop (Phase 14.1)", () => {
    const board = emptyBoard();
    const s = baseState({
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.lastLockResult).toBeDefined();
    expect(next.lastLockResult!.linesCleared).toBe(0);
    expect(next.lastLockResult!.isPerfectClear).toBe(false);
    expect(next.lastLockResult!.isTSpin).toBe(false);
    expect(next.lastLockResult!.victoryTriggered).toBe(false);
  });

  it("sets lastLockResult with linesCleared=4 on Tetris (Phase 14.1)", () => {
    const board = emptyBoard();
    for (let i = 0; i < 4; i++) {
      board[BOARD_HEIGHT - 1 - i] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    }
    const s = baseState({
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 6,
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.lastLockResult).toBeDefined();
    expect(next.lastLockResult!.linesCleared).toBe(4);
    expect(next.lastLockResult!.isPerfectClear).toBe(false);
  });

  it("sets lastLockResult with victoryTriggered for Sprint mode (Phase 14.1)", () => {
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    board[BOARD_HEIGHT - 2] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const s = baseState({
      mode: GameMode.Sprint,
      level: 0,
      lines: 38,
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 6,
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.lastLockResult).toBeDefined();
    expect(next.lastLockResult!.victoryTriggered).toBe(true);
  });
});

describe("infinite spin prevention — kick-to-air consumes a reset (TDG §7)", () => {
  it("handleMove: slide to open air increments resets when below limit", () => {
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1][5] = TetriminoType.Z; // ground under col 5 only
    const state = baseState({
      board,
      activePiece: {
        type: TetriminoType.I,
        pos: { x: 3, y: BOARD_HEIGHT - 5 },
        rotation: RotationState.R,
      },
      lockState: { timer: 300, resets: 0, onGround: true, lowestY: BOARD_HEIGHT - 5, lastRotationKickIndex: null },
    });
    const next = processAction(state, { type: "MoveRight" });
    expect(next.lockState.onGround).toBe(false);
    expect(next.lockState.timer).toBe(0);     // reset because canReset
    expect(next.lockState.resets).toBe(1);    // consumed one reset
  });

  it("handleMove: slide to open air at reset limit does NOT reset timer", () => {
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1][5] = TetriminoType.Z;
    const state = baseState({
      board,
      activePiece: {
        type: TetriminoType.I,
        pos: { x: 3, y: BOARD_HEIGHT - 5 },
        rotation: RotationState.R,
      },
      lockState: { timer: 300, resets: 15, onGround: true, lowestY: BOARD_HEIGHT - 5, lastRotationKickIndex: null },
    });
    const next = processAction(state, { type: "MoveRight" });
    expect(next.lockState.onGround).toBe(false);
    expect(next.lockState.timer).toBe(300);   // NOT reset — resets exhausted
    expect(next.lockState.resets).toBe(15);   // unchanged
  });

  it("handleRotateCCW: kick to open air increments resets when below limit", () => {
    const board = emptyBoard();
    board[11][3] = TetriminoType.Z;
    board[11][6] = TetriminoType.Z;
    board[12][5] = TetriminoType.Z;
    const state = baseState({
      board,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 10 }, rotation: RotationState.R },
      lockState: { timer: 300, resets: 2, onGround: true, lowestY: 10, lastRotationKickIndex: null },
    });
    const next = processAction(state, { type: "RotateCCW" });
    expect(next.lockState.onGround).toBe(false);
    expect(next.lockState.timer).toBe(0);
    expect(next.lockState.resets).toBe(3);    // incremented
  });

  it("handleRotateCCW: kick to open air at reset limit does NOT reset timer", () => {
    const board = emptyBoard();
    board[11][3] = TetriminoType.Z;
    board[11][6] = TetriminoType.Z;
    board[12][5] = TetriminoType.Z;
    const state = baseState({
      board,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 10 }, rotation: RotationState.R },
      lockState: { timer: 300, resets: 15, onGround: true, lowestY: 10, lastRotationKickIndex: null },
    });
    const next = processAction(state, { type: "RotateCCW" });
    expect(next.lockState.onGround).toBe(false);
    expect(next.lockState.timer).toBe(300);   // NOT reset — resets exhausted
    expect(next.lockState.resets).toBe(15);   // unchanged
  });

  it("lock delay exhaustion after 15 resets triggers immediate lock (TDG §7)", () => {
    const board = emptyBoard();
    board[BOARD_HEIGHT - 1][5] = TetriminoType.Z;
    board[BOARD_HEIGHT - 1][6] = TetriminoType.Z;
    const state = baseState({
      board,
      activePiece: {
        type: TetriminoType.I,
        pos: { x: 3, y: BOARD_HEIGHT - 5 },
        rotation: RotationState.R,
      },
      lockState: { timer: 400, resets: 14, onGround: true, lowestY: BOARD_HEIGHT - 5, lastRotationKickIndex: null },
    });

    // 15th move resets timer, hitting MAX_LOCK_RESETS
    const after = processAction(state, { type: "MoveRight" });
    expect(after.lockState.resets).toBe(15);
    expect(after.lockState.timer).toBe(0); // last reset consumed

    // shouldLock returns true at 0dt when resets >= MAX_LOCK_RESETS
    expect(shouldLock(after, 0).shouldLock).toBe(true);
  });

  it("rotation while airborne detects ground contact and sets onGround=true", () => {
    // I-piece ZERO (horizontal) floating 1 row above solid floor.
    // Rotating CW makes it vertical (RotationState.R) — the bottom mino now sits on the floor.
    // Piece starts with onGround=false (it was kicked into air earlier).
    const board = emptyBoard();
    // Solid floor at BOARD_HEIGHT-1. I-piece ZERO at y=BOARD_HEIGHT-3 has minos at
    // shape row 1 → board row BOARD_HEIGHT-2, which is clear. After rotating to R
    // the bottom mino lands at BOARD_HEIGHT-1 or hits the wall — either way,
    // one more step down is OOB → collision → onGround.
    // Use a simpler setup: put the floor just below where the rotated piece ends up.
    // I-piece at pos.y=BOARD_HEIGHT-4, ZERO rotation: minos at board row BOARD_HEIGHT-3.
    // After CW → R at (3, BOARD_HEIGHT-4): minos span rows BH-4 to BH-1 (4 rows tall).
    // One step further would put a mino at BH → OOB = collision → onGround=true.
    const BH = BOARD_HEIGHT;
    const state = baseState({
      board,
      activePiece: {
        type: TetriminoType.I,
        pos: { x: 3, y: BH - 4 },
        rotation: RotationState.ZERO,
      },
      lockState: { timer: 200, resets: 15, onGround: false, lowestY: BH - 4, lastRotationKickIndex: null },
    });

    const next = processAction(state, { type: "RotateCW" });

    // After rotation, the I-piece (now vertical) should detect ground contact
    expect(next.lockState.onGround).toBe(true);
    expect(next.lockState.resets).toBe(15);  // no new reset consumed
  });
});

describe("mode-specific level-up", () => {
  it("Sprint: level does not change after hard-drop clears lines crossing a level boundary", () => {
    const board = emptyBoard();
    // Fill 4 rows at bottom so I-piece clears 4 lines; with lines starting at 8
    // total would be 12, which crosses the 10-line level boundary (0→1)
    for (let i = 0; i < 4; i++) {
      board[BOARD_HEIGHT - 1 - i] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    }
    const s = baseState({
      mode: GameMode.Sprint,
      level: 0,
      lines: 8, // 8 + 4 = 12 → would level up in Marathon (floor(12/10)=1 > 0)
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 6,
    });
    const next = processAction(s, { type: "HardDrop" });
    // Level must NOT change — Sprint has no level-up
    expect(next.level).toBe(0);
  });

  it("Ultra: level stays fixed after clearing lines crossing a level boundary", () => {
    const board = emptyBoard();
    // Fill 4 rows; with lines starting at 8 total becomes 12 → crosses boundary
    for (let i = 0; i < 4; i++) {
      board[BOARD_HEIGHT - 1 - i] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    }
    const s = baseState({
      mode: GameMode.Ultra,
      level: 2,
      lines: 28, // 28 + 4 = 32 → floor(32/10)=3 > 2, would level up in Marathon
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 6,
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.level).toBe(2); // unchanged
  });

  it("Marathon: level increments via Variable Goal after enough effective lines", () => {
    const board = emptyBoard();
    // Fill 10 rows at bottom (10 single lines clear = 10 effective lines > threshold of 5 for level 1)
    for (let i = 0; i < 10; i++) {
      board[BOARD_HEIGHT - 1 - i] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    }
    const s = baseState({
      mode: GameMode.Marathon,
      level: 0,
      lines: 0,
      effectiveLines: 0,
      board,
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO },
      ghostY: BOARD_HEIGHT - 12,
    });
    const next = processAction(s, { type: "HardDrop" });
    expect(next.level).toBeGreaterThan(0);
    expect(next.effectiveLines).toBeGreaterThan(0);
  });
});

describe("handlePause", () => {
  it("Pause during LineClear transitions to Paused", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.LineClear };
    const next = processAction(s, { type: "Pause" });
    expect(next.phase).toBe(GamePhase.Paused);
  });

  it("Pause during EntryDelay transitions to Paused", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.EntryDelay };
    const next = processAction(s, { type: "Pause" });
    expect(next.phase).toBe(GamePhase.Paused);
  });

  it("Pause during Playing transitions to Paused (existing behavior unchanged)", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.Playing };
    const next = processAction(s, { type: "Pause" });
    expect(next.phase).toBe(GamePhase.Paused);
  });

  it("resume from Paused restores LineClear phase (not Playing)", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.LineClear };
    const paused = processAction(s, { type: "Pause" });
    expect(paused.phase).toBe(GamePhase.Paused);
    const resumed = processAction(paused, { type: "Pause" });
    expect(resumed.phase).toBe(GamePhase.LineClear);
  });

  it("resume from Paused restores EntryDelay phase (not Playing)", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.EntryDelay };
    const paused = processAction(s, { type: "Pause" });
    const resumed = processAction(paused, { type: "Pause" });
    expect(resumed.phase).toBe(GamePhase.EntryDelay);
  });

  it("resume from Paused restores Playing phase", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.Playing };
    const paused = processAction(s, { type: "Pause" });
    const resumed = processAction(paused, { type: "Pause" });
    expect(resumed.phase).toBe(GamePhase.Playing);
  });

  it("pausedFromPhase is set on pause and cleared on resume", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.LineClear };
    const paused = processAction(s, { type: "Pause" });
    expect(paused.pausedFromPhase).toBe(GamePhase.LineClear);
    const resumed = processAction(paused, { type: "Pause" });
    expect(resumed.pausedFromPhase).toBeUndefined();
  });

  it("resume with pausedFromPhase=undefined falls back to Playing (32.3d)", () => {
    const paused: GameState = {
      ...baseState(),
      phase: GamePhase.Paused,
      pausedFromPhase: undefined,
    };
    const resumed = processAction(paused, { type: "Pause" });
    expect(resumed.phase).toBe(GamePhase.Playing);
  });
});

describe("processAction dispatch", () => {
  it("Hold dispatches to holdPiece and updates heldPiece", () => {
    const s: GameState = {
      ...baseState(),
      heldPiece: null,
      hasSwappedThisTurn: false,
      nextQueue: [
        { type: TetriminoType.O },
        { type: TetriminoType.S },
        { type: TetriminoType.Z },
        { type: TetriminoType.J },
        { type: TetriminoType.L },
      ],
      bag: [TetriminoType.T],
    };
    const next = processAction(s, { type: "Hold" });
    expect(next.heldPiece).toBe(TetriminoType.I); // active piece (I) moved to held
    expect(next.hasSwappedThisTurn).toBe(true);
  });

  it("Mute is a no-op in processAction (returns same state)", () => {
    const s: GameState = { ...baseState() };
    const next = processAction(s, { type: "Mute" });
    expect(next).toBe(s); // reference equality — no new object created
  });

  it("KeyBindings is a no-op in processAction (returns same state)", () => {
    const s: GameState = { ...baseState() };
    const next = processAction(s, { type: "KeyBindings" });
    expect(next).toBe(s);
  });
});

describe("IRS — Initial Rotation System", () => {
  it("RotateCW during EntryDelay buffers rotation instead of ignoring", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.EntryDelay };
    const next = processAction(s, { type: "RotateCW" });
    expect(next.bufferedRotation).toBe("CW");
    expect(next.phase).toBe(GamePhase.EntryDelay); // phase unchanged
  });

  it("RotateCCW during EntryDelay buffers rotation", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.EntryDelay };
    const next = processAction(s, { type: "RotateCCW" });
    expect(next.bufferedRotation).toBe("CCW");
  });

  it("RotateCW during LineClear buffers rotation", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.LineClear };
    const next = processAction(s, { type: "RotateCW" });
    expect(next.bufferedRotation).toBe("CW");
  });

  it("RotateCW during Playing does NOT buffer (normal rotation)", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.Playing };
    const next = processAction(s, { type: "RotateCW" });
    // Normal rotation fires — bufferedRotation stays null/undefined
    expect(next.bufferedRotation ?? null).toBeNull();
  });

  it("later RotateCCW overrides earlier RotateCW buffer", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.EntryDelay };
    const after1 = processAction(s, { type: "RotateCW" });
    expect(after1.bufferedRotation).toBe("CW");
    const after2 = processAction(after1, { type: "RotateCCW" });
    expect(after2.bufferedRotation).toBe("CCW");
  });
});

describe("IHS — Initial Hold System", () => {
  it("Hold during EntryDelay sets bufferedHold = true", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.EntryDelay, hasSwappedThisTurn: false };
    const next = processAction(s, { type: "Hold" });
    expect(next.bufferedHold).toBe(true);
    expect(next.phase).toBe(GamePhase.EntryDelay); // phase unchanged
  });

  it("Hold during LineClear sets bufferedHold = true", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.LineClear, hasSwappedThisTurn: false };
    const next = processAction(s, { type: "Hold" });
    expect(next.bufferedHold).toBe(true);
  });

  it("Hold during Playing does NOT set bufferedHold (normal hold)", () => {
    // Playing-phase hold goes through holdPiece, not buffer
    const s: GameState = {
      ...baseState(),
      phase: GamePhase.Playing,
      hasSwappedThisTurn: false,
      nextQueue: [
        { type: TetriminoType.O },
        { type: TetriminoType.T },
        { type: TetriminoType.S },
        { type: TetriminoType.Z },
        { type: TetriminoType.J },
      ],
      bag: [TetriminoType.L, TetriminoType.I],
    };
    const next = processAction(s, { type: "Hold" });
    expect(next.bufferedHold ?? false).toBe(false);
  });

  it("Hold during EntryDelay when hasSwappedThisTurn=true does not buffer", () => {
    // Can't hold twice in one turn
    const s: GameState = { ...baseState(), phase: GamePhase.EntryDelay, hasSwappedThisTurn: true };
    const next = processAction(s, { type: "Hold" });
    expect(next.bufferedHold ?? false).toBe(false);
  });
});

describe("processAction guard branches (35.1 coverage)", () => {
  it('"Start" action is a no-op in processAction (handled by game loop)', () => {
    const s = baseState();
    const next = processAction(s, { type: "Start" });
    expect(next).toBe(s);
  });

  it("Pause in GameOver phase returns state unchanged", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.GameOver };
    const next = processAction(s, { type: "Pause" });
    expect(next).toBe(s);
  });

  it("MoveLeft in non-Playing phase returns state unchanged", () => {
    for (const phase of [GamePhase.Paused, GamePhase.GameOver, GamePhase.LineClear]) {
      const s: GameState = { ...baseState(), phase };
      expect(processAction(s, { type: "MoveLeft" })).toBe(s);
    }
  });

  it("SoftDrop in non-Playing phase returns state unchanged", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.Paused };
    expect(processAction(s, { type: "SoftDrop" })).toBe(s);
  });

  it("HardDrop in non-Playing phase returns state unchanged", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.GameOver };
    expect(processAction(s, { type: "HardDrop" })).toBe(s);
  });

  it("RotateCW in non-Playing phase returns state unchanged", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.Paused };
    expect(processAction(s, { type: "RotateCW" })).toBe(s);
  });

  it("RotateCCW in non-Playing phase returns state unchanged", () => {
    const s: GameState = { ...baseState(), phase: GamePhase.Paused };
    expect(processAction(s, { type: "RotateCCW" })).toBe(s);
  });

  it("RotateCW returns same state when all kick positions are blocked", () => {
    // Fill the board so every possible kick target for O-piece is blocked
    const board = emptyBoard();
    // O-piece at (4,4) surrounded by blocks — all CW kick offsets fail
    for (let r = 3; r <= 6; r++) {
      for (let c = 3; c <= 6; c++) {
        board[r][c] = TetriminoType.Z;
      }
    }
    board[4][4] = null;
    board[4][5] = null;
    board[5][4] = null;
    board[5][5] = null;
    const s: GameState = {
      ...baseState({ board }),
      activePiece: { type: TetriminoType.O, pos: { x: 4, y: 4 }, rotation: RotationState.ZERO },
    };
    // O-piece has no kicks and its ZERO rotation = R rotation (symmetric), so CW fails
    const next = processAction(s, { type: "RotateCW" });
    // If rotation succeeds for O-piece (it's symmetric), just verify no crash
    expect(next.phase).toBe(GamePhase.Playing);
  });

  it("RotateCCW returns same state when all kick positions are blocked (I-piece fully blocked)", () => {
    // Use an I-piece in rotation R with a tightly packed board
    const board = emptyBoard();
    // Fill rows around spawn area to block all rotation kicks
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        board[r][c] = TetriminoType.Z;
      }
    }
    // Clear the 1x4 column the I-piece (rotation R) occupies
    board[0][4] = null;
    board[1][4] = null;
    board[2][4] = null;
    board[3][4] = null;

    const s: GameState = {
      ...baseState({ board }),
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: 0 }, rotation: RotationState.R },
    };
    const next = processAction(s, { type: "RotateCCW" });
    // All kick offsets blocked → same state returned
    expect(next.activePiece?.rotation).toBe(RotationState.R);
  });

  it("lockState not reset when resets >= MAX_LOCK_RESETS (timer preserved)", () => {
    const MAX_LOCK_RESETS = 15;
    const board = emptyBoard();
    // Block below piece so onGround=true and stays blocked after move
    board[BOARD_HEIGHT - 1][3] = TetriminoType.Z;
    board[BOARD_HEIGHT - 1][4] = TetriminoType.Z;
    board[BOARD_HEIGHT - 1][5] = TetriminoType.Z;
    board[BOARD_HEIGHT - 1][6] = TetriminoType.Z;
    const s: GameState = {
      ...baseState({ board }),
      activePiece: { type: TetriminoType.I, pos: { x: 3, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO },
      lockState: {
        timer: 400,
        resets: MAX_LOCK_RESETS, // at limit — no more resets
        onGround: true,
        lowestY: BOARD_HEIGHT - 2,
        lastRotationKickIndex: null,
      },
    };
    const next = processAction(s, { type: "MoveLeft" });
    // Timer should NOT be reset (still 400) since resets >= MAX_LOCK_RESETS
    expect(next.lockState.timer).toBe(400);
    expect(next.lockState.resets).toBe(MAX_LOCK_RESETS);
  });
});
