import { TetriminoType } from "./types.ts";

const ALL_PIECES: readonly TetriminoType[] = [
  TetriminoType.I,
  TetriminoType.O,
  TetriminoType.T,
  TetriminoType.S,
  TetriminoType.Z,
  TetriminoType.J,
  TetriminoType.L,
];

const VALID_FIRST_PIECES: readonly TetriminoType[] = [
  TetriminoType.I,
  TetriminoType.J,
  TetriminoType.L,
  TetriminoType.T,
];

function fisherYatesShuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Create a shuffled 7-bag of all Tetrimino types.
 * Uses Fisher-Yates shuffle for uniform distribution.
 */
export function createBag(): TetriminoType[] {
  return fisherYatesShuffle(ALL_PIECES);
}

/**
 * Draw one piece from the bag.
 * If the bag is empty, a new bag is created automatically.
 * Returns the drawn piece, the remaining bag, and a flag indicating
 * whether a new bag is needed on the next draw.
 */
export function drawFromBag(
  bag: TetriminoType[],
): { piece: TetriminoType; bag: TetriminoType[]; needsNewBag: boolean } {
  const currentBag = bag.length === 0 ? createBag() : bag;
  return {
    piece: currentBag[0],
    bag: currentBag.slice(1),
    needsNewBag: currentBag.length === 1,
  };
}

/**
 * Create a 7-bag whose first piece is guaranteed to be I, J, L, or T.
 * Per the Tetris Design Guideline: the first piece of the game must not
 * be O, S, or Z (too difficult to start with).
 */
export function createFirstBag(): TetriminoType[] {
  const bag = createBag();
  if (VALID_FIRST_PIECES.includes(bag[0])) {
    return bag;
  }
  const swapIdx = bag.findIndex((p) => VALID_FIRST_PIECES.includes(p));
  if (swapIdx < 0) return bag; // should never happen: 4/7 pieces are always valid
  const result = [...bag];
  result[0] = bag[swapIdx];
  result[swapIdx] = bag[0];
  return result;
}
