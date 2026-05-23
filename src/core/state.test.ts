import { describe, it, expect } from "vitest";
import { createInitialState, transitionPhase, startGame, holdPiece, spawnNextPiece } from "./state.ts";
import { createBoard } from "./board.ts";
import { resetLockState } from "./lock-delay.ts";
import { GamePhase, GameMode, TetriminoType, RotationState } from "./types.ts";
import { ULTRA_DURATION_MS, NEXT_QUEUE_SIZE } from "./constants.ts";
import type { GameState } from "./types.ts";

describe("state", () => {
  describe("createInitialState", () => {
    it("all fields at correct defaults", () => {
      const state = createInitialState();
      expect(state.board).toEqual(createBoard());
      expect(state.activePiece).toBeNull();
      expect(state.ghostY).toBe(0);
      expect(state.heldPiece).toBeNull();
      expect(state.hasSwappedThisTurn).toBe(false);
      expect(state.nextQueue).toEqual([]);
      expect(state.score).toBe(0);
      expect(state.level).toBe(0);
      expect(state.lines).toBe(0);
      expect(state.effectiveLines).toBe(0);
      expect(state.combo).toBe(-1);
      expect(state.backToBack).toBe(false);
      expect(state.phase).toBe(GamePhase.Menu);
      expect(state.gravityTimer).toBe(0);
      expect(state.lockState).toEqual(resetLockState());
      expect(state.entryDelayTimer).toBe(0);
      expect(state.bag).toEqual([]);
      expect(state.lineClearTimer).toBe(0);
      expect(state.lastClearWasB2B).toBe(false);
    });
  });

  describe("transitionPhase", () => {
    it("phase changes correctly", () => {
      const state = createInitialState();
      expect(state.phase).toBe(GamePhase.Menu);
      const newState = transitionPhase(state, GamePhase.Playing);
      expect(newState.phase).toBe(GamePhase.Playing);
      expect(state.phase).toBe(GamePhase.Menu);
    });

    it("does not mutate the original state", () => {
      const state = createInitialState();
      const copy = { ...state, board: state.board.map((r) => [...r]) };
      const newState = transitionPhase(state, GamePhase.Paused);
      expect(state.phase).toBe(copy.phase);
      expect(state.score).toBe(copy.score);
      expect(state.board).toEqual(copy.board);
      expect(state.lockState).toEqual(copy.lockState);
      // Verify only the returned state was changed
      expect(newState.phase).toBe(GamePhase.Paused);
      expect(newState).not.toBe(state);
    });

    it("can transition through multiple phases", () => {
      const state = createInitialState();
      const playing = transitionPhase(state, GamePhase.Playing);
      const paused = transitionPhase(playing, GamePhase.Paused);
      const resumed = transitionPhase(paused, GamePhase.Playing);
      const over = transitionPhase(resumed, GamePhase.GameOver);
      expect(over.phase).toBe(GamePhase.GameOver);
      expect(state.phase).toBe(GamePhase.Menu); // original unaffected
    });
  });

  describe("startGame", () => {
    it("phase changes to Playing, activePiece is set, queue has pieces", () => {
      const state = createInitialState();
      const newState = startGame(state);

      expect(newState.phase).toBe(GamePhase.Playing);
      expect(newState.activePiece).not.toBeNull();
      expect(newState.activePiece!.rotation).toBe(RotationState.ZERO);
      expect(newState.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
      expect(newState.score).toBe(0);
      expect(newState.level).toBe(0);
      expect(newState.lines).toBe(0);
      expect(newState.effectiveLines).toBe(0);
      expect(newState.combo).toBe(-1);
      expect(newState.heldPiece).toBeNull();
      expect(newState.hasSwappedThisTurn).toBe(false);
      expect(newState.backToBack).toBe(false);
      expect(newState.gravityTimer).toBe(0);
      expect(newState.entryDelayTimer).toBe(0);
      expect(newState.lineClearTimer).toBe(0);
      expect(newState.lastClearWasB2B).toBe(false);
    });

    it("bag has 7+ pieces after start (total across bag, queue, and active)", () => {
      const state = createInitialState();
      const newState = startGame(state);

      // Active piece drawn from bag, NEXT_QUEUE_SIZE drawn for queue, remaining in bag
      // With queue size 5: 1 active + 5 queue = 6 from first bag, leaving 1 (7-6=1)
      expect(newState.bag.length).toBeGreaterThanOrEqual(1);
      // Total pieces in circulation must be at least 7 (one full bag)
      const total =
        newState.bag.length + newState.nextQueue.length + 1;
      expect(total).toBeGreaterThanOrEqual(7);
    });

    it("resets all scores to 0 even if state had non-zero values", () => {
      const state: GameState = {
        ...createInitialState(),
        score: 99999,
        level: 50,
        lines: 200,
        combo: 15,
        backToBack: true,
        lastClearWasB2B: true,
        heldPiece: TetriminoType.I,
      };
      const newState = startGame(state);
      expect(newState.score).toBe(0);
      expect(newState.level).toBe(0);
      expect(newState.lines).toBe(0);
      expect(newState.effectiveLines).toBe(0);
      expect(newState.combo).toBe(-1);
      expect(newState.backToBack).toBe(false);
      expect(newState.lastClearWasB2B).toBe(false);
      expect(newState.heldPiece).toBeNull();
      expect(newState.gravityTimer).toBe(0);
      expect(newState.entryDelayTimer).toBe(0);
      expect(newState.lineClearTimer).toBe(0);
    });
  });

  describe("holdPiece", () => {
    it("stores current piece, spawns next, blocks second swap per turn", () => {
      const board = createBoard();
      const state: GameState = {
        ...createInitialState(),
        board,
        activePiece: {
          type: TetriminoType.T,
          pos: { x: 3, y: 5 },
          rotation: RotationState.ZERO,
        },
        heldPiece: null,
        hasSwappedThisTurn: false,
        nextQueue: [
          { type: TetriminoType.I },
          { type: TetriminoType.O },
          { type: TetriminoType.S },
          { type: TetriminoType.Z },
          { type: TetriminoType.J },
        ],
        bag: [TetriminoType.L, TetriminoType.T, TetriminoType.I],
        phase: GamePhase.Playing,
      };

      const afterHold = holdPiece(state);
      expect(afterHold.heldPiece).toBe(TetriminoType.T);
      expect(afterHold.activePiece!.type).toBe(TetriminoType.I);
      expect(afterHold.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
      expect(afterHold.nextQueue[0].type).toBe(TetriminoType.O);
      expect(afterHold.nextQueue[1].type).toBe(TetriminoType.S);
      expect(afterHold.nextQueue[2].type).toBe(TetriminoType.Z);
      expect(afterHold.bag.length).toBe(2); // After drawing L from bag for refill
      expect(afterHold.hasSwappedThisTurn).toBe(true);

      // Second hold should be blocked
      const afterSecondHold = holdPiece(afterHold);
      expect(afterSecondHold).toBe(afterHold);
    });

    it("swap works when heldPiece exists", () => {
      const board = createBoard();
      const state: GameState = {
        ...createInitialState(),
        board,
        activePiece: {
          type: TetriminoType.T,
          pos: { x: 3, y: 5 },
          rotation: RotationState.ZERO,
        },
        heldPiece: TetriminoType.I,
        hasSwappedThisTurn: false,
        nextQueue: [],
        bag: [],
        phase: GamePhase.Playing,
      };

      const newState = holdPiece(state);
      expect(newState.activePiece!.type).toBe(TetriminoType.I);
      expect(newState.activePiece!.pos).toEqual({ x: 3, y: 18 });
      expect(newState.activePiece!.rotation).toBe(RotationState.ZERO);
      expect(newState.heldPiece).toBe(TetriminoType.T);
      expect(newState.hasSwappedThisTurn).toBe(true);
    });

    it("hasSwappedThisTurn resets after spawnNextPiece is called", () => {
      const board = createBoard();
      const state: GameState = {
        ...createInitialState(),
        board,
        activePiece: {
          type: TetriminoType.T,
          pos: { x: 3, y: 5 },
          rotation: RotationState.ZERO,
        },
        heldPiece: null,
        hasSwappedThisTurn: false,
        nextQueue: [
          { type: TetriminoType.I },
          { type: TetriminoType.O },
          { type: TetriminoType.S },
          { type: TetriminoType.Z },
          { type: TetriminoType.J },
        ],
        bag: [TetriminoType.L],
        phase: GamePhase.Playing,
      };

      const afterHold = holdPiece(state);
      expect(afterHold.hasSwappedThisTurn).toBe(true);

      const afterSpawn = spawnNextPiece(afterHold);
      expect(afterSpawn.hasSwappedThisTurn).toBe(false);
    });

    it("game over when swapped held piece collides at spawn", () => {
      const board = createBoard();
      // I-piece spawns at y=18. Its filled row (row 1 of shape) occupies
      // board row 19. Block one of those cells.
      board[19][3] = "X";

      const state: GameState = {
        ...createInitialState(),
        board,
        activePiece: {
          type: TetriminoType.T,
          pos: { x: 3, y: 5 },
          rotation: RotationState.ZERO,
        },
        heldPiece: TetriminoType.I,
        hasSwappedThisTurn: false,
        nextQueue: [],
        bag: [],
        phase: GamePhase.Playing,
      };

      const newState = holdPiece(state);
      expect(newState.phase).toBe(GamePhase.GameOver);
      expect(newState.heldPiece).toBe(TetriminoType.T);
    });
  });

  describe("spawnNextPiece", () => {
    it("takes from queue, refills queue", () => {
      const board = createBoard();
      const state: GameState = {
        ...createInitialState(),
        board,
        activePiece: {
          type: TetriminoType.S,
          pos: { x: 3, y: 5 },
          rotation: RotationState.ZERO,
        },
        hasSwappedThisTurn: true,
        nextQueue: [
          { type: TetriminoType.T },
          { type: TetriminoType.I },
          { type: TetriminoType.O },
          { type: TetriminoType.S },
          { type: TetriminoType.Z },
        ],
        bag: [TetriminoType.J, TetriminoType.L],
        phase: GamePhase.Playing,
      };

      const newState = spawnNextPiece(state);
      expect(newState.activePiece!.type).toBe(TetriminoType.T);
      expect(newState.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
      expect(newState.nextQueue[0].type).toBe(TetriminoType.I);
      expect(newState.nextQueue[1].type).toBe(TetriminoType.O);
      expect(newState.nextQueue[2].type).toBe(TetriminoType.S);
      expect(newState.bag).toEqual([TetriminoType.L]);
      expect(newState.hasSwappedThisTurn).toBe(false);
    });

    it("game over when collision at spawn", () => {
      const board = createBoard();
      board[20][4] = "X"; // Blocks T-piece at spawn (3, 19)

      const state: GameState = {
        ...createInitialState(),
        board,
        activePiece: {
          type: TetriminoType.S,
          pos: { x: 3, y: 5 },
          rotation: RotationState.ZERO,
        },
        nextQueue: [{ type: TetriminoType.T }],
        bag: [TetriminoType.Z, TetriminoType.J, TetriminoType.L],
        phase: GamePhase.Playing,
      };

      const newState = spawnNextPiece(state);
      expect(newState.phase).toBe(GamePhase.GameOver);
    });

    it("works during EntryDelay phase", () => {
      const board = createBoard();
      const state: GameState = {
        ...createInitialState(),
        board,
        phase: GamePhase.EntryDelay,
        hasSwappedThisTurn: true,
        nextQueue: [
          { type: TetriminoType.J },
          { type: TetriminoType.L },
          { type: TetriminoType.O },
        ],
        bag: [
          TetriminoType.Z,
          TetriminoType.S,
          TetriminoType.T,
          TetriminoType.I,
        ],
      };

      const newState = spawnNextPiece(state);
      expect(newState.phase).toBe(GamePhase.Playing);
      expect(newState.activePiece!.type).toBe(TetriminoType.J);
      expect(newState.hasSwappedThisTurn).toBe(false);
    });

    it("is no-op in Menu phase", () => {
      const state = createInitialState(); // phase = Menu
      const newState = spawnNextPiece(state);
      expect(newState).toBe(state);
    });

    it("game over for I-piece collision at spawn", () => {
      const board = createBoard();
      // I-piece spawns at (3, 18).  Its filled cells are at
      // board row 19 (shape row 1) in columns 3-6.
      board[19][3] = "X";

      const state: GameState = {
        ...createInitialState(),
        board,
        hasSwappedThisTurn: true,
        nextQueue: [{ type: TetriminoType.I }],
        bag: [
          TetriminoType.Z,
          TetriminoType.J,
          TetriminoType.L,
          TetriminoType.O,
          TetriminoType.S,
          TetriminoType.T,
        ],
        phase: GamePhase.Playing,
      };

      const newState = spawnNextPiece(state);
      expect(newState.phase).toBe(GamePhase.GameOver);
      expect(newState.activePiece!.type).toBe(TetriminoType.I);
    });

    it("game over for O-piece collision at spawn", () => {
      const board = createBoard();
      // O-piece spawns at (3, 19).  Filled cells at (3,19), (4,19),
      // (3,20), (4,20).  Block one of those.
      board[20][3] = "X";

      const state: GameState = {
        ...createInitialState(),
        board,
        hasSwappedThisTurn: true,
        nextQueue: [{ type: TetriminoType.O }],
        bag: [
          TetriminoType.Z,
          TetriminoType.J,
          TetriminoType.L,
          TetriminoType.I,
          TetriminoType.S,
          TetriminoType.T,
        ],
        phase: GamePhase.Playing,
      };

      const newState = spawnNextPiece(state);
      expect(newState.phase).toBe(GamePhase.GameOver);
      expect(newState.activePiece!.type).toBe(TetriminoType.O);
    });

    it("queue stays at NEXT_QUEUE_SIZE over multiple spawns as it refills from bag", () => {
      const board = createBoard();
      const bag = [
        TetriminoType.Z,
        TetriminoType.J,
        TetriminoType.L,
        TetriminoType.O,
        TetriminoType.S,
        TetriminoType.T,
        TetriminoType.I,
        TetriminoType.Z,
        TetriminoType.J,
        TetriminoType.L,
        TetriminoType.O,
        TetriminoType.S,
        TetriminoType.T,
        TetriminoType.I,
      ];
      let state: GameState = {
        ...createInitialState(),
        board,
        hasSwappedThisTurn: true,
        nextQueue: [
          { type: TetriminoType.I },
          { type: TetriminoType.J },
          { type: TetriminoType.L },
          { type: TetriminoType.O },
          { type: TetriminoType.S },
        ],
        bag: [...bag],
        phase: GamePhase.Playing,
      };

      for (let i = 0; i < 5; i++) {
        state = spawnNextPiece(state);
        expect(state.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
        expect(state.phase).toBe(GamePhase.Playing);
      }
    });
  });

  describe("next queue size", () => {
    it("startGame produces a next queue of NEXT_QUEUE_SIZE pieces", () => {
      const state = startGame(createInitialState(GameMode.Marathon));
      expect(state.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
    });

    it("spawnNextPiece maintains a queue of NEXT_QUEUE_SIZE pieces", () => {
      let state = startGame(createInitialState(GameMode.Marathon));
      // move to EntryDelay so spawnNextPiece is valid
      state = spawnNextPiece({ ...state, phase: GamePhase.EntryDelay });
      expect(state.nextQueue.length).toBe(NEXT_QUEUE_SIZE);
    });
  });

  describe("mode and modeTimer", () => {
    it("createInitialState defaults to Marathon", () => {
      const state = createInitialState();
      expect(state.mode).toBe(GameMode.Marathon);
      expect(state.modeTimer).toBe(0);
    });

    it("createInitialState(GameMode.Marathon) sets mode and modeTimer=0", () => {
      const state = createInitialState(GameMode.Marathon);
      expect(state.mode).toBe(GameMode.Marathon);
      expect(state.modeTimer).toBe(0);
    });

    it("createInitialState(GameMode.Ultra) sets modeTimer to 3 minutes", () => {
      const state = createInitialState(GameMode.Ultra);
      expect(state.mode).toBe(GameMode.Ultra);
      expect(state.modeTimer).toBe(ULTRA_DURATION_MS);
    });

    it("createInitialState(GameMode.Sprint) sets modeTimer to 0", () => {
      const state = createInitialState(GameMode.Sprint);
      expect(state.mode).toBe(GameMode.Sprint);
      expect(state.modeTimer).toBe(0);
    });
  });

  describe("startGame with startLevel", () => {
    it("startGame(state, 5) sets level to 5", () => {
      const state = createInitialState(GameMode.Marathon);
      const started = startGame(state, 5);
      expect(started.level).toBe(5);
    });

    it("startGame(state) defaults level to 0", () => {
      const state = createInitialState(GameMode.Marathon);
      const started = startGame(state);
      expect(started.level).toBe(0);
    });

    it("startGame resets modeTimer for Ultra", () => {
      const state = createInitialState(GameMode.Ultra);
      const modified = { ...state, modeTimer: 0 };
      const started = startGame(modified);
      expect(started.modeTimer).toBe(ULTRA_DURATION_MS);
    });

    it("startGame resets popups to empty", () => {
      const state = createInitialState(GameMode.Marathon);
      const withPopups = { ...state, popups: [{ text: "TETRIS!", timer: 0, duration: 1200, color: "#fff" }] };
      const started = startGame(withPopups);
      expect(started.popups).toEqual([]);
    });
  });
});
