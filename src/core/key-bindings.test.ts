import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_BINDINGS,
  loadBindings,
  saveBindings,
  resetBindings,
  validateBindings,
  getActionType,
  actionTypeFromBinding,
  ALL_ACTION_TYPES,
} from "./key-bindings.ts";
import type { InputAction } from "./types.ts";

const STORAGE_KEY = "tetryst_keybindings";

function mockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

describe("key-bindings", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockStorage());
  });

  describe("DEFAULT_BINDINGS", () => {
    it("includes all 10 action types", () => {
      const mappedTypes = new Set(Object.values(DEFAULT_BINDINGS).map((a) => a.type));
      for (const t of ALL_ACTION_TYPES) {
        expect(mappedTypes.has(t as any)).toBe(true);
      }
    });

    it("each action has at least one key mapped", () => {
      for (const t of ALL_ACTION_TYPES) {
        const keys = Object.entries(DEFAULT_BINDINGS)
          .filter(([, a]) => a.type === t)
          .map(([k]) => k);
        expect(keys.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("maps ArrowLeft to MoveLeft", () => {
      expect(DEFAULT_BINDINGS["ArrowLeft"]).toEqual({ type: "MoveLeft" });
    });

    it("maps ArrowUp and KeyZ to RotateCW", () => {
      expect(DEFAULT_BINDINGS["ArrowUp"]).toEqual({ type: "RotateCW" });
      expect(DEFAULT_BINDINGS["KeyZ"]).toEqual({ type: "RotateCW" });
    });
  });

  describe("loadBindings", () => {
    it("returns default bindings when localStorage is empty", () => {
      const bindings = loadBindings();
      expect(bindings).toEqual(DEFAULT_BINDINGS);
    });

    it("returns saved bindings when localStorage has valid data", () => {
      const custom: Record<string, InputAction> = {
        ArrowLeft: { type: "MoveRight" },
        Space: { type: "HardDrop" },
      };
      saveBindings(custom);
      const loaded = loadBindings();
      // Should include custom mappings plus defaults for unmapped actions
      expect(loaded["ArrowLeft"]).toEqual({ type: "MoveRight" });
      expect(loaded["Space"]).toEqual({ type: "HardDrop" });
      // Unmapped actions should retain defaults
      expect(loaded["ArrowUp"]).toEqual({ type: "RotateCW" });
    });

    it("returns defaults when localStorage has invalid JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not-json");
      const bindings = loadBindings();
      expect(bindings).toEqual(DEFAULT_BINDINGS);
    });

    it("returns defaults when localStorage has wrong shape (non-object)", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify("string"));
      const bindings = loadBindings();
      expect(bindings).toEqual(DEFAULT_BINDINGS);
    });

    it("filters out unknown action types from stored data", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ArrowLeft: "MoveLeft",
        SomeKey: "UnknownAction",
      }));
      const loaded = loadBindings();
      expect(loaded["SomeKey"]).toBeUndefined();
      expect(loaded["ArrowLeft"]).toEqual({ type: "MoveLeft" });
    });

    it("fills in missing actions from defaults after partial load", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ArrowLeft: "MoveLeft",
      }));
      const loaded = loadBindings();
      // MoveLeft has ArrowLeft, others should come from defaults
      expect(loaded["ArrowLeft"]).toEqual({ type: "MoveLeft" });
      expect(loaded["ArrowRight"]).toEqual({ type: "MoveRight" });
    });
  });

  describe("saveBindings", () => {
    it("persists bindings to localStorage", () => {
      const bindings: Record<string, InputAction> = {
        KeyA: { type: "MoveLeft" },
      };
      saveBindings(bindings);
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed["KeyA"]).toBe("MoveLeft");
    });

    it("overwrites previous stored data", () => {
      saveBindings({ KeyA: { type: "MoveLeft" } });
      saveBindings({ KeyB: { type: "MoveRight" } });
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(parsed["KeyA"]).toBeUndefined();
      expect(parsed["KeyB"]).toBe("MoveRight");
    });
  });

  describe("resetBindings", () => {
    it("returns the default bindings", () => {
      const reset = resetBindings();
      expect(reset).toEqual(DEFAULT_BINDINGS);
    });

    it("clears localStorage", () => {
      saveBindings({ KeyA: { type: "MoveLeft" } });
      resetBindings();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("validateBindings", () => {
    it("returns empty array for valid default bindings", () => {
      const warnings = validateBindings(DEFAULT_BINDINGS);
      expect(warnings).toEqual([]);
    });

    it("returns warning when an action has no keys mapped", () => {
      // Create bindings missing Mute
      const partial: Record<string, InputAction> = {
        ArrowLeft: { type: "MoveLeft" },
      };
      const warnings = validateBindings(partial);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      expect(warnings.some((w) => w.includes("Mute"))).toBe(true);
    });
  });

  describe("getActionType / actionTypeFromBinding", () => {
    it("getActionType returns the type string of an InputAction", () => {
      expect(getActionType({ type: "MoveLeft" })).toBe("MoveLeft");
      expect(getActionType({ type: "HardDrop" })).toBe("HardDrop");
    });

    it("actionTypeFromBinding converts stored string to InputAction", () => {
      expect(actionTypeFromBinding("MoveLeft")).toEqual({ type: "MoveLeft" });
      expect(actionTypeFromBinding("Hold")).toEqual({ type: "Hold" });
    });

    it("actionTypeFromBinding throws for unknown action type", () => {
      expect(() => actionTypeFromBinding("FlyAway" as any)).toThrow();
    });
  });
});
