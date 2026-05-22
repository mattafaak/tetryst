import { describe, it, expect } from "vitest";
import { createBag, drawFromBag, createFirstBag } from "./randomizer.ts";
import { TetriminoType } from "./types.ts";

const ALL_TYPES: TetriminoType[] = [
  TetriminoType.I,
  TetriminoType.O,
  TetriminoType.T,
  TetriminoType.S,
  TetriminoType.Z,
  TetriminoType.J,
  TetriminoType.L,
];

const VALID_FIRST_TYPES = new Set([
  TetriminoType.I,
  TetriminoType.J,
  TetriminoType.L,
  TetriminoType.T,
]);

describe("createBag", () => {
  it("returns an array of length 7", () => {
    const bag = createBag();
    expect(bag).toHaveLength(7);
  });

  it("contains all 7 piece types with no duplicates", () => {
    const bag = createBag();
    expect(new Set(bag).size).toBe(7);
    for (const t of ALL_TYPES) {
      expect(bag).toContain(t);
    }
  });

  it("produces varied orderings across multiple calls", () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(createBag().join(","));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("drawFromBag", () => {
  it("returns the first element and a shortened bag", () => {
    const bag: TetriminoType[] = [
      TetriminoType.I,
      TetriminoType.O,
      TetriminoType.T,
    ];
    const result = drawFromBag(bag);

    expect(result.piece).toBe(TetriminoType.I);
    expect(result.bag).toHaveLength(2);
    expect(result.bag).toEqual([TetriminoType.O, TetriminoType.T]);
    expect(result.needsNewBag).toBe(false);
  });

  it("signals needsNewBag when bag has 1 element left", () => {
    const bag: TetriminoType[] = [TetriminoType.S];
    const result = drawFromBag(bag);

    expect(result.piece).toBe(TetriminoType.S);
    expect(result.bag).toHaveLength(0);
    expect(result.needsNewBag).toBe(true);
  });

  it("does not signal needsNewBag when bag has multiple elements left", () => {
    const bag: TetriminoType[] = [
      TetriminoType.I,
      TetriminoType.O,
      TetriminoType.T,
    ];
    const result = drawFromBag(bag);
    expect(result.needsNewBag).toBe(false);
  });

  it("creates a new bag when the given bag is empty", () => {
    const result = drawFromBag([]);

    expect(ALL_TYPES).toContain(result.piece);
    expect(result.bag).toHaveLength(6);
    expect(result.needsNewBag).toBe(false);
  });

  it("does not mutate the original bag array", () => {
    const bag: TetriminoType[] = [
      TetriminoType.J,
      TetriminoType.L,
      TetriminoType.T,
    ];
    const copy = [...bag];
    drawFromBag(bag);
    expect(bag).toEqual(copy);
  });
});

describe("createFirstBag", () => {
  it("ensures the first piece is I, J, L, or T", () => {
    for (let i = 0; i < 200; i++) {
      const bag = createFirstBag();
      expect(VALID_FIRST_TYPES.has(bag[0])).toBe(true);
      expect(bag).toHaveLength(7);
      expect(new Set(bag).size).toBe(7);
    }
  });
});

describe("distribution uniformity", () => {
  it("has reasonably uniform distribution over 1000 draws", () => {
    const counts: Record<string, number> = {};
    for (const t of ALL_TYPES) {
      counts[t] = 0;
    }

    let bag: TetriminoType[] = [];
    for (let i = 0; i < 1000; i++) {
      const result = drawFromBag(bag);
      counts[result.piece]++;
      bag = result.bag;
    }

    const expected = 1000 / 7; // ~142.86
    const tolerance = 50;
    for (const t of ALL_TYPES) {
      expect(counts[t]).toBeGreaterThanOrEqual(expected - tolerance);
      expect(counts[t]).toBeLessThanOrEqual(expected + tolerance);
    }
  });
});
