import {
  type GameState,
  type NextQueueItem,
  GamePhase,
  GameMode,
} from "./types.ts";
import { createBoard, checkCollision } from "./board.ts";
import { spawnPiece, getGhostY, tryRotateCW, tryRotateCCW } from "./pieces.ts";
import { resetLockState } from "./lock-delay.ts";
import { createFirstBag, drawFromBag, createBag } from "./randomizer.ts";
import { ULTRA_DURATION_MS, NEXT_QUEUE_SIZE } from "./constants.ts";

export function createInitialState(mode: GameMode = GameMode.Marathon): GameState {
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
    mode,
    modeTimer: mode === GameMode.Ultra ? ULTRA_DURATION_MS : 0,
    popups: [],
    piecesPlaced: 0,
    totalKeypresses: 0,
    finesseFaults: 0,
    currentPieceKeypresses: 0,
  };
}

export function startGame(state: GameState, startLevel: number = 0): GameState {
  const bag = createFirstBag();
  const drawResult = drawFromBag(bag);
  const piece = spawnPiece(drawResult.piece);
  let currentBag = drawResult.bag;

  // Draw NEXT_QUEUE_SIZE pieces for the next queue
  let queue: NextQueueItem[] = [];
  for (let i = 0; i < NEXT_QUEUE_SIZE; i++) {
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
    level: startLevel,
    lines: 0,
    effectiveLines: 0,
    combo: 0,
    backToBack: false,
    hasSwappedThisTurn: false,
    heldPiece: null,
    lockState: resetLockState(),
    gravityTimer: 0,
    entryDelayTimer: 0,
    lineClearTimer: 0,
    clearedRowIndices: [],
    modeTimer: state.mode === GameMode.Ultra ? ULTRA_DURATION_MS : 0,
    popups: [],
    piecesPlaced: 0,
    totalKeypresses: 0,
    finesseFaults: 0,
    currentPieceKeypresses: 0,
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
    return { ...baseState, phase: GamePhase.GameOver, activePiece: null };
  }

  return {
    ...baseState,
    activePiece: swappedPiece,
    ghostY: getGhostY(baseState.board, swappedPiece),
    lockState: { ...resetLockState(), lowestY: swappedPiece.pos.y },
    gravityTimer: 0,
  };
}

export function spawnNextPiece(state: GameState): GameState {
  if (
    state.phase !== GamePhase.Playing &&
    state.phase !== GamePhase.EntryDelay
  ) {
    return state;
  }

  const spawned = { ...spawnFromQueue(state), hasSwappedThisTurn: false };

  // IHS: apply buffered hold immediately after spawn
  if (state.bufferedHold && !state.hasSwappedThisTurn) {
    return { ...holdPiece(spawned), bufferedHold: false };
  }

  return spawned;
}

function spawnFromQueue(state: GameState): GameState {
  if (state.nextQueue.length === 0) {
    return { ...state, phase: GamePhase.GameOver };
  }

  const nextType = state.nextQueue[0].type;
  let newQueue = state.nextQueue.slice(1);

  // Refill queue from bag
  let currentBag = state.bag;
  while (newQueue.length < NEXT_QUEUE_SIZE) {
    const drawResult = drawFromBag(currentBag);
    newQueue = [...newQueue, { type: drawResult.piece }];
    currentBag = drawResult.bag;
    if (drawResult.needsNewBag) {
      currentBag = [...currentBag, ...createBag()];
    }
  }

  let piece = spawnPiece(nextType);

  // IRS: apply buffered rotation from EntryDelay/LineClear phase
  const bufRot = state.bufferedRotation;
  if (bufRot) {
    const rotResult = bufRot === "CW"
      ? tryRotateCW(piece, state.board)
      : tryRotateCCW(piece, state.board);
    if (rotResult !== null) {
      piece = rotResult.piece;
    }
  }

  if (checkCollision(state.board, piece)) {
    return {
      ...state,
      phase: GamePhase.GameOver,
      activePiece: null,
      ghostY: 0,
      nextQueue: newQueue,
      bag: currentBag,
      lockState: resetLockState(),
      gravityTimer: 0,
      bufferedRotation: null,
    };
  }

  return {
    ...state,
    phase: GamePhase.Playing,
    activePiece: piece,
    ghostY: getGhostY(state.board, piece),
    nextQueue: newQueue,
    bag: currentBag,
    lockState: { ...resetLockState(), lowestY: piece.pos.y },
    gravityTimer: 0,
    bufferedRotation: null,
    currentPieceKeypresses: 0,
  };
}

