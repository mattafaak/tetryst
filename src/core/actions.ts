import {
  type GameState,
  type InputAction,
  GamePhase,
} from "./types.ts";
import { tryRotateCW, tryRotateCCW, movePiece, getGhostY } from "./pieces.ts";
import { checkCollision, lockPiece, isLockOut } from "./board.ts";
import { addHardDropScore } from "./scoring.ts";
import { executeLock } from "./lock.ts";
import { holdPiece } from "./state.ts";
import { resetLockState, updateLowestY } from "./lock-delay.ts";
import { MAX_LOCK_RESETS, SOFT_DROP_SCORE } from "./constants.ts";
import { batchPushPopups } from "./popups.ts";
import type { LockState, Piece } from "./types.ts";

export function processAction(
  state: GameState,
  action: InputAction
): GameState {
  switch (action.type) {
    case "Start":
      return state; // handled by game loop before processAction
    case "Pause":
      return handlePause(state);
    case "MoveLeft":
      return handleMove(state, -1, 0);
    case "MoveRight":
      return handleMove(state, 1, 0);
    case "SoftDrop":
      return handleSoftDrop(state);
    case "HardDrop":
      return handleHardDrop(state);
    case "RotateCW":
      if (state.phase === GamePhase.EntryDelay || state.phase === GamePhase.LineClear) {
        return { ...state, bufferedRotation: "CW" };
      }
      return handleRotateCW(state);
    case "RotateCCW":
      if (state.phase === GamePhase.EntryDelay || state.phase === GamePhase.LineClear) {
        return { ...state, bufferedRotation: "CCW" };
      }
      return handleRotateCCW(state);
    case "Hold":
      if (
        (state.phase === GamePhase.EntryDelay || state.phase === GamePhase.LineClear) &&
        !state.hasSwappedThisTurn
      ) {
        return { ...state, bufferedHold: true };
      }
      return handleHold(state);
    case "Mute":
      return state;
    case "KeyBindings":
      return state;
  }
}

function handlePause(state: GameState): GameState {
  if (
    state.phase === GamePhase.Playing ||
    state.phase === GamePhase.LineClear ||
    state.phase === GamePhase.EntryDelay
  ) {
    return { ...state, phase: GamePhase.Paused, pausedFromPhase: state.phase };
  }
  if (state.phase === GamePhase.Paused) {
    return {
      ...state,
      phase: state.pausedFromPhase ?? GamePhase.Playing,
      pausedFromPhase: undefined,
    };
  }
  return state;
}

/**
 * Shared lock-delay reset logic for horizontal moves and rotations.
 * Replaces 3 near-identical implementations (handleMove, handleRotateCW, handleRotateCCW).
 */
function updateLockStateAfterMove(
  state: GameState,
  newPiece: Piece,
): LockState {
  const below = movePiece(newPiece, 0, 1);
  if (state.lockState.onGround) {
    if (checkCollision(state.board, below)) {
      if (state.lockState.resets < MAX_LOCK_RESETS) {
        return { ...state.lockState, timer: 0, resets: state.lockState.resets + 1 };
      }
      return { ...state.lockState };
    }
    const canReset = state.lockState.resets < MAX_LOCK_RESETS;
    return {
      ...state.lockState,
      onGround: false,
      ...(canReset ? { timer: 0, resets: state.lockState.resets + 1 } : {}),
    };
  }
  if (checkCollision(state.board, below)) {
    return { ...state.lockState, onGround: true };
  }
  return state.lockState;
}

function handleMove(
  state: GameState,
  dx: number,
  dy: number
): GameState {
  if (
    state.phase !== GamePhase.Playing ||
    state.activePiece === null
  ) {
    return state;
  }

  const moved = movePiece(state.activePiece, dx, dy);
  if (checkCollision(state.board, moved)) {
    return state;
  }

  const newState = { ...state, activePiece: moved };
  newState.ghostY = getGhostY(newState.board, moved);

  // If piece is on ground and moving horizontally, update lock state
  if (dy === 0) {
    newState.lockState = updateLockStateAfterMove(state, moved);
  }

  return newState;
}

function handleSoftDrop(state: GameState): GameState {
  if (
    state.phase !== GamePhase.Playing ||
    state.activePiece === null
  ) {
    return state;
  }

  const moved = movePiece(state.activePiece, 0, 1);
  if (checkCollision(state.board, moved)) {
    return state;
  }

  const newState = { ...state, activePiece: moved };
  newState.ghostY = getGhostY(newState.board, moved);
  newState.score = state.score + SOFT_DROP_SCORE;

  // Recompute onGround — stale-true (from a rotation kick) would cause premature locking.
  // Per TDG §7, soft drop does NOT reset the lock delay timer — only horizontal
  // moves and rotations do (via updateLockStateAfterMove).
  const belowMoved = movePiece(moved, 0, 1);
  const nowOnGround = checkCollision(state.board, belowMoved);
  newState.lockState = { ...state.lockState, onGround: nowOnGround };
  newState.gravityTimer = 0;

  return updateLowestY(newState, moved.pos.y);
}

function handleHardDrop(state: GameState): GameState {
  if (state.phase !== GamePhase.Playing || state.activePiece === null) {
    return state;
  }

  let dropped = state.activePiece;
  let rows = 0;
  while (true) {
    const next = movePiece(dropped, 0, 1);
    if (checkCollision(state.board, next)) break;
    dropped = next;
    rows++;
  }

  // Lock-Out: piece locked entirely in buffer zone (TDG §8)
  if (isLockOut(dropped)) {
    return {
      ...state,
      activePiece: null,
      phase: GamePhase.GameOver,
      lockState: resetLockState(),
      lastLockResult: undefined,
    };
  }

  // Lock piece onto board and apply hard-drop score
  let nextState: GameState = {
    ...state,
    board: lockPiece(state.board, dropped),
    activePiece: null,
    score: state.score + addHardDropScore(rows),
    ghostY: dropped.pos.y,
    lockState: resetLockState(),
  };

  // Shared scoring/lock logic — handles T-spin, line clear, combo, B2B, phase
  const result = executeLock(nextState, dropped);
  nextState = result.state;

  // Apply action popups (batched — single state spread instead of N)
  if (result.popupInfo.length > 0) {
    nextState = batchPushPopups(nextState, result.popupInfo);
  }

  return nextState;
}

function handleRotateCW(state: GameState): GameState {
  if (
    state.phase !== GamePhase.Playing ||
    state.activePiece === null
  ) {
    return state;
  }

  const result = tryRotateCW(state.activePiece, state.board);
  if (result === null) return state;

  const newState = { ...state, activePiece: result.piece };
  newState.ghostY = getGhostY(newState.board, result.piece);

  // Recheck groundedness after rotation — kicks can move the piece on or off the ground
  const newLockState = updateLockStateAfterMove(state, result.piece);
  newState.lockState = { ...newLockState, lastRotationKickIndex: result.kickIndex };

  return newState;
}

function handleRotateCCW(state: GameState): GameState {
  if (
    state.phase !== GamePhase.Playing ||
    state.activePiece === null
  ) {
    return state;
  }

  const result = tryRotateCCW(state.activePiece, state.board);
  if (result === null) return state;

  const newState = { ...state, activePiece: result.piece };
  newState.ghostY = getGhostY(newState.board, result.piece);

  // Recheck groundedness after rotation — kicks can move the piece on or off the ground
  const newLockState = updateLockStateAfterMove(state, result.piece);
  newState.lockState = { ...newLockState, lastRotationKickIndex: result.kickIndex };

  return newState;
}

function handleHold(state: GameState): GameState {
  return holdPiece(state);
}

