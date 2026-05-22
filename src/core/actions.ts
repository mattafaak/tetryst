import {
  type GameState,
  type InputAction,
  type Board,
  GamePhase,
} from "./types.ts";
import { tryRotateCW, tryRotateCCW, movePiece, getGhostY } from "./pieces.ts";
import { checkCollision, lockPiece, clearLines } from "./board.ts";
import { addHardDropScore, evaluateClear, detectTSpin } from "./scoring.ts";
import { updateCombo } from "./combo.ts";
import { holdPiece } from "./state.ts";
import { LINES_PER_LEVEL, BOARD_WIDTH } from "./constants.ts";

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

  // If piece is on ground and moving horizontally, reset lock timer
  if (dy === 0 && state.lockState.onGround) {
    newState.lockState = { ...state.lockState };
    if (newState.lockState.resets < 15) {
      newState.lockState.timer = 0;
      newState.lockState.resets += 1;
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

  return newState;
}

function handleHardDrop(state: GameState): GameState {
  if (
    state.phase !== GamePhase.Playing ||
    state.activePiece === null
  ) {
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

  const droppedY = dropped.pos.y;

  // Hard drop: piece locks immediately, bypass lock delay
  const lockedBoard = lockPiece(state.board, dropped);
  const tSpinResult = detectTSpin(lockedBoard, dropped);  // before clearLines
  const clearResult = clearLines(lockedBoard);

  let nextState: GameState = {
    ...state,
    board: clearResult.board,
    activePiece: null,
    score: state.score + addHardDropScore(state, rows),
    ghostY: droppedY,
    lockState: { timer: 0, resets: 0, onGround: false, lowestY: -1 },
  };

  if (clearResult.linesCleared > 0) {
    const comboResult = updateCombo(nextState, clearResult.linesCleared);
    nextState = comboResult.state;
    nextState.score += comboResult.bonusScore;

    const perfectClear = checkPerfectClear(nextState.board);
    const scoreResult = evaluateClear(
      clearResult.linesCleared,
      tSpinResult,
      nextState.level,
      nextState.backToBack,
      perfectClear
    );

    nextState.score += scoreResult.score;
    nextState.backToBack = scoreResult.isB2B;
    nextState.lines += clearResult.linesCleared;

    const newLevel = Math.floor(nextState.lines / LINES_PER_LEVEL);
    if (newLevel > nextState.level) {
      nextState.level = newLevel;
    }

    nextState.phase = GamePhase.LineClear;
    nextState.lineClearTimer = 0;
    nextState.clearedRowIndices = clearResult.clearedRowIndices;
  } else {
    const comboResult = updateCombo(nextState, 0);
    nextState = comboResult.state;

    if (tSpinResult.isTSpin) {
      const scoreResult = evaluateClear(
        0,
        tSpinResult,
        nextState.level,
        nextState.backToBack,
        false,
      );
      nextState.score += scoreResult.score;
      nextState.backToBack = scoreResult.isB2B;
    }

    nextState.phase = GamePhase.EntryDelay;
    nextState.entryDelayTimer = 0;
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

  // If on ground, rotating resets lock timer (up to 15)
  if (state.lockState.onGround) {
    newState.lockState = { ...state.lockState };
    if (newState.lockState.resets < 15) {
      newState.lockState.timer = 0;
      newState.lockState.resets += 1;
    }
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

  if (state.lockState.onGround) {
    newState.lockState = { ...state.lockState };
    if (newState.lockState.resets < 15) {
      newState.lockState.timer = 0;
      newState.lockState.resets += 1;
    }
  }

  return newState;
}

function handleHold(state: GameState): GameState {
  return holdPiece(state);
}

function checkPerfectClear(board: Board): boolean {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      if (board[row][col] !== null) return false;
    }
  }
  return true;
}
