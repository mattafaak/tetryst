import { type GameState, type LockState, GamePhase } from "./types.ts";
import { LOCK_DELAY, MAX_LOCK_RESETS } from "./constants.ts";

export function shouldLock(
  state: GameState,
  dt: number
): { state: GameState; shouldLock: boolean } {
  if (
    state.phase !== GamePhase.Playing ||
    !state.lockState.onGround
  ) {
    return { state, shouldLock: false };
  }

  // Reset budget exhausted — lock immediately, ignoring timer (TDG §7)
  if (state.lockState.resets >= MAX_LOCK_RESETS) {
    return { state, shouldLock: true };
  }

  const newState: GameState = {
    ...state,
    lockState: {
      ...state.lockState,
      timer: state.lockState.timer + dt,
    },
  };

  if (newState.lockState.timer >= LOCK_DELAY) {
    return { state: newState, shouldLock: true };
  }

  return { state: newState, shouldLock: false };
}

export function resetLockTimer(state: GameState): GameState {
  if (state.lockState.resets >= MAX_LOCK_RESETS) {
    return state;
  }

  return {
    ...state,
    lockState: {
      ...state.lockState,
      timer: 0,
      resets: state.lockState.resets + 1,
    },
  };
}

export function onPieceLanded(state: GameState): GameState {
  return {
    ...state,
    lockState: {
      timer: 0,
      resets: state.lockState.resets,
      onGround: true,
      lowestY: state.lockState.lowestY,
    },
  };
}

export function resetLockState(): LockState {
  return {
    timer: 0,
    resets: 0,
    onGround: false,
    lowestY: -1,
  };
}

/**
 * Call whenever a piece moves to a new y position (via gravity).
 * If the piece descended past its previous lowest y, reset the resets counter (TDG Extended Placement).
 */
export function updateLowestY(state: GameState, newY: number): GameState {
  if (newY > state.lockState.lowestY) {
    return {
      ...state,
      lockState: {
        ...state.lockState,
        lowestY: newY,
        resets: 0,
      },
    };
  }
  return state;
}
