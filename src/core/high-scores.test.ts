import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadHighScores, saveHighScore, clearScoresCache } from "./high-scores.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

describe("high-scores", () => {
  let storage: ReturnType<typeof mockStorage>;

  beforeEach(() => {
    storage = mockStorage();
    vi.stubGlobal("localStorage", storage);
    clearScoresCache();
  });

  it("returns empty array when localStorage is empty", () => {
    expect(loadHighScores("Marathon")).toEqual([]);
  });

  it("saves and retrieves a score", () => {
    saveHighScore({ score: 5000, level: 3, lines: 40, mode: "Marathon" });
    const scores = loadHighScores("Marathon");
    expect(scores).toHaveLength(1);
    expect(scores[0].score).toBe(5000);
    expect(scores[0].level).toBe(3);
    expect(scores[0].lines).toBe(40);
    expect(scores[0].mode).toBe("Marathon");
  });

  it("sorts results descending by score", () => {
    saveHighScore({ score: 1000, level: 1, lines: 10, mode: "Marathon" });
    saveHighScore({ score: 5000, level: 3, lines: 40, mode: "Marathon" });
    saveHighScore({ score: 3000, level: 2, lines: 25, mode: "Marathon" });
    const scores = loadHighScores("Marathon");
    expect(scores[0].score).toBe(5000);
    expect(scores[1].score).toBe(3000);
    expect(scores[2].score).toBe(1000);
  });

  it("keeps only the top 10 entries", () => {
    for (let i = 0; i < 12; i++) {
      saveHighScore({ score: i * 100, level: 0, lines: 0, mode: "Marathon" });
    }
    const scores = loadHighScores("Marathon");
    expect(scores).toHaveLength(10);
    expect(scores[0].score).toBe(1100);
  });

  it("uses separate storage keys for different modes", () => {
    saveHighScore({ score: 9999, level: 5, lines: 50, mode: "Marathon" });
    saveHighScore({ score: 120000, level: 0, lines: 40, mode: "Sprint" });
    expect(loadHighScores("Marathon")).toHaveLength(1);
    expect(loadHighScores("Sprint")).toHaveLength(1);
    expect(loadHighScores("Marathon")[0].score).toBe(9999);
    expect(loadHighScores("Sprint")[0].score).toBe(120000);
  });

  it("returns empty array for malformed JSON", () => {
    storage.setItem("tetryst_hs_Marathon", "not-json{{{");
    expect(loadHighScores("Marathon")).toEqual([]);
  });

  it("saving the same score twice creates two entries", () => {
    saveHighScore({ score: 500, level: 1, lines: 10, mode: "Marathon" });
    saveHighScore({ score: 500, level: 1, lines: 10, mode: "Marathon" });
    expect(loadHighScores("Marathon")).toHaveLength(2);
  });

  it("rejects corrupt data with invalid fields", () => {
    storage.setItem("tetryst_hs_Marathon", JSON.stringify([{ score: -100, level: 1, lines: 0, mode: "Marathon", date: "x" }]));
    expect(loadHighScores("Marathon")).toEqual([]);
    expect(storage.getItem("tetryst_hs_Marathon")).toBeNull();
  });

  it("rejects data with unknown mode string", () => {
    storage.setItem("tetryst_hs_Marathon", JSON.stringify([{ score: 100, level: 1, lines: 0, mode: "InvalidMode", date: "x" }]));
    expect(loadHighScores("Marathon")).toEqual([]);
  });

  it("rejects data with missing fields", () => {
    storage.setItem("tetryst_hs_Marathon", JSON.stringify([{ score: 100 }]));
    expect(loadHighScores("Marathon")).toEqual([]);
  });

  it("rejects non-array JSON data", () => {
    storage.setItem("tetryst_hs_Marathon", JSON.stringify({ score: 100, level: 1 }));
    expect(loadHighScores("Marathon")).toEqual([]);
  });

  describe("scoresCache (25.8)", () => {
    it("caches loadHighScores results across repeated calls", () => {
      clearScoresCache();
      const getItemSpy = vi.spyOn(storage, "getItem");

      // First call: cache miss, reads from storage
      const first = loadHighScores("Marathon");
      expect(getItemSpy).toHaveBeenCalledTimes(1);

      // Second call: cache hit, no storage access
      getItemSpy.mockClear();
      const second = loadHighScores("Marathon");
      expect(getItemSpy).not.toHaveBeenCalled();
      expect(second).toEqual(first);
    });

    it("invalidates cache on saveHighScore", () => {
      clearScoresCache();
      loadHighScores("Marathon"); // populate cache

      const getItemSpy = vi.spyOn(storage, "getItem");
      getItemSpy.mockClear();

      // Save a new high score — this invalidates the cache
      saveHighScore({ score: 5000, level: 10, lines: 50, mode: "Marathon" });

      // Next load should re-read from storage (cache was invalidated)
      getItemSpy.mockClear();
      loadHighScores("Marathon");
      expect(getItemSpy).toHaveBeenCalledTimes(1);
    });
  });
});
