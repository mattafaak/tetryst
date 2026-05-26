import { type InputAction } from "./types.ts";

export const STORAGE_KEY = "tetryst_keybindings";

/** All valid action type strings — the source of truth for validation. */
export const ALL_ACTION_TYPES = [
  "MoveLeft",
  "MoveRight",
  "SoftDrop",
  "HardDrop",
  "RotateCW",
  "RotateCCW",
  "Hold",
  "Pause",
  "Start",
  "Mute",
  "KeyBindings",
] as const;

export type ActionType = (typeof ALL_ACTION_TYPES)[number];

export const DEFAULT_BINDINGS: Record<string, InputAction> = {
  ArrowLeft: { type: "MoveLeft" },
  ArrowRight: { type: "MoveRight" },
  ArrowDown: { type: "SoftDrop" },
  Space: { type: "HardDrop" },
  ArrowUp: { type: "RotateCW" },
  KeyZ: { type: "RotateCW" },
  KeyX: { type: "RotateCCW" },
  KeyC: { type: "Hold" },
  ShiftLeft: { type: "Hold" },
  ShiftRight: { type: "Hold" },
  KeyP: { type: "Pause" },
  Escape: { type: "Pause" },
  Enter: { type: "Start" },
  KeyM: { type: "Mute" },
  KeyK: { type: "KeyBindings" },
};

/** Extract the action type string from an InputAction object. */
export function getActionType(action: InputAction): ActionType {
  return action.type as ActionType;
}

/** Create an InputAction from a valid action type string. Throws on unknown. */
export function actionTypeFromBinding(type: string): InputAction {
  if (!ALL_ACTION_TYPES.includes(type as ActionType)) {
    throw new Error(`Unknown action type: ${type}`);
  }
  return { type } as InputAction;
}

/** Persist bindings to localStorage. Stored as Record<string, string> (code → action type). */
export function saveBindings(bindings: Record<string, InputAction>): void {
  const serialized: Record<string, string> = {};
  for (const [code, action] of Object.entries(bindings)) {
    serialized[code] = action.type;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  _bindingsGeneration++;
}

/**
 * Load bindings from localStorage.
 * Falls back to DEFAULT_BINDINGS on any error or missing data.
 * Merges stored bindings over defaults so every action has at least one key.
 */
export function loadBindings(): Record<string, InputAction> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };

    const parsed: Record<string, unknown> = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_BINDINGS };

    // Start with defaults, then overlay stored mappings
    const bindings: Record<string, InputAction> = { ...DEFAULT_BINDINGS };

    for (const [code, type] of Object.entries(parsed)) {
      if (typeof code === "string" && typeof type === "string" && ALL_ACTION_TYPES.includes(type as ActionType)) {
        bindings[code] = { type } as InputAction;
      }
    }

    return bindings;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

// ── Cache invalidation ────────────────────────────────────────────────────

let _bindingsGeneration = 0;

/** Incremented on every save/update to invalidate downstream caches. */
export function getBindingsGeneration(): number {
  return _bindingsGeneration;
}

/** Remove stored bindings and return the defaults. */
export function resetBindings(): Record<string, InputAction> {
  localStorage.removeItem(STORAGE_KEY);
  _bindingsGeneration++;
  return { ...DEFAULT_BINDINGS };
}

/**
 * Validate bindings: returns a list of warnings.
 * Currently checks that every action type has at least one key mapped.
 */
export function validateBindings(bindings: Record<string, InputAction>): string[] {
  const warnings: string[] = [];
  const mappedTypes = new Set(Object.values(bindings).map((a) => a.type));

  for (const t of ALL_ACTION_TYPES) {
    if (!mappedTypes.has(t)) {
      warnings.push(`No key mapped for action: ${t}`);
    }
  }

  return warnings;
}
