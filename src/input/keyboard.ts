import { type InputAction } from "../core/types.ts";
import { DAS_DELAY, ARR_RATE } from "../core/constants.ts";

interface KeyState {
  action: InputAction;
  pressed: boolean;
  dasTimer: number;
  arrTimer: number;
  dasCharged: boolean;
}

/** Action types that get DAS/ARR auto-repeat processing. */
const DAS_ACTION_TYPES = new Set(["MoveLeft", "MoveRight", "SoftDrop"]);

function isDasAction(action: InputAction): boolean {
  return DAS_ACTION_TYPES.has(action.type);
}

type InputCallback = (action: InputAction) => void;

export class KeyboardHandler {
  private bindings: Record<string, InputAction>;
  private keys: Map<string, KeyState> = new Map();
  private callback: InputCallback | null = null;
  private rawKeyHandler: ((code: string) => void) | null = null;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor(bindings: Record<string, InputAction>) {
    this.bindings = bindings;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  setCallback(cb: InputCallback): void {
    this.callback = cb;
  }

  /** When set, every keydown event bypasses normal mapping and fires this
   *  handler with the raw event.code instead. Set to null to restore. */
  setRawKeyHandler(handler: ((code: string) => void) | null): void {
    this.rawKeyHandler = handler;
  }

  attach(): void {
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
  }

  detach(): void {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.keys.clear();
  }

  update(dt: number): void {
    for (const [, state] of this.keys) {
      if (!state.pressed) continue;

      // Only DAS actions auto-repeat
      if (!isDasAction(state.action)) continue;

      if (!state.dasCharged) {
        state.dasTimer += dt;
        if (state.dasTimer >= DAS_DELAY) {
          state.dasCharged = true;
          state.arrTimer = 0;
          this.fire(state.action);
        }
      } else {
        state.arrTimer += dt;
        while (state.arrTimer >= ARR_RATE) {
          state.arrTimer -= ARR_RATE;
          this.fire(state.action);
        }
      }
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    // When a raw key handler is active, bypass normal mapping entirely.
    // All keys go to the handler, and we prevent default so game keys don't
    // scroll the page during rebinding.
    if (this.rawKeyHandler) {
      e.preventDefault();
      this.rawKeyHandler(e.code);
      return;
    }

    const action = this.bindings[e.code];
    if (!action) return;

    e.preventDefault();

    // Fire on first press only (ignore held-key auto-repeat from OS)
    if (this.keys.get(e.code)?.pressed) return;

    this.keys.set(e.code, {
      action,
      pressed: true,
      dasTimer: 0,
      arrTimer: 0,
      dasCharged: false,
    });

    this.fire(action);
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (this.isGameKey(e.code)) {
      e.preventDefault();
    }

    const state = this.keys.get(e.code);
    if (state) {
      state.pressed = false;
      this.keys.delete(e.code);
    }
  }

  private fire(action: InputAction): void {
    this.callback?.(action);
  }

  private isGameKey(code: string): boolean {
    return code in this.bindings;
  }

  reset(): void {
    this.keys.clear();
  }

  /** Replace the active bindings at runtime (e.g., after user rebinds).
   *  Clears all tracked key state since old mappings are no longer valid. */
  setBindings(bindings: Record<string, InputAction>): void {
    this.bindings = bindings;
    this.keys.clear();
  }
}
