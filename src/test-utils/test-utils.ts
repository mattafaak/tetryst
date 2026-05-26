import {
  type GameState,
  GamePhase,
  GameMode,
} from "../core/types.ts";
import { createBoard } from "../core/board.ts";
import { resetLockState } from "../core/lock-delay.ts";

/**
 * Create a minimal GameState for testing, with sensible defaults.
 * Override any field via the partial.
 */
export function baseState(overrides?: Partial<GameState>): GameState {
  return {
    board: createBoard(),
    activePiece: null,
    ghostY: 0,
    heldPiece: null,
    hasSwappedThisTurn: false,
    nextQueue: [],
    score: 0,
    level: 0,
    lines: 0,
    effectiveLines: 0,
    combo: 0,
    backToBack: false,
    phase: GamePhase.Menu,
    gravityTimer: 0,
    lockState: resetLockState(),
    entryDelayTimer: 0,
    bag: [],
    lineClearTimer: 0,
    clearedRowIndices: [],
    mode: GameMode.Marathon,
    modeTimer: 0,
    popups: [],
    ...overrides,
  };
}
