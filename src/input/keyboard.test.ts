/**
 * DAS/ARR input system tests for KeyboardHandler.
 *
 * Tests the timing of Delayed Auto Shift (DAS) and Auto Repeat Rate (ARR)
 * using a controlled timer and captured event listeners.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { KeyboardHandler } from "./keyboard.ts";
import type { InputAction } from "../core/types.ts";
import { DAS_DELAY, ARR_RATE } from "../core/constants.ts";
import { DEFAULT_BINDINGS } from "../core/key-bindings.ts";

// ── Mock window ──────────────────────────────────────────────────────────

let keyDownListeners: Array<(e: unknown) => void> = [];
let keyUpListeners: Array<(e: unknown) => void> = [];

beforeAll(() => {
  vi.stubGlobal("window", {
    addEventListener: (event: string, listener: (e: unknown) => void) => {
      if (event === "keydown") keyDownListeners.push(listener);
      if (event === "keyup") keyUpListeners.push(listener);
    },
    removeEventListener: (event: string, listener: (e: unknown) => void) => {
      if (event === "keydown") {
        keyDownListeners = keyDownListeners.filter((l) => l !== listener);
      }
      if (event === "keyup") {
        keyUpListeners = keyUpListeners.filter((l) => l !== listener);
      }
    },
  } as unknown as Window & typeof globalThis);
});

/** Simulate a keydown event. */
function pressKey(code: string): void {
  const event = { code, preventDefault: vi.fn(), type: "keydown" };
  for (const listener of keyDownListeners) listener(event);
}

/** Simulate a keyup event. */
function releaseKey(code: string): void {
  const event = { code, preventDefault: vi.fn(), type: "keyup" };
  for (const listener of keyUpListeners) listener(event);
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("KeyboardHandler", () => {
  let handler: KeyboardHandler;
  let actions: InputAction[];

  beforeEach(() => {
    actions = [];
    handler = new KeyboardHandler(DEFAULT_BINDINGS);
    handler.setCallback((action: InputAction) => {
      actions.push(action);
    });
    keyDownListeners = [];
    keyUpListeners = [];
  });

  afterEach(() => {
    handler.detach();
  });

  describe("basic key press", () => {
    it("fires a callback for DAS actions on keydown", () => {
      handler.attach();
      pressKey("ArrowLeft");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "MoveLeft" });
    });

    it("fires a callback for non-DAS actions on keydown", () => {
      handler.attach();
      pressKey("ArrowUp");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "RotateCW" });
    });

    it("fires callback for Hold key (KeyC)", () => {
      handler.attach();
      pressKey("KeyC");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "Hold" });
    });

    it("fires callback for Start (Enter)", () => {
      handler.attach();
      pressKey("Enter");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "Start" });
    });

    it("fires callback for Mute (KeyM)", () => {
      handler.attach();
      pressKey("KeyM");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "Mute" });
    });

    it("preventDefault is called for game keys", () => {
      handler.attach();
      const event = { code: "ArrowLeft", preventDefault: vi.fn(), type: "keydown" };
      for (const listener of keyDownListeners) listener(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("does not fire for unknown keys", () => {
      handler.attach();
      pressKey("F1");
      expect(actions).toHaveLength(0);
    });

    it("preventDefault is not called for unknown keys", () => {
      handler.attach();
      const event = { code: "F1", preventDefault: vi.fn(), type: "keydown" };
      for (const listener of keyDownListeners) listener(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("non-DAS keys fire once per press (no auto-repeat)", () => {
    it("holding a non-DAS key does not repeat", () => {
      handler.attach();
      pressKey("ArrowUp");
      expect(actions).toHaveLength(1);
      // Update many times with large dt — should not fire again
      for (let i = 0; i < 100; i++) handler.update(16);
      expect(actions).toHaveLength(1);
    });

    it("press, release, press fires twice", () => {
      handler.attach();
      pressKey("ArrowUp");
      releaseKey("ArrowUp");
      pressKey("ArrowUp");
      expect(actions).toHaveLength(2);
    });
  });

  describe("DAS/ARR timing", () => {
    it("initial press fires immediately, no DAS repeat before delay", () => {
      handler.attach();
      pressKey("ArrowLeft");
      expect(actions).toHaveLength(1);

      handler.update(DAS_DELAY - 1);
      expect(actions).toHaveLength(1);
    });

    it("fires first ARR repeat exactly when DAS charges", () => {
      handler.attach();
      pressKey("ArrowLeft");
      expect(actions).toHaveLength(1);

      handler.update(DAS_DELAY);
      expect(actions).toHaveLength(2); // initial + DAS charge fire
    });

    it("fires ARR repeats at ARR_RATE intervals after DAS charges", () => {
      handler.attach();
      pressKey("ArrowLeft");
      actions.length = 0;

      // Charge DAS — fires first repeat
      handler.update(DAS_DELAY);
      expect(actions).toHaveLength(1);
      actions.length = 0;

      // 2nd update: ARR timer ticks
      handler.update(ARR_RATE);
      expect(actions).toHaveLength(1);
      actions.length = 0;

      // 3rd update: another ARR tick
      handler.update(ARR_RATE);
      expect(actions).toHaveLength(1);
    });

    it("fires multiple ARR repeats in a single large dt after DAS is charged", () => {
      handler.attach();
      pressKey("ArrowLeft");
      actions.length = 0;

      // First call: charges DAS, fires 1
      handler.update(DAS_DELAY);
      actions.length = 0;

      // Second call: large dt produces multiple ARR ticks
      handler.update(ARR_RATE * 3);
      expect(actions.length).toBeGreaterThanOrEqual(3);
    });

    it("ARR timer carries over between updates", () => {
      handler.attach();
      pressKey("ArrowLeft");
      actions.length = 0;

      handler.update(DAS_DELAY);
      expect(actions).toHaveLength(1);
      actions.length = 0;

      // Just under ARR threshold
      handler.update(ARR_RATE - 1);
      expect(actions).toHaveLength(0);

      // Cross the threshold
      handler.update(2);
      expect(actions).toHaveLength(1);
    });
  });

  describe("multi-key scenarios", () => {
    it("pressing a second key while first is held starts independent DAS", () => {
      handler.attach();
      pressKey("ArrowLeft");
      actions.length = 0;

      pressKey("ArrowRight");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "MoveRight" });
    });

    it("releasing a DAS key during ARR stops further repeats", () => {
      handler.attach();
      pressKey("ArrowLeft");
      actions.length = 0;

      // Charge DAS for 2 ARR ticks
      handler.update(DAS_DELAY);
      handler.update(ARR_RATE * 2);
      expect(actions.length).toBeGreaterThanOrEqual(2);
      actions.length = 0;

      releaseKey("ArrowLeft");

      handler.update(ARR_RATE * 10);
      expect(actions).toHaveLength(0);
    });

    it("reset clears all key state", () => {
      handler.attach();
      pressKey("ArrowLeft");
      pressKey("ArrowRight");
      actions.length = 0;

      handler.reset();

      handler.update(DAS_DELAY + ARR_RATE);
      expect(actions).toHaveLength(0);
    });
  });

  describe("detach", () => {
    it("detach removes event listeners", () => {
      handler.attach();
      handler.detach();
      pressKey("ArrowLeft");
      expect(actions).toHaveLength(0);
    });

    it("detach clears key state for fresh start on re-attach", () => {
      handler.attach();
      pressKey("ArrowLeft");
      handler.detach();

      handler.attach();
      // Clear the old action from the list
      actions.length = 0;
      pressKey("ArrowRight");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "MoveRight" });
    });
  });

  describe("DAS resets between pieces", () => {
    it("release and re-press restarts DAS from full delay", () => {
      handler.attach();
      pressKey("ArrowLeft");
      expect(actions).toHaveLength(1);
      actions.length = 0;

      releaseKey("ArrowLeft");

      pressKey("ArrowLeft");
      expect(actions).toHaveLength(1);

      // Should need full DAS delay before repeat
      handler.update(DAS_DELAY - 1);
      expect(actions).toHaveLength(1);

      handler.update(1);
      expect(actions).toHaveLength(2);
    });
  });

  describe("binding lifecycle integration", () => {
    it("setBindings replaces active bindings at runtime", () => {
      handler.attach();
      // Initial: ArrowLeft fires MoveLeft
      pressKey("ArrowLeft");
      expect(actions[0]).toEqual({ type: "MoveLeft" });
      actions.length = 0;

      // Remap: ArrowLeft now fires MoveRight
      handler.setBindings({ ArrowLeft: { type: "MoveRight" } });
      pressKey("ArrowLeft");
      expect(actions[0]).toEqual({ type: "MoveRight" });
    });

    it("a key removed from bindings no longer fires", () => {
      handler.attach();
      pressKey("ArrowLeft");
      expect(actions).toHaveLength(1);
      actions.length = 0;

      // Remove ArrowLeft from bindings
      handler.setBindings({});
      pressKey("ArrowLeft");
      expect(actions).toHaveLength(0);
    });

    it("bindings persist across detach/attach cycle when updated externally", () => {
      const dynamicBindings: Record<string, InputAction> = {
        KeyR: { type: "RotateCW" },
      };
      handler = new KeyboardHandler(dynamicBindings);
      handler.setCallback((a) => actions.push(a));
      keyDownListeners = [];
      keyUpListeners = [];

      handler.attach();
      pressKey("KeyR");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "RotateCW" });
      actions.length = 0;

      // Detach and re-attach
      handler.detach();
      keyDownListeners = [];
      keyUpListeners = [];
      handler.attach();

      pressKey("KeyR");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "RotateCW" });
    });

    it("remap: old key stops firing, new key fires the action", () => {
      // Start with default-like bindings where ArrowUp → RotateCW
      const bindings: Record<string, InputAction> = {
        ArrowUp: { type: "RotateCW" },
      };
      handler = new KeyboardHandler(bindings);
      handler.setCallback((a) => actions.push(a));
      keyDownListeners = [];
      keyUpListeners = [];
      handler.attach();

      pressKey("ArrowUp");
      expect(actions[0]).toEqual({ type: "RotateCW" });
      actions.length = 0;

      // Remap: ArrowUp is removed, KeyR takes over
      handler.setBindings({ KeyR: { type: "RotateCW" } });

      // Old key does nothing
      pressKey("ArrowUp");
      expect(actions).toHaveLength(0);

      // New key fires RotateCW
      pressKey("KeyR");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "RotateCW" });
    });

    it("remap from DAS to non-DAS stops auto-repeat", () => {
      const bindings: Record<string, InputAction> = {
        ArrowLeft: { type: "MoveLeft" },
      };
      handler = new KeyboardHandler(bindings);
      handler.setCallback((a) => actions.push(a));
      keyDownListeners = [];
      keyUpListeners = [];
      handler.attach();

      // Remap ArrowLeft to non-DAS (Hold)
      handler.setBindings({ ArrowLeft: { type: "Hold" } });
      pressKey("ArrowLeft");
      expect(actions[0]).toEqual({ type: "Hold" });
      actions.length = 0;

      // Should not repeat after DAS delay
      handler.update(DAS_DELAY + ARR_RATE * 5);
      expect(actions).toHaveLength(0);
    });
  });

  describe("rawKeyHandler", () => {
    it("captures raw key codes when set", () => {
      handler.attach();
      const captured: string[] = [];
      handler.setRawKeyHandler((code: string) => { captured.push(code); });

      pressKey("KeyA");
      pressKey("Enter");
      expect(captured).toEqual(["KeyA", "Enter"]);
    });

    it("bypasses normal mapping when raw key handler is active", () => {
      handler.attach();
      handler.setRawKeyHandler(() => {});

      pressKey("ArrowLeft");
      expect(actions).toHaveLength(0);
    });

    it("setting rawKeyHandler to null restores normal mapping", () => {
      handler.attach();
      handler.setRawKeyHandler(() => {});
      handler.setRawKeyHandler(null);

      pressKey("ArrowLeft");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "MoveLeft" });
    });

    it("raw handler combined with setBindings: capture then apply", () => {
      // Simulate the full onBindingKeyCapture flow:
      // 1. Set raw handler
      // 2. Capture a key code via the handler
      // 3. Update bindings
      // 4. Restore normal mapping
      handler.attach();
      const captured: string[] = [];
      handler.setRawKeyHandler((code: string) => {
        captured.push(code);
        // Simulate the key capture action
        handler.setBindings({ KeyR: { type: "RotateCW" } });
        handler.setRawKeyHandler(null);
      });

      // Press the key to capture
      pressKey("KeyR");
      expect(captured).toEqual(["KeyR"]);

      // Raw handler is null now, KeyR should fire RotateCW through normal mapping
      pressKey("KeyR");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "RotateCW" });
    });
  });

  describe("dynamic bindings", () => {
    it("fires action from custom binding", () => {
      const customBindings: Record<string, InputAction> = {
        KeyR: { type: "RotateCW" },
      };
      handler = new KeyboardHandler(customBindings);
      handler.setCallback((a) => actions.push(a));
      keyDownListeners = [];
      keyUpListeners = [];
      handler.attach();

      pressKey("KeyR");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "RotateCW" });
    });

    it("does not fire for a key removed from bindings", () => {
      // Create bindings without ArrowUp
      const customBindings: Record<string, InputAction> = {
        ...DEFAULT_BINDINGS,
      };
      delete customBindings["ArrowUp"];
      handler = new KeyboardHandler(customBindings);
      handler.setCallback((a) => actions.push(a));
      keyDownListeners = [];
      keyUpListeners = [];
      handler.attach();

      pressKey("ArrowUp");
      expect(actions).toHaveLength(0);
    });

    it("a key remapped to a DAS action auto-repeats", () => {
      // Remap KeyR to MoveLeft (a DAS action)
      const customBindings: Record<string, InputAction> = {
        KeyR: { type: "MoveLeft" },
      };
      handler = new KeyboardHandler(customBindings);
      handler.setCallback((a) => actions.push(a));
      keyDownListeners = [];
      keyUpListeners = [];
      handler.attach();

      pressKey("KeyR");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "MoveLeft" });

      // Charge DAS — should repeat
      handler.update(DAS_DELAY);
      expect(actions.length).toBeGreaterThanOrEqual(2);
    });

    it("a key remapped from DAS to non-DAS fires only once", () => {
      // Remap ArrowLeft (previously DAS) to Hold (non-DAS)
      const customBindings: Record<string, InputAction> = {
        ...DEFAULT_BINDINGS,
        ArrowLeft: { type: "Hold" },
      };
      handler = new KeyboardHandler(customBindings);
      handler.setCallback((a) => actions.push(a));
      keyDownListeners = [];
      keyUpListeners = [];
      handler.attach();

      pressKey("ArrowLeft");
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({ type: "Hold" });

      // Should not repeat
      handler.update(DAS_DELAY * 10);
      expect(actions).toHaveLength(1);
    });
  });
});
