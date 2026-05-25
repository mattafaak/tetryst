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
    handler = new KeyboardHandler();
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
});
