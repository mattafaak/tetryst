import { describe, it, expect } from "vitest";
import { getGravityDelay, applyGravity } from "./gravity.ts";
import {
  TetriminoType,
  RotationState,
  type GameState,
  GamePhase,
  GameMode,
  type Piece,
  type Board,
} from "./types.ts";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants.ts";

function emptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<string | null>(BOARD_WIDTH).fill(null),
  );
}

function makeState(
  opts: {
    piece?: Piece | null;
    level?: number;
    gravityTimer?: number;
  } = {},
): GameState {
  const piece =
    opts.piece === undefined
      ? ({
          type: TetriminoType.T,
          pos: { x: 3, y: 0 },
          rotation: RotationState.ZERO,
        } as Piece)
      : opts.piece;

  return {
    board: emptyBoard(),
    activePiece: piece,
    ghostY: 0,
    heldPiece: null,
    hasSwappedThisTurn: false,
    nextQueue: [],
    score: 0,
    level: opts.level ?? 0,
    lines: 0,
    effectiveLines: 0,
    combo: 0,
    backToBack: false,
    phase: GamePhase.Playing,
    gravityTimer: opts.gravityTimer ?? 0,
    lockState: { timer: 0, resets: 0, onGround: false, lowestY: -1 },
    entryDelayTimer: 0,
    bag: [],
    lineClearTimer: 0,
    clearedRowIndices: [],
    lastClearWasB2B: false,
    mode: GameMode.Marathon,
    modeTimer: 0,
    popups: [],
  };
}

// ---------------------------------------------------------------------------
// getGravityDelay
// ---------------------------------------------------------------------------

describe("getGravityDelay", () => {
  it("returns correct values for levels 0-15+", () => {
    expect(getGravityDelay(0)).toBe(1000);
    expect(getGravityDelay(1)).toBe(793);
    expect(getGravityDelay(5)).toBe(262);
    expect(getGravityDelay(9)).toBe(64);
    expect(getGravityDelay(10)).toBe(43);
    expect(getGravityDelay(15)).toBe(5);
  });

  it("returns last value for levels beyond the table", () => {
    expect(getGravityDelay(16)).toBe(5);
    expect(getGravityDelay(20)).toBe(5);
    expect(getGravityDelay(100)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// applyGravity
// ---------------------------------------------------------------------------

describe("applyGravity", () => {
  it("no-ops with no active piece", () => {
    const state = makeState({ piece: null });
    const result = applyGravity(state, 100);
    expect(result.dropped).toBe(false);
    expect(result.state).toBe(state);
  });

  it("accumulates dt into gravityTimer without dropping", () => {
    const state = makeState({ gravityTimer: 0 });
    const result = applyGravity(state, 500);
    expect(result.state.gravityTimer).toBe(500);
    expect(result.dropped).toBe(false);
    expect(result.state.activePiece!.pos.y).toBe(0); // unchanged
  });

  it("drops the piece when timer reaches the delay threshold", () => {
    const state = makeState({ gravityTimer: 800 });
    const result = applyGravity(state, 300);
    // 800 + 300 = 1100 >= 1000 => drop
    // timer = 1100 - 1000 = 100
    expect(result.dropped).toBe(true);
    expect(result.state.activePiece!.pos.y).toBe(1);
    expect(result.state.gravityTimer).toBe(100);
  });

  it("drops multiple rows when dt exceeds the delay by more than 2x", () => {
    const state = makeState({ gravityTimer: 0 });
    const result = applyGravity(state, 2500);
    // 2500 >= 1000 => drop 1: timer=1500, y=1
    // 1500 >= 1000 => drop 2: timer=500, y=2
    // 500 < 1000 => stop
    expect(result.dropped).toBe(true);
    expect(result.state.activePiece!.pos.y).toBe(2);
    expect(result.state.gravityTimer).toBe(500);
  });

  it("sets onGround when piece cannot move down further", () => {
    // Place piece at the very bottom. A T-piece rotation 0 has filled cells
    // at row 0 col 1 and row 1 cols 0,1,2.  Max board y = 39.
    // At pos.y = 38: row 1 cells at board y = 39 => OK.
    // At pos.y = 39: row 1 cells at board y = 40 => OOB collision.
    const pieceAtFloor: Piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: BOARD_HEIGHT - 2 },
      rotation: RotationState.ZERO,
    };
    const state = makeState({ piece: pieceAtFloor, gravityTimer: 900 });
    const result = applyGravity(state, 200);

    // 900 + 200 = 1100 >= 1000 => try to drop, but can't => onGround = true
    expect(result.dropped).toBe(false);
    expect(result.state.activePiece!.pos.y).toBe(BOARD_HEIGHT - 2); // unchanged
    expect(result.state.lockState.onGround).toBe(true);
    expect(result.state.gravityTimer).toBe(100);
  });

  it("is pure: does not mutate the input state", () => {
    const state = makeState();
    const originalY = state.activePiece!.pos.y;
    applyGravity(state, 500);
    expect(state.activePiece!.pos.y).toBe(originalY);
    expect(state.gravityTimer).toBe(0);
  });

  it("drops faster at higher levels with shorter delay", () => {
    // At level 9, delay = 64 ms.  At level 0, delay = 1000 ms.
    // dt = 256 ms should produce 4 drops at level 9 but 0 drops at level 0.
    const fast = makeState({ level: 9, gravityTimer: 0 });
    const slow = makeState({ level: 0, gravityTimer: 0 });
    const fastResult = applyGravity(fast, 256);
    const slowResult = applyGravity(slow, 256);

    expect(fastResult.dropped).toBe(true);
    expect(fastResult.state.activePiece!.pos.y).toBe(4);
    expect(fastResult.state.gravityTimer).toBe(0); // 256 - 64*4 = 0

    expect(slowResult.dropped).toBe(false);
    expect(slowResult.state.activePiece!.pos.y).toBe(0);
    expect(slowResult.state.gravityTimer).toBe(256);
  });

  it("preserves lock state when piece is already on ground and at floor", () => {
    const pieceAtFloor: Piece = {
      type: TetriminoType.T,
      pos: { x: 3, y: BOARD_HEIGHT - 2 },
      rotation: RotationState.ZERO,
    };
    const state = makeState({ piece: pieceAtFloor, gravityTimer: 0 });
    const stateOnGround: GameState = {
      ...state,
      lockState: { timer: 400, resets: 5, onGround: true, lowestY: -1 },
    };
    const result = applyGravity(stateOnGround, 3000);

    // One drop attempt is made (consumes 1000 ms), hits floor, onGround stays true
    expect(result.dropped).toBe(false);
    expect(result.state.activePiece!.pos.y).toBe(BOARD_HEIGHT - 2);
    expect(result.state.lockState.onGround).toBe(true);
    // Lock delay timer and reset count are preserved through the spread
    expect(result.state.lockState.timer).toBe(400);
    expect(result.state.lockState.resets).toBe(5);
    // Gravity timer wraps: 3000 - 1000 = 2000 (one failed attempt)
    expect(result.state.gravityTimer).toBe(2000);
  });

  it("clears onGround when gravity drops a piece that was stale-marked as onGround", () => {
    // Piece starts with onGround=true (stale — e.g., slid into a gap) but CAN fall.
    // After gravity fires and drops the piece, onGround must become false.
    const state = makeState({ piece: { type: TetriminoType.T, pos: { x: 3, y: 0 }, rotation: RotationState.ZERO }, gravityTimer: 0 });
    const staleOnGround: GameState = {
      ...state,
      lockState: { timer: 400, resets: 3, onGround: true, lowestY: 0 },
    };

    const result = applyGravity(staleOnGround, 1100);

    expect(result.dropped).toBe(true);
    expect(result.state.activePiece!.pos.y).toBe(1);
    expect(result.state.lockState.onGround).toBe(false);
  });

  it("processes very large dt dropping piece all the way to the floor", () => {
    // T-piece starts at y = 0.  A huge dt should cause it to fall until
    // it reaches the lowest valid row (BOARD_HEIGHT - 2).
    const state = makeState({ gravityTimer: 0 });
    const result = applyGravity(state, 100000);

    expect(result.dropped).toBe(true);
    expect(result.state.activePiece!.pos.y).toBe(BOARD_HEIGHT - 2);
    expect(result.state.lockState.onGround).toBe(true);
  });
});
