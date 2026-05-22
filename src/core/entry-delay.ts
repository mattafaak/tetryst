import { type GameState, GamePhase } from "./types.ts";
import { ENTRY_DELAY } from "./constants.ts";

export function onPieceLocked(state: GameState): GameState {
  return {
    ...state,
    phase: GamePhase.EntryDelay,
    entryDelayTimer: 0,
    activePiece: null,
  };
}

export function updateEntryDelay(
  state: GameState,
  dt: number
): { state: GameState; ready: boolean } {
  if (state.phase !== GamePhase.EntryDelay) {
    return { state, ready: false };
  }

  const newTimer = state.entryDelayTimer + dt;
  const newState: GameState = {
    ...state,
    entryDelayTimer: newTimer,
  };

  if (newTimer >= ENTRY_DELAY) {
    return { state: { ...newState, phase: GamePhase.Playing }, ready: true };
  }

  return { state: newState, ready: false };
}
