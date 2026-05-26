import { type GameState } from "./types.ts";
import { updateLowestY } from "./lock-delay.ts";
import { PIECE_SHAPES, GRAVITY_SPEED_CURVE, BOARD_WIDTH, BOARD_HEIGHT } from "./constants.ts";

/**
 * Return the gravity delay in milliseconds for the given level.
 * For levels beyond the table, returns the last value.
 */
export function getGravityDelay(level: number): number {
  if (level < GRAVITY_SPEED_CURVE.length) {
    return GRAVITY_SPEED_CURVE[level];
  }
  return GRAVITY_SPEED_CURVE[GRAVITY_SPEED_CURVE.length - 1];
}

/**
 * Apply gravity to the active piece.
 *
 * Accumulates dt into the gravity timer. When the timer reaches or exceeds
 * the gravity delay for the current level, the piece drops one row. If the
 * piece cannot move down, lockState.onGround is set to true.
 *
 * Returns the new game state and whether any rows were dropped.
 */
export function applyGravity(
  state: GameState,
  dt: number,
): { state: GameState; dropped: boolean } {
  const activePiece = state.activePiece;
  if (activePiece === null) {
    return { state, dropped: false };
  }

  const delay = getGravityDelay(state.level);
  let timer = state.gravityTimer + dt;
  let pieceY = activePiece.pos.y;
  let dropped = false;
  let onGround = state.lockState.onGround;

  // Inline collision check against the piece's shape at a target Y to avoid
  // allocating Piece objects per drop tick on the hot path.
  function wouldCollide(y: number): boolean {
    const p = activePiece!;
    const shape = PIECE_SHAPES[p.type][p.rotation];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const bx = p.pos.x + c;
        const by = y + r;
        if (bx < 0 || bx >= BOARD_WIDTH || by >= BOARD_HEIGHT) return true;
        if (by >= 0 && state.board[by][bx] !== null) return true;
      }
    }
    return false;
  }

  while (timer >= delay) {
    timer -= delay;

    if (wouldCollide(pieceY + 1)) {
      onGround = true;
      break;
    }

    pieceY++;
    dropped = true;
    onGround = false;
  }

  let finalState: GameState = {
    ...state,
    gravityTimer: timer,
    activePiece: { ...activePiece, pos: { x: activePiece.pos.x, y: pieceY } },
    lockState: {
      ...state.lockState,
      onGround,
    },
  };

  if (dropped) {
    finalState = updateLowestY(finalState, pieceY);
  }

  return { state: finalState, dropped };
}
