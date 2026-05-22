import {
  type Board,
  type Piece,
  type GameState,
  TetriminoType,
  RotationState,
} from "../core/types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT, PIECE_SHAPES } from "../core/constants.ts";
import { checkCollision, lockPiece, clearLines } from "../core/board.ts";
import { getGhostY, spawnPiece } from "../core/pieces.ts";

export interface AIPlacement {
  targetX: number;
  targetRotation: RotationState;
  usesHold: boolean;
  score: number;
}

const HEURISTIC_WEIGHTS = {
  aggregateHeight: -0.5,
  completedLines: 100,
  holes: -3.0,
  bumpiness: -0.3,
  maxHeight: -0.3,
};

export function evaluateBoard(board: Board, linesCleared: number): number {
  const heights = computeColumnHeights(board);
  const aggHeight = heights.reduce((a, b) => a + b, 0);
  const maxH = heights.length > 0 ? Math.max(...heights) : 0;
  const holeCount = countHoles(board, heights);
  const bump = computeBumpiness(heights);

  return HEURISTIC_WEIGHTS.aggregateHeight * aggHeight
    + HEURISTIC_WEIGHTS.completedLines * linesCleared
    + HEURISTIC_WEIGHTS.holes * holeCount
    + HEURISTIC_WEIGHTS.bumpiness * bump
    + HEURISTIC_WEIGHTS.maxHeight * maxH;
}

export function computeColumnHeights(board: Board): number[] {
  const heights: number[] = new Array(BOARD_WIDTH).fill(0);
  for (let x = 0; x < BOARD_WIDTH; x++) {
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (board[y][x] !== null) {
        heights[x] = BOARD_HEIGHT - y;
        break;
      }
    }
  }
  return heights;
}

export function countHoles(board: Board, heights: number[]): number {
  let holes = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    if (heights[x] === 0) continue; // empty column, no holes possible
    const firstBlockY = BOARD_HEIGHT - heights[x];
    for (let y = firstBlockY + 1; y < BOARD_HEIGHT; y++) {
      if (board[y][x] === null) {
        holes++;
      }
    }
  }
  return holes;
}

export function computeBumpiness(heights: number[]): number {
  let bumpiness = 0;
  for (let i = 0; i < heights.length - 1; i++) {
    bumpiness += Math.abs(heights[i] - heights[i + 1]);
  }
  return bumpiness;
}

export function getPieceWidth(type: TetriminoType, rotation: RotationState): number {
  const shape = PIECE_SHAPES[type][rotation];
  let maxCol = 0;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) maxCol = Math.max(maxCol, c);
    }
  }
  return maxCol + 1;
}

export function simulatePlacement(
  board: Board,
  piece: Piece,
  targetX: number,
  targetRotation: RotationState,
): AIPlacement | null {
  const testPiece: Piece = {
    type: piece.type,
    pos: { x: targetX, y: piece.pos.y },
    rotation: targetRotation,
  };

  if (checkCollision(board, testPiece)) return null;

  const ghostY = getGhostY(board, testPiece);
  const placedPiece: Piece = {
    ...testPiece,
    pos: { x: targetX, y: ghostY },
  };

  const lockedBoard = lockPiece(board, placedPiece);
  const clearResult = clearLines(lockedBoard);

  const score = evaluateBoard(clearResult.board, clearResult.linesCleared);

  return {
    targetX,
    targetRotation,
    usesHold: false,
    score,
  };
}

export function generatePlacements(board: Board, piece: Piece): AIPlacement[] {
  const placements: AIPlacement[] = [];

  for (let rotVal = 0; rotVal < 4; rotVal++) {
    const rotation = rotVal as RotationState;
    const width = getPieceWidth(piece.type, rotation);

    for (let x = 0; x <= BOARD_WIDTH - width; x++) {
      const placement = simulatePlacement(board, piece, x, rotation);
      if (placement) {
        placements.push(placement);
      }
    }
  }

  return placements.sort((a, b) => b.score - a.score);
}

export function findBestPlacement(state: GameState): AIPlacement | null {
  if (!state.activePiece) return null;

  const placements = generatePlacements(state.board, state.activePiece);
  if (placements.length === 0) return null;

  let best = placements[0];

  // Evaluate hold if available
  if (!state.hasSwappedThisTurn) {
    const holdType = state.heldPiece ?? state.nextQueue[0]?.type;
    if (holdType !== undefined && holdType !== null) {
      const holdTestPiece = spawnPiece(holdType);
      const holdPlacements = generatePlacements(state.board, holdTestPiece);
      if (holdPlacements.length > 0 && holdPlacements[0].score > best.score) {
        best = holdPlacements[0];
        best.usesHold = true;
      }
    }
  }

  return best;
}
