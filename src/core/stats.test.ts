import { describe, it, expect } from "vitest";
import { computeGameStats } from "./stats.ts";
import { baseState } from "../test-utils/test-utils.ts";
import { GameMode } from "./types.ts";
import { ULTRA_DURATION_MS } from "./constants.ts";

describe("computeGameStats — PPS", () => {
  it("pps = piecesPlaced / (modeTimer / 1000)", () => {
    const s = baseState({ piecesPlaced: 20, modeTimer: 10000, totalKeypresses: 60, finesseFaults: 2 });
    expect(computeGameStats(s).pps).toBeCloseTo(2.0, 3);
  });
  it("pps rounds correctly", () => {
    const s = baseState({ piecesPlaced: 7, modeTimer: 3000, totalKeypresses: 20, finesseFaults: 0 });
    expect(computeGameStats(s).pps).toBeCloseTo(7 / 3, 3);
  });
  it("pps is 0 when modeTimer is 0", () => {
    const s = baseState({ piecesPlaced: 10, modeTimer: 0, totalKeypresses: 30, finesseFaults: 0 });
    expect(computeGameStats(s).pps).toBe(0);
  });
  it("pps is 0 when piecesPlaced is 0", () => {
    const s = baseState({ piecesPlaced: 0, modeTimer: 5000, totalKeypresses: 0, finesseFaults: 0 });
    expect(computeGameStats(s).pps).toBe(0);
  });
  it("pps is never NaN", () => {
    const s = baseState({ piecesPlaced: 0, modeTimer: 0, totalKeypresses: 0, finesseFaults: 0 });
    expect(Number.isNaN(computeGameStats(s).pps)).toBe(false);
  });
});

describe("computeGameStats — KPP", () => {
  it("kpp = totalKeypresses / piecesPlaced", () => {
    const s = baseState({ piecesPlaced: 20, modeTimer: 10000, totalKeypresses: 60, finesseFaults: 2 });
    expect(computeGameStats(s).kpp).toBeCloseTo(3.0, 3);
  });
  it("kpp is 0 when piecesPlaced is 0", () => {
    const s = baseState({ piecesPlaced: 0, modeTimer: 5000, totalKeypresses: 0, finesseFaults: 0 });
    expect(computeGameStats(s).kpp).toBe(0);
  });
  it("kpp is 0 when totalKeypresses is 0", () => {
    const s = baseState({ piecesPlaced: 10, modeTimer: 5000, totalKeypresses: 0, finesseFaults: 0 });
    expect(computeGameStats(s).kpp).toBe(0);
  });
  it("kpp is never NaN", () => {
    const s = baseState({ piecesPlaced: 0, modeTimer: 0, totalKeypresses: 0, finesseFaults: 0 });
    expect(Number.isNaN(computeGameStats(s).kpp)).toBe(false);
  });
  it("kpp is never Infinity", () => {
    const s = baseState({ piecesPlaced: 0, modeTimer: 0, totalKeypresses: 5, finesseFaults: 0 });
    expect(Number.isFinite(computeGameStats(s).kpp) || computeGameStats(s).kpp === 0).toBe(true);
  });
});

describe("computeGameStats — finesseFaults", () => {
  it("passes through finesseFaults from state", () => {
    const s = baseState({ piecesPlaced: 5, modeTimer: 5000, totalKeypresses: 15, finesseFaults: 7 });
    expect(computeGameStats(s).finesseFaults).toBe(7);
  });
  it("finesseFaults is 0 when state has 0", () => {
    const s = baseState({ piecesPlaced: 5, modeTimer: 5000, totalKeypresses: 15, finesseFaults: 0 });
    expect(computeGameStats(s).finesseFaults).toBe(0);
  });
});

describe("computeGameStats — Sprint mode (timer counts up, same as Marathon)", () => {
  it("Sprint pps uses modeTimer directly (not reversed)", () => {
    const s = baseState({ mode: GameMode.Sprint, piecesPlaced: 10, modeTimer: 5000, totalKeypresses: 30, finesseFaults: 0 });
    expect(computeGameStats(s).pps).toBeCloseTo(10 / 5, 3);
  });
  it("Sprint kpp is correct", () => {
    const s = baseState({ mode: GameMode.Sprint, piecesPlaced: 10, modeTimer: 5000, totalKeypresses: 40, finesseFaults: 0 });
    expect(computeGameStats(s).kpp).toBeCloseTo(4.0, 3);
  });
});

describe("computeGameStats — finesseFaults accuracy", () => {
  it("finesseFaults passthrough: large count", () => {
    const s = baseState({ piecesPlaced: 50, modeTimer: 30000, totalKeypresses: 200, finesseFaults: 23 });
    expect(computeGameStats(s).finesseFaults).toBe(23);
  });
  it("finesseFaults never negative", () => {
    const s = baseState({ piecesPlaced: 10, modeTimer: 5000, totalKeypresses: 30, finesseFaults: 0 });
    expect(computeGameStats(s).finesseFaults).toBeGreaterThanOrEqual(0);
  });
  it("fault rate — finesseFaults divided by piecesPlaced represents accuracy", () => {
    const faults = 5;
    const pieces = 20;
    const s = baseState({ piecesPlaced: pieces, modeTimer: 10000, totalKeypresses: 60, finesseFaults: faults });
    const stats = computeGameStats(s);
    expect(stats.finesseFaults / stats.pps / (10000 / 1000)).toBeLessThanOrEqual(pieces);
  });
});

describe("computeGameStats — Ultra mode timer direction", () => {
  it("Ultra pps uses ULTRA_DURATION_MS - modeTimer as elapsed when timer has counted down", () => {
    // Ultra timer counts DOWN from ULTRA_DURATION_MS. At end, modeTimer=0.
    // elapsedMs = ULTRA_DURATION_MS - 0 = ULTRA_DURATION_MS
    const elapsed = ULTRA_DURATION_MS / 1000;
    const pieces = 20;
    const s = baseState({
      mode: GameMode.Ultra,
      piecesPlaced: pieces,
      modeTimer: 0,
      totalKeypresses: 60,
      finesseFaults: 0,
    });
    expect(computeGameStats(s).pps).toBeCloseTo(pieces / elapsed, 3);
  });

  it("Ultra pps mid-game uses time elapsed so far", () => {
    // Halfway through Ultra: modeTimer = ULTRA_DURATION_MS / 2 (half remaining)
    const half = ULTRA_DURATION_MS / 2;
    const elapsed = half / 1000; // half of duration has elapsed
    const pieces = 10;
    const s = baseState({
      mode: GameMode.Ultra,
      piecesPlaced: pieces,
      modeTimer: half,
      totalKeypresses: 30,
      finesseFaults: 0,
    });
    expect(computeGameStats(s).pps).toBeCloseTo(pieces / elapsed, 3);
  });

  it("Marathon pps is unaffected by Ultra formula", () => {
    // Marathon timer counts UP — existing behavior unchanged
    const s = baseState({ piecesPlaced: 20, modeTimer: 10000, totalKeypresses: 60, finesseFaults: 0 });
    expect(computeGameStats(s).pps).toBeCloseTo(2.0, 3);
  });
});
