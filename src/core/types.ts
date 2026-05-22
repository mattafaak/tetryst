export enum TetriminoType {
  I = "I",
  O = "O",
  T = "T",
  S = "S",
  Z = "Z",
  J = "J",
  L = "L",
}

export enum RotationState {
  ZERO = 0,
  R = 1,
  TWO = 2,
  L = 3,
}

export type Cell = string | null;

export type Board = Cell[][];

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  type: TetriminoType;
  pos: Position;
  rotation: RotationState;
}

export enum GamePhase {
  Menu = "Menu",
  Playing = "Playing",
  Paused = "Paused",
  GameOver = "GameOver",
  LineClear = "LineClear",
  EntryDelay = "EntryDelay",
}

export interface TSpinResult {
  isTSpin: boolean;
  isMini: boolean;
}

export interface ClearResult {
  board: Board;
  linesCleared: number;
  clearedRowIndices: number[];
}

export interface ScoreResult {
  score: number;
  isB2B: boolean;
  isB2BBroken: boolean;
}

export interface LockState {
  timer: number;
  resets: number;
  onGround: boolean;
  lowestY: number; // piece top y-coord at lowest position reached; reset resets when piece falls lower
}

export interface NextQueueItem {
  type: TetriminoType;
}

export interface GameState {
  board: Board;
  activePiece: Piece | null;
  ghostY: number;
  heldPiece: TetriminoType | null;
  hasSwappedThisTurn: boolean;
  nextQueue: NextQueueItem[];
  score: number;
  level: number;
  lines: number;
  combo: number;
  backToBack: boolean;
  phase: GamePhase;
  gravityTimer: number;
  lockState: LockState;
  entryDelayTimer: number;
  bag: TetriminoType[];
  lineClearTimer: number;
  clearedRowIndices: number[];
  lastClearWasB2B: boolean;
}

export type InputAction =
  | { type: "MoveLeft" }
  | { type: "MoveRight" }
  | { type: "SoftDrop" }
  | { type: "HardDrop" }
  | { type: "RotateCW" }
  | { type: "RotateCCW" }
  | { type: "Hold" }
  | { type: "Pause" }
  | { type: "Start" };
