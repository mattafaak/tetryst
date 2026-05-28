/**
 * Property-based fuzz tests for board invariants under random action sequences.
 * Runs 1000+ sequences, verifying board dimensions, cell validity, and no NaN.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { processAction } from "../core/actions.ts";
import { createInitialState, startGame } from "../core/state.ts";
import { GameMode, TetriminoType, GamePhase } from "../core/types.ts";
import type { GameState, InputAction } from "../core/types.ts";
import { BOARD_WIDTH, BOARD_HEIGHT } from "../core/constants.ts";

const VALID_TETRIMINO_TYPES = new Set<string>(Object.values(TetriminoType));

const actionGen = fc.constantFrom<InputAction["type"]>(
  "MoveLeft", "MoveRight", "SoftDrop", "HardDrop",
  "RotateCW", "RotateCCW", "Hold",
);

function startFreshGame(): GameState {
  return startGame(createInitialState(GameMode.Marathon));
}

function assertBoardInvariants(state: GameState, label: string): void {
  const board = state.board;
  // Dimension check
  expect(board.length, `${label}: board rows`).toBe(BOARD_HEIGHT);
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    expect(board[r].length, `${label}: board[${r}] cols`).toBe(BOARD_WIDTH);
    for (let c = 0; c < BOARD_WIDTH; c++) {
      const cell = board[r][c];
      if (cell !== null) {
        expect(VALID_TETRIMINO_TYPES.has(cell as string), `${label}: invalid cell`).toBe(true);
      }
    }
  }

  // Numeric sanity
  expect(Number.isFinite(state.score)).toBe(true);
  expect(state.score).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(state.level)).toBe(true);
  expect(Number.isFinite(state.lines)).toBe(true);
  expect(Number.isFinite(state.effectiveLines)).toBe(true);
  expect(Number.isFinite(state.combo)).toBe(true);
  expect(Number.isFinite(state.gravityTimer)).toBe(true);
  expect(Number.isFinite(state.lockState.timer)).toBe(true);
}

describe("board invariants under random action sequences (34.1)", () => {
  it("board dimensions, cell validity, and numeric fields stay valid after 1000+ action sequences", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.array(actionGen, { minLength: 5, maxLength: 30 }),
        (actionTypes) => {
          let state = startFreshGame();
          assertBoardInvariants(state, "initial");

          for (const type of actionTypes) {
            // Don't apply actions in terminal phases
            if (state.phase === GamePhase.GameOver || state.phase === GamePhase.Victory) break;
            state = processAction(state, { type } as InputAction);
            assertBoardInvariants(state, `after ${type}`);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("board never gains extra rows or columns regardless of action sequence", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.array(actionGen, { minLength: 1, maxLength: 50 }),
        (actionTypes) => {
          let state = startFreshGame();
          for (const type of actionTypes) {
            if (state.phase === GamePhase.GameOver || state.phase === GamePhase.Victory) break;
            state = processAction(state, { type } as InputAction);
          }
          expect(state.board.length).toBe(BOARD_HEIGHT);
          for (const row of state.board) {
            expect(row.length).toBe(BOARD_WIDTH);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("score never contains NaN or Infinity in any reachable state", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.array(actionGen, { minLength: 1, maxLength: 40 }),
        (actionTypes) => {
          let state = startFreshGame();
          for (const type of actionTypes) {
            if (state.phase === GamePhase.GameOver || state.phase === GamePhase.Victory) break;
            state = processAction(state, { type } as InputAction);
            expect(Number.isNaN(state.score)).toBe(false);
            expect(Number.isFinite(state.score)).toBe(true);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});
