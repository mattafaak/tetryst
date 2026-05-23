import { type Board, type Piece, type Cell, type ClearResult } from "./types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT, BUFFER_HEIGHT, PIECE_SHAPES } from "./constants.ts";

export function createBoard(width: number = BOARD_WIDTH, height: number = BOARD_HEIGHT): Board {
  const board: Board = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push(null);
    }
    board.push(row);
  }
  return board;
}

export function checkCollision(board: Board, piece: Piece): boolean {
  const shape = PIECE_SHAPES[piece.type][piece.rotation];

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;

      const boardX = piece.pos.x + c;
      const boardY = piece.pos.y + r;

      // Check bounds
      if (boardX < 0 || boardX >= BOARD_WIDTH) return true;
      if (boardY >= BOARD_HEIGHT) return true;

      // Allow pieces above the board (negative y)
      if (boardY < 0) continue;

      // Check collision with locked cells
      if (board[boardY][boardX] !== null) return true;
    }
  }

  return false;
}

export function lockPiece(board: Board, piece: Piece): Board {
  const newBoard = board.map((row) => [...row]);
  const shape = PIECE_SHAPES[piece.type][piece.rotation];
  const color = piece.type; // Use piece type as color identifier

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;

      const boardX = piece.pos.x + c;
      const boardY = piece.pos.y + r;

      if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
        newBoard[boardY][boardX] = color;
      }
    }
  }

  return newBoard;
}

export function clearLines(board: Board): ClearResult {
  const clearedRowIndices: number[] = [];

  for (let y = 0; y < board.length; y++) {
    if (board[y].every((cell) => cell !== null)) {
      clearedRowIndices.push(y);
    }
  }

  if (clearedRowIndices.length === 0) {
    return { board, linesCleared: 0, clearedRowIndices: [] };
  }

  // Build new board: keep only non-full rows, add empty rows at top
  const newBoard = board.filter((_, idx) => !clearedRowIndices.includes(idx));

  // Add empty rows at the top for each cleared line
  for (let i = 0; i < clearedRowIndices.length; i++) {
    const emptyRow: Cell[] = [];
    for (let x = 0; x < BOARD_WIDTH; x++) {
      emptyRow.push(null);
    }
    newBoard.unshift(emptyRow);
  }

  return {
    board: newBoard,
    linesCleared: clearedRowIndices.length,
    clearedRowIndices,
  };
}

export function isLockOut(piece: Piece): boolean {
  const shape = PIECE_SHAPES[piece.type][piece.rotation];
  let hasMino = false;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        hasMino = true;
        if ((piece.pos.y + r) >= BUFFER_HEIGHT) return false;
      }
    }
  }
  return hasMino;
}
