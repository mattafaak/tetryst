import {
  type GameState,
  type Board,
  type Piece,
  type NextQueueItem,
  GamePhase,
} from "./types.ts";
import { createBoard, checkCollision } from "./board.ts";
import { spawnPiece, getGhostY } from "./pieces.ts";
import { resetLockState } from "./lock-delay.ts";
import { createFirstBag, drawFromBag, createBag } from "./randomizer.ts";

export function createInitialState(): GameState {
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
    combo: -1,
    backToBack: false,
    phase: GamePhase.Menu,
    gravityTimer: 0,
    lockState: resetLockState(),
    entryDelayTimer: 0,
    bag: [],
    lineClearTimer: 0,
    clearedRowIndices: [],
    lastClearWasB2B: false,
  };
}

export function transitionPhase(
  state: GameState,
  newPhase: GamePhase,
): GameState {
  return { ...state, phase: newPhase };
}

export function startGame(state: GameState): GameState {
  const bag = createFirstBag();
  const drawResult = drawFromBag(bag);
  const piece = spawnPiece(drawResult.piece);
  let currentBag = drawResult.bag;

  // Draw 3 pieces for the next queue
  let queue: NextQueueItem[] = [];
  for (let i = 0; i < 3; i++) {
    const d = drawFromBag(currentBag);
    queue = [...queue, { type: d.piece }];
    currentBag = d.bag;
    if (d.needsNewBag) {
      currentBag = [...currentBag, ...createBag()];
    }
  }

  const board = createBoard();

  return {
    ...state,
    board,
    phase: GamePhase.Playing,
    activePiece: piece,
    ghostY: getGhostY(board, piece),
    bag: currentBag,
    nextQueue: queue,
    score: 0,
    level: 0,
    lines: 0,
    combo: -1,
    backToBack: false,
    hasSwappedThisTurn: false,
    heldPiece: null,
    lockState: resetLockState(),
    gravityTimer: 0,
    entryDelayTimer: 0,
    lineClearTimer: 0,
    clearedRowIndices: [],
    lastClearWasB2B: false,
  };
}

export function holdPiece(state: GameState): GameState {
  if (
    state.phase !== GamePhase.Playing ||
    state.activePiece === null ||
    state.hasSwappedThisTurn
  ) {
    return state;
  }

  const currentType = state.activePiece.type;
  const baseState: GameState = {
    ...state,
    heldPiece: currentType,
    hasSwappedThisTurn: true,
  };

  if (state.heldPiece === null) {
    // First hold: spawn next piece from queue, keep hasSwappedThisTurn=true
    return { ...spawnFromQueue(baseState), hasSwappedThisTurn: true };
  }

  // Swap with held piece
  const swappedPiece = spawnPiece(state.heldPiece);

  // Check if swap causes collision (game over condition for swap)
  if (checkCollision(baseState.board, swappedPiece)) {
    return { ...baseState, phase: GamePhase.GameOver };
  }

  return {
    ...baseState,
    activePiece: swappedPiece,
    ghostY: getGhostY(baseState.board, swappedPiece),
    lockState: resetLockState(),
  };
}

export function spawnNextPiece(state: GameState): GameState {
  if (
    state.phase !== GamePhase.Playing &&
    state.phase !== GamePhase.EntryDelay
  ) {
    return state;
  }

  return { ...spawnFromQueue(state), hasSwappedThisTurn: false };
}

function spawnFromQueue(state: GameState): GameState {
  if (state.nextQueue.length === 0) {
    return { ...state, phase: GamePhase.GameOver };
  }

  const nextType = state.nextQueue[0].type;
  let newQueue = state.nextQueue.slice(1);

  // Refill queue from bag
  let currentBag = state.bag;
  while (newQueue.length < 3) {
    const drawResult = drawFromBag(currentBag);
    newQueue = [...newQueue, { type: drawResult.piece }];
    currentBag = drawResult.bag;
    if (drawResult.needsNewBag) {
      currentBag = createBag();
    }
  }

  const piece = spawnPiece(nextType);

  if (checkCollision(state.board, piece)) {
    return {
      ...state,
      phase: GamePhase.GameOver,
      activePiece: piece,
      ghostY: piece.pos.y,
      nextQueue: newQueue,
      bag: currentBag,
      lockState: resetLockState(),
    };
  }

  return {
    ...state,
    phase: GamePhase.Playing,
    activePiece: piece,
    ghostY: getGhostY(state.board, piece),
    nextQueue: newQueue,
    bag: currentBag,
    lockState: resetLockState(),
    gravityTimer: 0,
  };
}

export function recalculateGhostY(board: Board, piece: Piece): number {
  return getGhostY(board, piece);
}
