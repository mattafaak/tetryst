import { type InputAction } from "../core/types.ts";
import { ALL_ACTION_TYPES, type ActionType } from "../core/key-bindings.ts";
import { type DASSettings, DEFAULT_DAS_SETTINGS } from "../core/das-settings.ts";

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

// ── Binding screen row index constants ───────────────────────────────────

export const RESTORE_KEYS_IDX    = ACTION_LABELS.length;         // 11
export const DAS_ROW_IDX         = ACTION_LABELS.length + 1;    // 12
export const ARR_ROW_IDX         = ACTION_LABELS.length + 2;    // 13
export const SDR_ROW_IDX         = ACTION_LABELS.length + 3;    // 14
export const STANDARD_PRESET_IDX = ACTION_LABELS.length + 4;    // 15
export const FAST_PRESET_IDX     = ACTION_LABELS.length + 5;    // 16
export const INSTANT_PRESET_IDX  = ACTION_LABELS.length + 6;    // 17
export const TOTAL_BINDING_ROWS  = ACTION_LABELS.length + 7;    // 18

/** Step sizes for ←/→ value adjustment. */
export const DAS_STEP = 10;
export const ARR_STEP = 5;
export const SDR_STEP = 5;

/** Named DAS/ARR/SDR presets for common competitive setups. */
export const DAS_PRESETS = {
  standard: { dasDelay: 300, arrRate: 50, sdrRate: 50 } as DASSettings,
  fast:     { dasDelay: 133, arrRate: 10, sdrRate: 10 } as DASSettings,
  instant:  { dasDelay: 0,   arrRate: 0,  sdrRate: 0  } as DASSettings,
};

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
  dasSettings: DASSettings = DEFAULT_DAS_SETTINGS,
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

  // ── Action list + Restore Defaults ───────────────────────────────────
  const actions = ACTION_LABELS;
  for (let i = 0; i <= RESTORE_KEYS_IDX; i++) {
    const y = LIST_TOP + i * ROW_H;
    const isRestore = i === RESTORE_KEYS_IDX;

    if (i === selectedIdx) {
      ctx.fillStyle = ROW_HIGHLIGHT;
      ctx.fillRect(leftX - 10, y - ROW_H + 6, 420, ROW_H - 2);
    }

    if (isRestore) {
      ctx.strokeStyle = "#2a2a3e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftX, y - ROW_H + 4);
      ctx.lineTo(leftX + 400, y - ROW_H + 4);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.font = "15px monospace";
      ctx.fillStyle = i === selectedIdx ? ACCENT : TEXT_DIM;
      ctx.fillText("Restore Key Defaults", leftX + 200, y);
      continue;
    }

    ctx.textAlign = "left";
    ctx.font = i === selectedIdx ? "bold 15px monospace" : "15px monospace";
    ctx.fillStyle = i === selectedIdx ? ACCENT : TEXT;
    ctx.fillText(actions[i].label, leftX, y);

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

  // ── Timing section ────────────────────────────────────────────────────
  const ROW_H_T = 26;
  const timingTop = LIST_TOP + (RESTORE_KEYS_IDX + 1) * ROW_H + 20;

  // Section separator + header
  ctx.strokeStyle = "#2a2a3e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX, timingTop);
  ctx.lineTo(leftX + 400, timingTop);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillText("TIMING", leftX, timingTop + 16);

  const timingRowStart = timingTop + 30;
  const timingRows: Array<{
    idx: number;
    label: string;
    value: string;
    adjustable: boolean;
  }> = [
    { idx: DAS_ROW_IDX,   label: "DAS Delay", value: `${dasSettings.dasDelay} ms`, adjustable: true },
    { idx: ARR_ROW_IDX,   label: "ARR Rate",  value: `${dasSettings.arrRate} ms`,  adjustable: true },
    { idx: SDR_ROW_IDX,   label: "SDR Rate",  value: `${dasSettings.sdrRate} ms`,  adjustable: true },
  ];

  for (let t = 0; t < timingRows.length; t++) {
    const row = timingRows[t];
    const y = timingRowStart + t * ROW_H_T;

    if (row.idx === selectedIdx) {
      ctx.fillStyle = ROW_HIGHLIGHT;
      ctx.fillRect(leftX - 10, y - ROW_H_T + 6, 420, ROW_H_T - 2);
    }

    ctx.textAlign = "left";
    ctx.font = row.idx === selectedIdx ? "bold 15px monospace" : "15px monospace";
    ctx.fillStyle = row.idx === selectedIdx ? ACCENT : TEXT;
    ctx.fillText(row.label, leftX, y);

    ctx.textAlign = "right";
    ctx.font = "15px monospace";
    if (row.adjustable && row.idx === selectedIdx) {
      ctx.fillStyle = ACCENT;
      ctx.fillText(`← ${row.value} →`, leftX + 400, y);
    } else {
      ctx.fillStyle = row.idx === selectedIdx ? ACCENT : TEXT_DIM;
      ctx.fillText(row.value, leftX + 400, y);
    }
  }

  // Preset rows
  const presetTop = timingRowStart + timingRows.length * ROW_H_T + 12;
  const presets: Array<{ idx: number; label: string; desc: string }> = [
    { idx: STANDARD_PRESET_IDX, label: "Standard", desc: "300 / 50 / 50" },
    { idx: FAST_PRESET_IDX,     label: "Fast",     desc: "133 / 10 / 10" },
    { idx: INSTANT_PRESET_IDX,  label: "Instant",  desc: "  0 /  0 /  0" },
  ];

  ctx.textAlign = "left";
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillText("PRESETS  (DAS / ARR / SDR)", leftX, presetTop - 4);

  for (let p = 0; p < presets.length; p++) {
    const preset = presets[p];
    const y = presetTop + 12 + p * ROW_H_T;

    if (preset.idx === selectedIdx) {
      ctx.fillStyle = ROW_HIGHLIGHT;
      ctx.fillRect(leftX - 10, y - ROW_H_T + 6, 420, ROW_H_T - 2);
    }

    ctx.textAlign = "left";
    ctx.font = preset.idx === selectedIdx ? "bold 15px monospace" : "15px monospace";
    ctx.fillStyle = preset.idx === selectedIdx ? ACCENT : TEXT_DIM;
    ctx.fillText(preset.label, leftX, y);

    ctx.textAlign = "right";
    ctx.font = "13px monospace";
    ctx.fillStyle = preset.idx === selectedIdx ? ACCENT : TEXT_FAINT;
    ctx.fillText(preset.desc, leftX + 400, y);
  }

  // Bottom navigation hints
  ctx.font = "13px monospace";
  ctx.fillStyle = TEXT_DIM;
  const hintY = h - 30;
  ctx.textAlign = "center";
  let hints: string;
  if (waitingForKey) {
    hints = "Press any key  ·  Esc to cancel";
  } else if (selectedIdx >= DAS_ROW_IDX && selectedIdx <= SDR_ROW_IDX) {
    hints = "↑ ↓ navigate  ·  ← → adjust value  ·  Esc back";
  } else if (selectedIdx >= STANDARD_PRESET_IDX) {
    hints = "↑ ↓ navigate  ·  Enter apply preset  ·  Esc back";
  } else {
    hints = "↑ ↓ navigate  ·  Enter rebind  ·  Esc back";
  }
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
