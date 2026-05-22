import { type GameState } from "./types.ts";
import { COMBO_BASE } from "./constants.ts";

export function updateCombo(
  state: GameState,
  linesCleared: number,
): { state: GameState; bonusScore: number } {
  if (linesCleared > 0) {
    const newCombo = state.combo + 1;
    const bonusScore = COMBO_BASE * newCombo * state.level;
    return {
      state: { ...state, combo: newCombo },
      bonusScore,
    };
  }

  return {
    state: { ...state, combo: -1 },
    bonusScore: 0,
  };
}
