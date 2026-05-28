import type { GameState } from "./types.ts";

export interface GameStats {
  pps: number;
  kpp: number;
  finesseFaults: number;
}

export function computeGameStats(state: GameState): GameStats {
  const elapsedSeconds = state.modeTimer / 1000;
  const pps =
    elapsedSeconds > 0 && state.piecesPlaced > 0
      ? state.piecesPlaced / elapsedSeconds
      : 0;

  const kpp =
    state.piecesPlaced > 0 ? state.totalKeypresses / state.piecesPlaced : 0;

  return { pps, kpp, finesseFaults: state.finesseFaults };
}
