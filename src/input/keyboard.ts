import { type InputAction } from "../core/types.ts";
import { DAS_DELAY, ARR_RATE } from "../core/constants.ts";

interface KeyState {
  action: InputAction;
  pressed: boolean;
  dasTimer: number;
  arrTimer: number;
  dasCharged: boolean;
  sdrTimer: number;
}

/** Action types that get DAS/ARR auto-repeat (300ms delay, then 50ms repeat). */
const DAS_ACTION_TYPES = new Set(["MoveLeft", "MoveRight"]);

/** Action types that get SDR — Soft Drop Rate: no initial delay, repeat every ARR_RATE. */
const SDR_ACTION_TYPES = new Set(["SoftDrop"]);

/** Actions that become DAS-repeated in menu mode (Up/Down navigation). */
const MENU_NAV_ACTION_TYPES = new Set(["SoftDrop", "RotateCW"]);

function isDasAction(action: InputAction): boolean {
  return DAS_ACTION_TYPES.has(action.type);
}

function isSdrAction(action: InputAction): boolean {
  return SDR_ACTION_TYPES.has(action.type);
}

function isMenuNavAction(action: InputAction): boolean {
  return MENU_NAV_ACTION_TYPES.has(action.type);
}

type InputCallback = (action: InputAction) => void;

export class KeyboardHandler {
  private bindings: Record<string, InputAction>;
  private keys: Map<string, KeyState> = new Map();
  private callback: InputCallback | null = null;
  private rawKeyHandler: ((code: string) => void) | null = null;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private menuMode: boolean = false;

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

  /** Switch between menu navigation mode and game mode.
   *  In menu mode, SoftDrop (Down) and RotateCW (Up) use DAS timing
   *  instead of SDR/fire-once. Clears held-key state on switch. */
  setMenuMode(on: boolean): void {
    this.menuMode = on;
    this.keys.clear();
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

      const useDas =
        isDasAction(state.action) ||
        (this.menuMode && isMenuNavAction(state.action));

      // SDR: soft drop repeats immediately at ARR_RATE with no initial DAS delay
      // Only applies in game mode; in menu mode, SoftDrop uses DAS instead.
      if (!this.menuMode && isSdrAction(state.action)) {
        state.sdrTimer += dt;
        while (state.sdrTimer >= ARR_RATE) {
          state.sdrTimer -= ARR_RATE;
          this.fire(state.action);
        }
        continue;
      }

      // DAS: wait DAS_DELAY then repeat at ARR_RATE
      if (!useDas) continue;

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
      sdrTimer: 0,
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
