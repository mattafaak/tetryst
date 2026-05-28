import { describe, it, expect } from "vitest";
import { computeGameStats } from "./stats.ts";
import { baseState } from "../test-utils/test-utils.ts";

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
