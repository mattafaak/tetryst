import { type GameState, type PopupItem } from "./types.ts";

const POPUP_DURATION = 1200;

export function pushPopup(
  state: GameState,
  text: string,
  color: string,
): GameState {
  const item: PopupItem = { text, timer: 0, duration: POPUP_DURATION, color };
  return { ...state, popups: [...state.popups, item] };
}

export function batchPushPopups(
  state: GameState,
  popupInfos: Array<{ text: string; color: string }>,
): GameState {
  if (popupInfos.length === 0) return state;
  const items: PopupItem[] = popupInfos.map((p) => ({
    text: p.text,
    timer: 0,
    duration: POPUP_DURATION,
    color: p.color,
  }));
  return { ...state, popups: [...state.popups, ...items] };
}

export function tickPopups(state: GameState, dt: number): GameState {
  const next: PopupItem[] = [];
  for (const p of state.popups) {
    const t = p.timer + dt;
    if (t < p.duration) next.push({ ...p, timer: t });
  }
  return { ...state, popups: next };
}
