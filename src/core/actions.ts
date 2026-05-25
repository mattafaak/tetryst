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
import { updateLowestY } from "./lock-delay.ts";
import { MAX_LOCK_RESETS } from "./constants.ts";
import { pushPopup } from "../render/popups.ts";

export function processAction(
  state: GameState,
  action: InputAction
): GameState {
  switch (action.type) {
    case "Start":
      return handleStart(state);
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
      return handleRotateCW(state);
    case "RotateCCW":
      return handleRotateCCW(state);
    case "Hold":
      return handleHold(state);
    case "Mute":
      return state;
  }
}

function handleStart(state: GameState): GameState {
  if (state.phase === GamePhase.Menu || state.phase === GamePhase.GameOver) {
    return { ...state, phase: GamePhase.Playing };
  }
  return state;
}

function handlePause(state: GameState): GameState {
  if (state.phase === GamePhase.Playing) {
    return { ...state, phase: GamePhase.Paused };
  }
  if (state.phase === GamePhase.Paused) {
    return { ...state, phase: GamePhase.Playing };
  }
  return state;
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
  if (dy === 0 && state.lockState.onGround) {
    const belowMoved = movePiece(moved, 0, 1);
    if (checkCollision(state.board, belowMoved)) {
      // Still on ground — reset lock timer
      newState.lockState = { ...state.lockState };
      if (newState.lockState.resets < MAX_LOCK_RESETS) {
        newState.lockState.timer = 0;
        newState.lockState.resets += 1;
      }
    } else {
      // Slid into open air — counts as a reset (TDG §7)
      const canReset = state.lockState.resets < MAX_LOCK_RESETS;
      newState.lockState = {
        ...state.lockState,
        onGround: false,
        ...(canReset ? { timer: 0, resets: state.lockState.resets + 1 } : {}),
      };
    }
  } else if (dy === 0) {
    // Airborne horizontal move — recheck whether the new position is now grounded
    const belowMoved = movePiece(moved, 0, 1);
    if (checkCollision(state.board, belowMoved)) {
      newState.lockState = { ...state.lockState, onGround: true };
    }
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
  newState.score = state.score + 1; // 1 point per cell soft dropped

  // Recompute onGround — stale-true (from a rotation kick) would cause premature locking
  const belowMoved = movePiece(moved, 0, 1);
  const nowOnGround = checkCollision(state.board, belowMoved);
  newState.lockState = { ...state.lockState, onGround: nowOnGround, timer: 0 };

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
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: -1 },
    };
  }

  // Lock piece onto board and apply hard-drop score
  let nextState: GameState = {
    ...state,
    board: lockPiece(state.board, dropped),
    activePiece: null,
    score: state.score + addHardDropScore(state, rows),
    ghostY: dropped.pos.y,
    lockState: { timer: 0, resets: 0, onGround: false, lowestY: -1 },
  };

  // Shared scoring/lock logic — handles T-spin, line clear, combo, B2B, phase
  const result = executeLock(nextState, dropped);
  nextState = result.state;

  // Apply action popups (hard drops now show TETRIS!, COMBO, etc.)
  for (const popup of result.popupInfo) {
    nextState = pushPopup(nextState, popup.text, popup.color);
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
  const belowRotatedCW = movePiece(result.piece, 0, 1);
  if (state.lockState.onGround) {
    if (checkCollision(state.board, belowRotatedCW)) {
      newState.lockState = { ...state.lockState };
      if (newState.lockState.resets < MAX_LOCK_RESETS) {
        newState.lockState.timer = 0;
        newState.lockState.resets += 1;
      }
    } else {
      // Kicked into open air — still counts as a reset (TDG §7)
      const canReset = state.lockState.resets < MAX_LOCK_RESETS;
      newState.lockState = {
        ...state.lockState,
        onGround: false,
        ...(canReset ? { timer: 0, resets: state.lockState.resets + 1 } : {}),
      };
    }
  } else if (checkCollision(state.board, belowRotatedCW)) {
    // Was airborne; rotation landed piece on ground — detect so shouldLock can fire
    newState.lockState = { ...state.lockState, onGround: true };
  }

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
  const belowRotatedCCW = movePiece(result.piece, 0, 1);
  if (state.lockState.onGround) {
    if (checkCollision(state.board, belowRotatedCCW)) {
      newState.lockState = { ...state.lockState };
      if (newState.lockState.resets < MAX_LOCK_RESETS) {
        newState.lockState.timer = 0;
        newState.lockState.resets += 1;
      }
    } else {
      // Kicked into open air — still counts as a reset (TDG §7)
      const canReset = state.lockState.resets < MAX_LOCK_RESETS;
      newState.lockState = {
        ...state.lockState,
        onGround: false,
        ...(canReset ? { timer: 0, resets: state.lockState.resets + 1 } : {}),
      };
    }
  } else if (checkCollision(state.board, belowRotatedCCW)) {
    // Was airborne; rotation landed piece on ground — detect so shouldLock can fire
    newState.lockState = { ...state.lockState, onGround: true };
  }

  return newState;
}

function handleHold(state: GameState): GameState {
  return holdPiece(state);
}

