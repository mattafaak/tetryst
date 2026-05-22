import {
  type Piece,
  type Board,
  TetriminoType,
  RotationState,
} from "./types.ts";
import {
  SPAWN_POSITION,
  I_SPAWN_POSITION,
  getWallKicks,
} from "./constants.ts";
import { rotateCW as srsCW, rotateCCW as srsCCW } from "./srs.ts";
import { checkCollision } from "./board.ts";

export function spawnPiece(type: TetriminoType): Piece {
  const isI = type === TetriminoType.I;
  return {
    type,
    pos: { ...(isI ? I_SPAWN_POSITION : SPAWN_POSITION) },
    rotation: RotationState.ZERO,
  };
}

export function movePiece(piece: Piece, dx: number, dy: number): Piece {
  return {
    ...piece,
    pos: {
      x: piece.pos.x + dx,
      y: piece.pos.y + dy,
    },
  };
}

export function tryRotateCW(
  piece: Piece,
  board: Board
): { piece: Piece; kicked: boolean } | null {
  if (piece.type === TetriminoType.O) {
    return { piece: { ...piece }, kicked: false };
  }

  const newRotation = srsCW(piece.rotation);
  const kicks = getWallKicks(piece.type, piece.rotation, newRotation);

  for (let i = 0; i < kicks.length; i++) {
    const kick = kicks[i];
    const testPiece: Piece = {
      type: piece.type,
      pos: {
        x: piece.pos.x + kick.x,
        y: piece.pos.y + kick.y,
      },
      rotation: newRotation,
    };

    if (!checkCollision(board, testPiece)) {
      return {
        piece: testPiece,
        kicked: i > 0,
      };
    }
  }

  return null;
}

export function tryRotateCCW(
  piece: Piece,
  board: Board
): { piece: Piece; kicked: boolean } | null {
  if (piece.type === TetriminoType.O) {
    return { piece: { ...piece }, kicked: false };
  }

  const newRotation = srsCCW(piece.rotation);
  const kicks = getWallKicks(piece.type, piece.rotation, newRotation);

  for (let i = 0; i < kicks.length; i++) {
    const kick = kicks[i];
    const testPiece: Piece = {
      type: piece.type,
      pos: {
        x: piece.pos.x + kick.x,
        y: piece.pos.y + kick.y,
      },
      rotation: newRotation,
    };

    if (!checkCollision(board, testPiece)) {
      return {
        piece: testPiece,
        kicked: i > 0,
      };
    }
  }

  return null;
}

export function getGhostY(board: Board, piece: Piece): number {
  let ghostY = piece.pos.y;

  while (true) {
    const testPiece: Piece = {
      ...piece,
      pos: { x: piece.pos.x, y: ghostY + 1 },
    };
    if (checkCollision(board, testPiece)) {
      break;
    }
    ghostY++;
  }

  return ghostY;
}
