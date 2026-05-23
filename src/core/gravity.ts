import { type GameState, type Piece, type Board } from "./types.ts";
import { updateLowestY } from "./lock-delay.ts";
import {
  GRAVITY_SPEED_CURVE,
  PIECE_SHAPES,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from "./constants.ts";

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
 * Check whether a piece at its current position collides with the board
 * boundaries or any occupied cell. Cells above the visible area (y < 0)
 * are treated as empty.
 */
function checkCollision(board: Board, piece: Piece): boolean {
  const shape = PIECE_SHAPES[piece.type][piece.rotation];
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        const bx = piece.pos.x + col;
        const by = piece.pos.y + row;
        if (bx < 0 || bx >= BOARD_WIDTH || by >= BOARD_HEIGHT) {
          return true;
        }
        if (by >= 0 && board[by][bx] !== null) {
          return true;
        }
      }
    }
  }
  return false;
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
  if (state.activePiece === null) {
    return { state, dropped: false };
  }

  const delay = getGravityDelay(state.level);
  let timer = state.gravityTimer + dt;
  let currentPiece: Piece = {
    ...state.activePiece,
    pos: { ...state.activePiece.pos },
  };
  let dropped = false;
  let onGround = state.lockState.onGround;

  while (timer >= delay) {
    timer -= delay;

    const moved: Piece = {
      ...currentPiece,
      pos: {
        x: currentPiece.pos.x,
        y: currentPiece.pos.y + 1,
      },
    };

    if (checkCollision(state.board, moved)) {
      onGround = true;
      break;
    }

    currentPiece = moved;
    dropped = true;
    onGround = false;
  }

  let finalState: GameState = {
    ...state,
    gravityTimer: timer,
    activePiece: currentPiece,
    lockState: {
      ...state.lockState,
      onGround,
    },
  };

  if (dropped) {
    finalState = updateLowestY(finalState, currentPiece.pos.y);
  }

  return { state: finalState, dropped };
}
