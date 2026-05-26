import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  drawKeyBindingsScreen,
  keyCodeDisplayName,
  getActionDisplayNames,
  buildReverseLookup,
  buildControlsHint,
} from "./key-bindings-ui.ts";
import type { InputAction } from "../core/types.ts";

describe("keyCodeDisplayName", () => {
  it("maps ArrowLeft to ←", () => {
    expect(keyCodeDisplayName("ArrowLeft")).toBe("←");
  });

  it("maps ArrowRight to →", () => {
    expect(keyCodeDisplayName("ArrowRight")).toBe("→");
  });

  it("maps ArrowUp to ↑", () => {
    expect(keyCodeDisplayName("ArrowUp")).toBe("↑");
  });

  it("maps ArrowDown to ↓", () => {
    expect(keyCodeDisplayName("ArrowDown")).toBe("↓");
  });

  it("maps Space verbatim", () => {
    expect(keyCodeDisplayName("Space")).toBe("Space");
  });

  it("strips Key prefix for letter keys", () => {
    expect(keyCodeDisplayName("KeyZ")).toBe("Z");
    expect(keyCodeDisplayName("KeyC")).toBe("C");
    expect(keyCodeDisplayName("KeyM")).toBe("M");
  });

  it("strips Shift prefix", () => {
    expect(keyCodeDisplayName("ShiftLeft")).toBe("Shift");
    expect(keyCodeDisplayName("ShiftRight")).toBe("Shift");
  });

  it("maps Escape to Esc", () => {
    expect(keyCodeDisplayName("Escape")).toBe("Esc");
  });

  it("maps Enter verbatim", () => {
    expect(keyCodeDisplayName("Enter")).toBe("Enter");
  });

  it("returns the original code for unexpected inputs", () => {
    expect(keyCodeDisplayName("F1")).toBe("F1");
  });
});

describe("buildReverseLookup", () => {
  it("maps each action type to its key display names", () => {
    const bindings: Record<string, InputAction> = {
      ArrowLeft: { type: "MoveLeft" },
      KeyR: { type: "MoveLeft" },
      Space: { type: "HardDrop" },
    };
    const lookup = buildReverseLookup(bindings);
    expect(lookup["MoveLeft"]).toEqual(["←", "R"]);
    expect(lookup["HardDrop"]).toEqual(["Space"]);
  });

  it("returns empty array for unmapped actions", () => {
    const lookup = buildReverseLookup({});
    expect(lookup["MoveLeft"]).toEqual([]);
  });
});

describe("getActionDisplayNames", () => {
  it("returns all action labels", () => {
    const labels = getActionDisplayNames();
    expect(labels.length).toBe(11);
    expect(labels[0].action).toBe("MoveLeft");
    expect(labels[0].label).toBe("Move Left");
    expect(labels[10].action).toBe("KeyBindings");
    expect(labels[10].label).toBe("Key Bindings");
  });
});

describe("buildControlsHint", () => {
  it("includes all expected action keys in the hint", () => {
    const bindings: Record<string, InputAction> = {
      ArrowLeft: { type: "MoveLeft" },
      ArrowRight: { type: "MoveRight" },
      ArrowDown: { type: "SoftDrop" },
      Space: { type: "HardDrop" },
      ArrowUp: { type: "RotateCW" },
      KeyX: { type: "RotateCCW" },
      KeyC: { type: "Hold" },
      KeyP: { type: "Pause" },
      KeyM: { type: "Mute" },
      KeyK: { type: "KeyBindings" },
    };
    const hint = buildControlsHint(bindings, false);
    expect(hint).toContain("←");
    expect(hint).toContain("→");
    expect(hint).toContain("Space");
    expect(hint).toContain("C");
    expect(hint).toContain("K");
  });

  it("includes level controls in marathon mode", () => {
    const bindings: Record<string, InputAction> = {
      ArrowLeft: { type: "MoveLeft" },
      ArrowRight: { type: "MoveRight" },
      ArrowDown: { type: "SoftDrop" },
      Space: { type: "HardDrop" },
      ArrowUp: { type: "RotateCW" },
      KeyX: { type: "RotateCCW" },
      KeyC: { type: "Hold" },
      KeyP: { type: "Pause" },
      KeyM: { type: "Mute" },
      KeyK: { type: "KeyBindings" },
    };
    const hint = buildControlsHint(bindings, true);
    expect(hint).toContain("↑");
    expect(hint).toContain("level");
  });

  it("reflects custom bindings", () => {
    const bindings: Record<string, InputAction> = {
      KeyA: { type: "MoveLeft" },
      KeyD: { type: "MoveRight" },
    };
    const hint = buildControlsHint(bindings, false);
    expect(hint).toContain("A");
    expect(hint).toContain("D");
  });

  it("does not crash with empty bindings", () => {
    expect(() => buildControlsHint({}, false)).not.toThrow();
  });
});

describe("drawKeyBindingsScreen", () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      fillRect: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: "",
      lineWidth: 1,
      textAlign: "",
      font: "",
      fillStyle: "",
      letterSpacing: "",
    } as unknown as CanvasRenderingContext2D;
  });

  it("renders without throwing with default bindings", () => {
    const bindings: Record<string, InputAction> = {
      ArrowLeft: { type: "MoveLeft" },
      ArrowRight: { type: "MoveRight" },
      ArrowDown: { type: "SoftDrop" },
    };
    expect(() => {
      drawKeyBindingsScreen(ctx, 800, 600, bindings, 0, false);
    }).not.toThrow();
  });

  it("renders without throwing in waiting-for-key mode", () => {
    const bindings: Record<string, InputAction> = {
      ArrowLeft: { type: "MoveLeft" },
    };
    expect(() => {
      drawKeyBindingsScreen(ctx, 800, 600, bindings, 0, true);
    }).not.toThrow();
  });

  it("calls fillText at least once (renders content)", () => {
    const bindings: Record<string, InputAction> = {
      ArrowLeft: { type: "MoveLeft" },
    };
    drawKeyBindingsScreen(ctx, 800, 600, bindings, 0, false);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
