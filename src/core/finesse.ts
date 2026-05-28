import { TetriminoType, RotationState, type Piece } from "./types.ts";
import { spawnPiece, tryRotateCW, tryRotateCCW, movePiece } from "./pieces.ts";
import { createBoard, checkCollision } from "./board.ts";

function stateKey(type: TetriminoType, x: number, rotation: RotationState): string {
  return `${type}:${rotation}:${x}`;
}

function buildFinesseTable(): Map<string, number> {
  const table = new Map<string, number>();
  const board = createBoard(); // empty board — finesse is measured with no obstacles

  for (const type of Object.values(TetriminoType) as TetriminoType[]) {
    const startPiece = spawnPiece(type);
    const startKey = stateKey(type, startPiece.pos.x, startPiece.rotation);
    table.set(startKey, 0);

    const queue: Array<{ piece: Piece; cost: number }> = [{ piece: startPiece, cost: 0 }];
    const visited = new Set<string>([startKey]);

    while (queue.length > 0) {
      const { piece, cost } = queue.shift()!;

      // Try all 4 movement actions
      const candidates: Piece[] = [];

      const left = movePiece(piece, -1, 0);
      if (!checkCollision(board, left)) candidates.push(left);

      const right = movePiece(piece, 1, 0);
      if (!checkCollision(board, right)) candidates.push(right);

      const cw = tryRotateCW(piece, board);
      /* c8 ignore next -- empty board BFS; rotation always succeeds or O-piece has no kicks */
      if (cw) candidates.push(cw.piece);

      const ccw = tryRotateCCW(piece, board);
      /* c8 ignore next */
      if (ccw) candidates.push(ccw.piece);

      for (const neighbor of candidates) {
        const key = stateKey(type, neighbor.pos.x, neighbor.rotation);
        if (!visited.has(key)) {
          visited.add(key);
          table.set(key, cost + 1);
          queue.push({ piece: neighbor, cost: cost + 1 });
        }
      }
    }
  }

  return table;
}

export const FINESSE_TABLE: Map<string, number> = buildFinesseTable();

export function canonicalKeypresses(
  type: TetriminoType,
  rotation: RotationState,
  col: number,
): number {
  return FINESSE_TABLE.get(stateKey(type, col, rotation)) ?? Infinity;
}
