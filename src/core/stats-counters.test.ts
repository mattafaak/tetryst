import { describe, it, expect } from "vitest";
import { createInitialState, startGame } from "./state.ts";
import { processAction } from "./actions.ts";
import { executeLock } from "./lock.ts";
import { lockPiece, createBoard } from "./board.ts";
import { TetriminoType, RotationState, GamePhase, GameMode } from "./types.ts";
import { baseState } from "../test-utils/test-utils.ts";
import { BOARD_HEIGHT } from "./constants.ts";

describe("stats counters initialization", () => {
  it("createInitialState has piecesPlaced=0", () => {
    expect(createInitialState().piecesPlaced).toBe(0);
  });
  it("createInitialState has totalKeypresses=0", () => {
    expect(createInitialState().totalKeypresses).toBe(0);
  });
  it("createInitialState has finesseFaults=0", () => {
    expect(createInitialState().finesseFaults).toBe(0);
  });
  it("startGame resets counters to 0", () => {
    const s = startGame(
      baseState({ piecesPlaced: 5, totalKeypresses: 10, finesseFaults: 2, mode: GameMode.Marathon }),
    );
    expect(s.piecesPlaced).toBe(0);
    expect(s.totalKeypresses).toBe(0);
    expect(s.finesseFaults).toBe(0);
  });
});

describe("piecesPlaced increments on executeLock", () => {
  it("piecesPlaced increments by 1 after each lock", () => {
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    const boardWithPiece = lockPiece(createBoard(), piece);
    const state = baseState({
      phase: GamePhase.Playing,
      board: boardWithPiece,
      piecesPlaced: 0,
      lockState: { timer: 0, resets: 0, onGround: true, lowestY: 0, lastRotationKickIndex: null },
    });
    const result = executeLock(state, piece);
    expect(result.state.piecesPlaced).toBe(1);
  });

  it("piecesPlaced accumulates across multiple locks", () => {
    const piece = { type: TetriminoType.I, pos: { x: 0, y: BOARD_HEIGHT - 2 }, rotation: RotationState.ZERO };
    const boardWithPiece = lockPiece(createBoard(), piece);
    const state = baseState({
      phase: GamePhase.Playing,
      board: boardWithPiece,
      piecesPlaced: 3,
      lockState: { timer: 0, resets: 0, onGround: true, lowestY: 0, lastRotationKickIndex: null },
    });
    const result = executeLock(state, piece);
    expect(result.state.piecesPlaced).toBe(4);
  });
});

describe("totalKeypresses increments for gameplay actions", () => {
  const playState = () =>
    baseState({
      phase: GamePhase.Playing,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 10 }, rotation: RotationState.ZERO },
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 10, lastRotationKickIndex: null },
      nextQueue: [{ type: TetriminoType.O }],
      bag: [TetriminoType.L],
      totalKeypresses: 0,
    });

  it("MoveLeft increments totalKeypresses", () => {
    const s = processAction(playState(), { type: "MoveLeft" });
    expect(s.totalKeypresses).toBe(1);
  });
  it("MoveRight increments totalKeypresses", () => {
    const s = processAction(playState(), { type: "MoveRight" });
    expect(s.totalKeypresses).toBe(1);
  });
  it("RotateCW increments totalKeypresses", () => {
    const s = processAction(playState(), { type: "RotateCW" });
    expect(s.totalKeypresses).toBe(1);
  });
  it("RotateCCW increments totalKeypresses", () => {
    const s = processAction(playState(), { type: "RotateCCW" });
    expect(s.totalKeypresses).toBe(1);
  });
  it("Hold increments totalKeypresses", () => {
    const s = processAction(playState(), { type: "Hold" });
    expect(s.totalKeypresses).toBe(1);
  });
});

describe("totalKeypresses does NOT increment for non-scored actions", () => {
  const playState = () =>
    baseState({
      phase: GamePhase.Playing,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 10 }, rotation: RotationState.ZERO },
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 10, lastRotationKickIndex: null },
      nextQueue: [{ type: TetriminoType.O }],
      bag: [TetriminoType.L],
      totalKeypresses: 7,
    });

  it("SoftDrop does NOT increment totalKeypresses", () => {
    const s = processAction(playState(), { type: "SoftDrop" });
    expect(s.totalKeypresses).toBe(7);
  });
  it("Pause does NOT increment totalKeypresses", () => {
    const s = processAction(playState(), { type: "Pause" });
    expect(s.totalKeypresses).toBe(7);
  });
  it("Mute does NOT increment totalKeypresses", () => {
    // Mute is handled by the game loop, not processAction — it returns state unchanged
    const s = processAction(playState(), { type: "Mute" });
    expect(s.totalKeypresses).toBe(7);
  });
});

describe("HardDrop increments totalKeypresses", () => {
  it("HardDrop increments totalKeypresses by 1", () => {
    const state = baseState({
      phase: GamePhase.Playing,
      activePiece: { type: TetriminoType.T, pos: { x: 3, y: 5 }, rotation: RotationState.ZERO },
      lockState: { timer: 0, resets: 0, onGround: false, lowestY: 5, lastRotationKickIndex: null },
      nextQueue: [{ type: TetriminoType.O }],
      bag: [TetriminoType.L],
      totalKeypresses: 0,
    });
    const s = processAction(state, { type: "HardDrop" });
    expect(s.totalKeypresses).toBe(1);
  });
});
