import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  drawKeyBindingsScreen,
  keyCodeDisplayName,
  getActionDisplayNames,
  buildReverseLookup,
  buildControlsHint,
  DAS_ROW_IDX,
  ARR_ROW_IDX,
  SDR_ROW_IDX,
  STANDARD_PRESET_IDX,
  INSTANT_PRESET_IDX,
  RESTORE_KEYS_IDX,
} from "./key-bindings-ui.ts";
import type { DASSettings } from "../core/das-settings.ts";
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

  // ── Timing section rendering ────────────────────────────────────────────

  const defaultDAS: DASSettings = { dasDelay: 300, arrRate: 50, sdrRate: 50 };
  const stdBindings: Record<string, InputAction> = {
    ArrowLeft: { type: "MoveLeft" },
    ArrowRight: { type: "MoveRight" },
    ArrowDown: { type: "SoftDrop" },
  };

  it("renders without throwing with Restore row selected", () => {
    expect(() => {
      drawKeyBindingsScreen(ctx, 800, 600, stdBindings, RESTORE_KEYS_IDX, false, defaultDAS);
    }).not.toThrow();
  });

  it("renders without throwing with DAS row selected", () => {
    expect(() => {
      drawKeyBindingsScreen(ctx, 800, 600, stdBindings, DAS_ROW_IDX, false, defaultDAS);
    }).not.toThrow();
  });

  it("renders without throwing with ARR row selected", () => {
    expect(() => {
      drawKeyBindingsScreen(ctx, 800, 600, stdBindings, ARR_ROW_IDX, false, defaultDAS);
    }).not.toThrow();
  });

  it("renders without throwing with SDR row selected", () => {
    expect(() => {
      drawKeyBindingsScreen(ctx, 800, 600, stdBindings, SDR_ROW_IDX, false, defaultDAS);
    }).not.toThrow();
  });

  it("renders without throwing with Standard preset selected", () => {
    expect(() => {
      drawKeyBindingsScreen(ctx, 800, 600, stdBindings, STANDARD_PRESET_IDX, false, defaultDAS);
    }).not.toThrow();
  });

  it("renders without throwing with Instant preset selected", () => {
    const instant: DASSettings = { dasDelay: 0, arrRate: 0, sdrRate: 0 };
    expect(() => {
      drawKeyBindingsScreen(ctx, 800, 600, stdBindings, INSTANT_PRESET_IDX, false, instant);
    }).not.toThrow();
  });

  it("renders DAS value text when DAS row selected", () => {
    vi.mocked(ctx.fillText).mockClear();
    drawKeyBindingsScreen(ctx, 800, 600, stdBindings, DAS_ROW_IDX, false, defaultDAS);
    const texts = vi.mocked(ctx.fillText).mock.calls.map(([t]) => String(t));
    const hasDASValue = texts.some((t) => t.includes("300") && t.includes("ms"));
    expect(hasDASValue).toBe(true);
  });

  it("shows arrow decoration (← value →) when a timing row is focused", () => {
    vi.mocked(ctx.fillText).mockClear();
    drawKeyBindingsScreen(ctx, 800, 600, stdBindings, ARR_ROW_IDX, false, defaultDAS);
    const texts = vi.mocked(ctx.fillText).mock.calls.map(([t]) => String(t));
    const hasArrows = texts.some((t) => t.includes("←") && t.includes("→"));
    expect(hasArrows).toBe(true);
  });

  it("shows preset labels in rendered output", () => {
    vi.mocked(ctx.fillText).mockClear();
    drawKeyBindingsScreen(ctx, 800, 600, stdBindings, STANDARD_PRESET_IDX, false, defaultDAS);
    const texts = vi.mocked(ctx.fillText).mock.calls.map(([t]) => String(t));
    expect(texts.some((t) => t === "Standard")).toBe(true);
    expect(texts.some((t) => t === "Fast")).toBe(true);
    expect(texts.some((t) => t === "Instant")).toBe(true);
  });

  it("shows correct hint text for timing rows", () => {
    vi.mocked(ctx.fillText).mockClear();
    drawKeyBindingsScreen(ctx, 800, 600, stdBindings, DAS_ROW_IDX, false, defaultDAS);
    const texts = vi.mocked(ctx.fillText).mock.calls.map(([t]) => String(t));
    // Timing-row hint includes "adjust value"
    const hasTimingHint = texts.some((t) => t.includes("adjust"));
    expect(hasTimingHint).toBe(true);
  });

  it("shows correct hint text for preset rows", () => {
    vi.mocked(ctx.fillText).mockClear();
    drawKeyBindingsScreen(ctx, 800, 600, stdBindings, STANDARD_PRESET_IDX, false, defaultDAS);
    const texts = vi.mocked(ctx.fillText).mock.calls.map(([t]) => String(t));
    // Preset-row hint includes "apply preset"
    const hasPresetHint = texts.some((t) => t.includes("apply") || t.includes("preset"));
    expect(hasPresetHint).toBe(true);
  });

  it("shows standard action-row hint for action rows", () => {
    vi.mocked(ctx.fillText).mockClear();
    drawKeyBindingsScreen(ctx, 800, 600, stdBindings, 0, false, defaultDAS);
    const texts = vi.mocked(ctx.fillText).mock.calls.map(([t]) => String(t));
    // Action-row hint includes "rebind"
    const hasRebindHint = texts.some((t) => t.includes("rebind"));
    expect(hasRebindHint).toBe(true);
  });
});
