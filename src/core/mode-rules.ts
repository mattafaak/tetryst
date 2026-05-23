import { type GameState, GameMode } from "./types.ts";
import { MARATHON_MAX_LEVEL, SPRINT_LINE_TARGET } from "./constants.ts";

export function checkModeVictory(state: GameState): boolean {
  switch (state.mode) {
    case GameMode.Marathon:
      return state.level >= MARATHON_MAX_LEVEL;
    case GameMode.Sprint:
      return state.lines >= SPRINT_LINE_TARGET;
    case GameMode.Ultra:
      return state.modeTimer <= 0;
    default:
      return false;
  }
}
