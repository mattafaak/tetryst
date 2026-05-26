import { type InputAction } from "../core/types.ts";
import { ALL_ACTION_TYPES, type ActionType } from "../core/key-bindings.ts";

// ── Key code display names ───────────────────────────────────────────────

const KEY_DISPLAY: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Space: "Space",
  Escape: "Esc",
  Enter: "Enter",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
};

/** Map a KeyboardEvent.code to a human-readable display string. */
export function keyCodeDisplayName(code: string): string {
  if (KEY_DISPLAY[code]) return KEY_DISPLAY[code];
  // Strip common prefixes
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

// ── Action metadata ──────────────────────────────────────────────────────

interface ActionMeta {
  action: ActionType;
  label: string;
}

/** Ordered list of all actions with their display labels. */
export function getActionDisplayNames(): ActionMeta[] {
  return [
    { action: "MoveLeft", label: "Move Left" },
    { action: "MoveRight", label: "Move Right" },
    { action: "SoftDrop", label: "Soft Drop" },
    { action: "HardDrop", label: "Hard Drop" },
    { action: "RotateCW", label: "Rotate CW" },
    { action: "RotateCCW", label: "Rotate CCW" },
    { action: "Hold", label: "Hold" },
    { action: "Pause", label: "Pause" },
    { action: "Start", label: "Start" },
    { action: "Mute", label: "Mute" },
    { action: "KeyBindings", label: "Key Bindings" },
  ];
}

export const ACTION_LABELS = getActionDisplayNames();

/** Build a reverse lookup: action type → display name strings of bound keys. */
export function buildReverseLookup(
  bindings: Record<string, InputAction>,
): Record<string, string[]> {
  const lookup: Record<string, string[]> = {};
  for (const t of ALL_ACTION_TYPES) {
    lookup[t] = [];
  }
  for (const [code, action] of Object.entries(bindings)) {
    if (!lookup[action.type]) lookup[action.type] = [];
    lookup[action.type].push(keyCodeDisplayName(code));
  }
  return lookup;
}

// ── Theme tokens ─────────────────────────────────────────────────────────

const BG_OVERLAY = "rgba(0,0,0,0.85)";
const TEXT       = "#e2e2e2";
const TEXT_DIM   = "#777";
const TEXT_FAINT = "#444";
const ACCENT     = "#00e5ff";
const AMBER      = "#ffb300";
const ROW_HIGHLIGHT = "rgba(0, 229, 255, 0.10)";

// ── Drawing constants ────────────────────────────────────────────────────

const ROW_H = 34;         // px per action row
const LIST_TOP = 120;     // px from top of canvas to first row

// ── Main render function ─────────────────────────────────────────────────

export function drawKeyBindingsScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bindings: Record<string, InputAction>,
  selectedIdx: number,
  waitingForKey: boolean,
): void {
  ctx.save();
  ctx.textAlign = "center";

  // Dark overlay
  ctx.fillStyle = BG_OVERLAY;
  ctx.fillRect(0, 0, w, h);

  const cx = Math.floor(w / 2);
  const leftX = cx - 200;

  // Title
  ctx.letterSpacing = "6px";
  ctx.font = "bold 40px monospace";
  ctx.fillStyle = TEXT;
  ctx.fillText("KEY  BINDINGS", cx, 64);
  ctx.letterSpacing = "0px";

  // Instructions
  ctx.font = "13px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText("Select an action and press Enter to rebind", cx, 90);

  // Action list + Restore Defaults row
  const actions = ACTION_LABELS;
  const totalRows = actions.length + 1; // +1 for Restore Defaults
  const restoreIdx = actions.length;

  for (let i = 0; i < totalRows; i++) {
    const y = LIST_TOP + i * ROW_H;
    const isRestore = i === restoreIdx;

    // Highlight selected row
    if (i === selectedIdx) {
      ctx.fillStyle = ROW_HIGHLIGHT;
      ctx.fillRect(leftX - 10, y - ROW_H + 6, 420, ROW_H - 2);
    }

    if (isRestore) {
      // Separator
      if (i === restoreIdx) {
        ctx.strokeStyle = "#2a2a3e";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftX, y - ROW_H + 4);
        ctx.lineTo(leftX + 400, y - ROW_H + 4);
        ctx.stroke();
      }
      // Restore defaults row
      ctx.textAlign = "center";
      ctx.font = "15px monospace";
      ctx.fillStyle = i === selectedIdx ? ACCENT : TEXT_DIM;
      ctx.fillText("Restore Defaults", leftX + 200, y);
      continue;
    }

    // Action label
    ctx.textAlign = "left";
    ctx.font = i === selectedIdx ? "bold 15px monospace" : "15px monospace";
    ctx.fillStyle = i === selectedIdx ? ACCENT : TEXT;
    ctx.fillText(actions[i].label, leftX, y);

    // Key display
    ctx.textAlign = "right";
    const keys = bindingsToDisplayKeys(bindings, actions[i].action);
    const isWaiting = waitingForKey && i === selectedIdx;

    if (isWaiting) {
      ctx.font = "15px monospace";
      ctx.fillStyle = AMBER;
      ctx.fillText("... press a key ...", leftX + 400, y);
    } else {
      const displayText = keys.length > 0 ? keys.join("  ") : "—";
      ctx.font = "15px monospace";
      ctx.fillStyle = keys.length > 0 ? TEXT : TEXT_FAINT;
      ctx.fillText(displayText, leftX + 400, y);
    }
  }

  // Bottom navigation hints
  ctx.font = "13px monospace";
  ctx.fillStyle = TEXT_DIM;
  const hintY = h - 30;
  ctx.textAlign = "center";
  const hints = waitingForKey
    ? "Press any key  ·  Esc to cancel"
    : "↑ ↓ navigate  ·  Enter select  ·  Esc back";
  ctx.fillText(hints, cx, hintY);

  ctx.restore();
}

/**
 * Build a dynamic controls-hint string from the current bindings.
 * Shows the first key bound to each relevant action.
 */
export function buildControlsHint(
  bindings: Record<string, InputAction>,
  isMarathon: boolean,
): string {
  function keyFor(type: string): string {
    for (const [code, a] of Object.entries(bindings)) {
      if (a.type === type) return keyCodeDisplayName(code);
    }
    return "?";
  }

  const parts: string[] = [];

  // Mode navigation: first key for MoveLeft and MoveRight
  parts.push(`${keyFor("MoveLeft")} ${keyFor("MoveRight")} mode`);

  if (isMarathon) {
    parts.push(`${keyFor("RotateCW")} ${keyFor("SoftDrop")} level`);
  }

  parts.push(`${keyFor("RotateCW")} / ${keyFor("RotateCCW")} rotate`);
  parts.push(`${keyFor("HardDrop")} drop`);
  parts.push(`${keyFor("Hold")} hold`);
  parts.push(`${keyFor("Pause")} pause`);
  parts.push(`${keyFor("Mute")} mute`);
  parts.push(`${keyFor("KeyBindings")} bindings`);

  return parts.join("  ·  ");
}

/** Collect display names for all keys bound to a given action type. */
function bindingsToDisplayKeys(
  bindings: Record<string, InputAction>,
  actionType: string,
): string[] {
  const keys: string[] = [];
  for (const [code, action] of Object.entries(bindings)) {
    if (action.type === actionType) {
      keys.push(keyCodeDisplayName(code));
    }
  }
  return keys;
}
