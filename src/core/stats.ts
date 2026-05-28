import type { GameState } from "./types.ts";
import { GameMode } from "./types.ts";
import { ULTRA_DURATION_MS } from "./constants.ts";

export interface GameStats {
  pps: number;
  kpp: number;
  finesseFaults: number;
}

export function computeGameStats(state: GameState): GameStats {
  // Ultra timer counts DOWN from ULTRA_DURATION_MS; all other modes count up.
  const elapsedMs = state.mode === GameMode.Ultra
    ? ULTRA_DURATION_MS - state.modeTimer
    : state.modeTimer;
  const elapsedSeconds = elapsedMs / 1000;
  const pps =
    elapsedSeconds > 0 && state.piecesPlaced > 0
      ? state.piecesPlaced / elapsedSeconds
      : 0;

  const kpp =
    state.piecesPlaced > 0 ? state.totalKeypresses / state.piecesPlaced : 0;

  return { pps, kpp, finesseFaults: state.finesseFaults };
}
