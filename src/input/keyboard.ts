import { type InputAction } from "../core/types.ts";
import { DAS_DELAY, ARR_RATE } from "../core/constants.ts";

interface KeyState {
  action: InputAction;
  pressed: boolean;
  dasTimer: number;
  arrTimer: number;
  dasCharged: boolean;
}

const DAS_ACTIONS: Record<string, InputAction> = {
  ArrowLeft: { type: "MoveLeft" },
  ArrowRight: { type: "MoveRight" },
  ArrowDown: { type: "SoftDrop" },
};

const NON_DAS_ACTIONS: Record<string, InputAction> = {
  ArrowUp: { type: "RotateCW" },
  KeyZ: { type: "RotateCW" },
  KeyX: { type: "RotateCCW" },
  Space: { type: "HardDrop" },
  KeyC: { type: "Hold" },
  ShiftLeft: { type: "Hold" },
  ShiftRight: { type: "Hold" },
  KeyP: { type: "Pause" },
  Escape: { type: "Pause" },
  Enter: { type: "Start" },
  KeyM: { type: "Mute" },
};

export type InputCallback = (action: InputAction) => void;

export class KeyboardHandler {
  private keys: Map<string, KeyState> = new Map();
  private callback: InputCallback | null = null;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  setCallback(cb: InputCallback): void {
    this.callback = cb;
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
    for (const [code, state] of this.keys) {
      if (!state.pressed) continue;

      // Only process DAS/ARR for movement and soft-drop keys
      if (!(code in DAS_ACTIONS)) continue;

      if (!state.dasCharged) {
        state.dasTimer += dt;
        if (state.dasTimer >= DAS_DELAY) {
          state.dasCharged = true;
          state.arrTimer = 0;
          // Fire first repeat immediately after DAS charges
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
    // Prevent default for game keys
    if (this.isGameKey(e.code)) {
      e.preventDefault();
    }

    // Handle non-DAS actions (fire once on press)
    const nonDasAction = NON_DAS_ACTIONS[e.code];
    if (nonDasAction) {
      if (!this.keys.has(e.code) || !this.keys.get(e.code)!.pressed) {
        this.keys.set(e.code, {
          action: nonDasAction,
          pressed: true,
          dasTimer: 0,
          arrTimer: 0,
          dasCharged: false,
        });
        this.fire(nonDasAction);
      }
      return;
    }

    // Handle DAS actions
    const dasAction = DAS_ACTIONS[e.code];
    if (dasAction) {
      if (!this.keys.has(e.code) || !this.keys.get(e.code)!.pressed) {
        this.keys.set(e.code, {
          action: dasAction,
          pressed: true,
          dasTimer: 0,
          arrTimer: 0,
          dasCharged: false,
        });
        // Fire initial action immediately
        this.fire(dasAction);
      }
    }
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
    return (
      code in DAS_ACTIONS ||
      code in NON_DAS_ACTIONS
    );
  }

  reset(): void {
    this.keys.clear();
  }
}
