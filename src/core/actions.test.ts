import { describe, it, expect } from "vitest";
import { processAction } from "./actions.ts";
import { GamePhase, TetriminoType, RotationState , GameMode } from "./types.ts";
import type { GameState } from "./types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT } from "./constants.ts";
import { checkModeVictory } from "./mode-rules.ts";

function emptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<string | null>(BOARD_WIDTH).fill(null),
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
    combo: -1,
    backToBack: false,
    phase: GamePhase.Playing,
    gravityTimer: 0,
    lockState: { timer: 0, resets: 5, onGround: false, lowestY: 20 },
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
      lockState: { timer: 300, resets: 0, onGround: true, lowestY: BOARD_HEIGHT - 5 },
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
      lockState: { timer: 300, resets: 0, onGround: true, lowestY: BOARD_HEIGHT - 5 },
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
      lockState: { timer: 300, resets: 2, onGround: true, lowestY: 10 },
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
      lockState: { timer: 400, resets: 1, onGround: true, lowestY: BH - 2 },
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
      lockState: { timer: 200, resets: 10, onGround: false, lowestY: 20 },
      activePiece: makePiece(20),
    });
    const next = processAction(state, { type: "SoftDrop" });
    expect(next.activePiece?.pos.y).toBe(21);
    expect(next.lockState.lowestY).toBe(21);
    expect(next.lockState.resets).toBe(0);
    expect(next.lockState.timer).toBe(0); // timer resets on descent to new lowest row
    expect(next.score).toBe(1); // 1 point per cell soft-dropped
  });

  it("clears stale onGround=true when piece can still fall after soft drop", () => {
    // Artificially stale state: piece is mid-air but onGround=true (e.g., from rotation kick)
    const state = baseState({
      activePiece: makePiece(20),  // I-piece, lots of room to fall
      lockState: { timer: 400, resets: 3, onGround: true, lowestY: 20 },
    });

    const next = processAction(state, { type: "SoftDrop" });

    expect(next.activePiece?.pos.y).toBe(21);
    expect(next.lockState.onGround).toBe(false);  // can still fall → not on ground
    expect(next.lockState.timer).toBe(0);
  });

  it("sets onGround=true immediately when soft drop lands piece on solid", () => {
    const board = emptyBoard();
    // I-piece ZERO minos sit at row pos.y+1. Soft drop succeeds (y=20→21, minos row 22 clear).
    // At y=21 minos are at row 22; moving further puts them at row 23 — solid → lands.
    board[23] = Array(BOARD_WIDTH).fill(TetriminoType.Z);
    const state = baseState({
      board,
      activePiece: makePiece(20),
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 20 },
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
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 18 },
    });
    const next = processAction(state, { type: "HardDrop" });
    expect(next.phase).toBe(GamePhase.GameOver);
    expect(next.activePiece).toBeNull();
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
      lockState: { timer: 300, resets: 0, onGround: true, lowestY: BOARD_HEIGHT - 5 },
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
      lockState: { timer: 300, resets: 15, onGround: true, lowestY: BOARD_HEIGHT - 5 },
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
      lockState: { timer: 300, resets: 2, onGround: true, lowestY: 10 },
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
      lockState: { timer: 300, resets: 15, onGround: true, lowestY: 10 },
    });
    const next = processAction(state, { type: "RotateCCW" });
    expect(next.lockState.onGround).toBe(false);
    expect(next.lockState.timer).toBe(300);   // NOT reset — resets exhausted
    expect(next.lockState.resets).toBe(15);   // unchanged
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
