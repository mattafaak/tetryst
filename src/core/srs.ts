import { RotationState } from "./types.ts";

const ROTATION_ORDER = [
  RotationState.ZERO,
  RotationState.R,
  RotationState.TWO,
  RotationState.L,
];

export function rotateCW(
  current: RotationState
): RotationState {
  const idx = ROTATION_ORDER.indexOf(current);
  return ROTATION_ORDER[(idx + 1) % 4];
}

export function rotateCCW(
  current: RotationState
): RotationState {
  const idx = ROTATION_ORDER.indexOf(current);
  return ROTATION_ORDER[(idx + 3) % 4];
}
