import { describe, it, expect } from "vitest";
import { canonicalKeypresses, FINESSE_TABLE } from "./finesse.ts";
import { TetriminoType, RotationState } from "./types.ts";

// All pieces spawn at x=3 with rotation ZERO per constants.ts:
//   SPAWN_POSITION = { x: 3, y: 19 }   (non-I)
//   I_SPAWN_POSITION = { x: 3, y: 18 } (I)

describe("canonicalKeypresses — spawn position costs 0", () => {
  it("T at col 3, rotation ZERO = 0", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.ZERO, 3)).toBe(0);
  });
  it("I at col 3, rotation ZERO = 0", () => {
    expect(canonicalKeypresses(TetriminoType.I, RotationState.ZERO, 3)).toBe(0);
  });
  it("O at col 3, rotation ZERO = 0", () => {
    expect(canonicalKeypresses(TetriminoType.O, RotationState.ZERO, 3)).toBe(0);
  });
  it("J at col 3, rotation ZERO = 0", () => {
    expect(canonicalKeypresses(TetriminoType.J, RotationState.ZERO, 3)).toBe(0);
  });
  it("L at col 3, rotation ZERO = 0", () => {
    expect(canonicalKeypresses(TetriminoType.L, RotationState.ZERO, 3)).toBe(0);
  });
  it("S at col 3, rotation ZERO = 0", () => {
    expect(canonicalKeypresses(TetriminoType.S, RotationState.ZERO, 3)).toBe(0);
  });
  it("Z at col 3, rotation ZERO = 0", () => {
    expect(canonicalKeypresses(TetriminoType.Z, RotationState.ZERO, 3)).toBe(0);
  });
});

describe("canonicalKeypresses — one MoveLeft from spawn", () => {
  it("T at col 2, rotation ZERO = 1", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.ZERO, 2)).toBe(1);
  });
  it("T at col 1, rotation ZERO = 2", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.ZERO, 1)).toBe(2);
  });
  it("T at col 0, rotation ZERO = 3", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.ZERO, 0)).toBe(3);
  });
});

describe("canonicalKeypresses — one MoveRight from spawn", () => {
  it("T at col 4, rotation ZERO = 1", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.ZERO, 4)).toBe(1);
  });
  it("T at col 5, rotation ZERO = 2", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.ZERO, 5)).toBe(2);
  });
});

describe("canonicalKeypresses — rotation costs", () => {
  it("T at col 3, rotation R (one CW) = 1", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.R, 3)).toBe(1);
  });
  it("T at col 3, rotation L (one CCW) = 1", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.L, 3)).toBe(1);
  });
  it("T at col 3, rotation TWO (two rotations) = 2", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.TWO, 3)).toBe(2);
  });
});

describe("canonicalKeypresses — unreachable positions return Infinity", () => {
  it("out-of-bounds column 100 returns Infinity", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.ZERO, 100)).toBe(Infinity);
  });
  it("negative column -1 returns Infinity", () => {
    expect(canonicalKeypresses(TetriminoType.T, RotationState.ZERO, -1)).toBe(Infinity);
  });
});

describe("FINESSE_TABLE coverage", () => {
  it("table has entries for all 7 piece types", () => {
    const types = Object.values(TetriminoType);
    for (const t of types) {
      const hasEntry = [...FINESSE_TABLE.keys()].some((k) => k.startsWith(`${t}:`));
      expect(hasEntry, `Expected FINESSE_TABLE to have entries for ${t}`).toBe(true);
    }
  });

  it("all table values are non-negative integers", () => {
    for (const [key, val] of FINESSE_TABLE) {
      expect(Number.isInteger(val) && val >= 0, `Invalid value ${val} for key ${key}`).toBe(true);
    }
  });
});
