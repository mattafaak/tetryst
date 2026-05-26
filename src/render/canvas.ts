import {
  type Board,
  type Piece,
  type GameState,
  type PopupItem,
  GamePhase,
  GameMode,
  TetriminoType,
} from "../core/types.ts";
import {
  BOARD_WIDTH,
  VISIBLE_HEIGHT,
  BUFFER_HEIGHT,
  PIECE_COLORS,
  GHOST_OPACITY,
  PIECE_SHAPES,
  NEXT_QUEUE_SIZE,
  ULTRA_DANGER_THRESHOLD,
  SPRINT_LINE_TARGET,
  LINE_CLEAR_ANIM_DURATION,
} from "../core/constants.ts";
import { loadHighScores, getScoresGeneration } from "../core/high-scores.ts";
import { renderBackground } from "./background.ts";
import { renderEffects, setParticleLayout } from "./effects.ts";

// ── Design tokens ──────────────────────────────────────────────────────
const TEXT       = "#e2e2e2";

/**
 * Compute the playfield background color that maximally contrasts all
 * tetrimino colors.  Uses the complementary hue (opposite the average piece
 * hue) at very low lightness so piece cells pop, with just enough saturation
 * to feel intentional.  Derived from PIECE_COLORS at init time, so it
 * automatically adapts if the color scheme changes.
 *
 * Grid lines and border are derived from the same hue at slightly different
 * lightness, maintaining a cohesive look.
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const c = mx - mn;
  let h = 0;
  if (c !== 0) {
    if (mx === r) h = ((g - b) / c) % 6;
    else if (mx === g) h = (b - r) / c + 2;
    else h = (r - g) / c + 4;
  }
  h = ((h * 60) % 360 + 360) % 360;
  const l = (mx + mn) / 2;
  const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function computePlayfieldColors(): { bg: string; border: string; grid: string } {
  const colors = Object.values(PIECE_COLORS);
  // Circular mean of hues
  let sinSum = 0, cosSum = 0;
  for (const c of colors) {
    const { h } = hexToHSL(c);
    const rad = h * Math.PI / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  const avgHue = (Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360;
  const bgHue = (avgHue + 180) % 360; // complementary

  return {
    bg:     `hsl(${bgHue}, 15%, 10%)`,   // very dark, subtly tinted
    border: `hsl(${bgHue}, 15%, 18%)`,   // slightly lighter for border
    grid:   `hsl(${bgHue}, 10%, 14%)`,   // between bg and border for grid lines
  };
}

const PLAYFIELD = computePlayfieldColors();

// Shared font constants — deduplicated across ~20 font assignments in rendering functions.
const FONT_BOLD_11   = "bold 11px monospace";
const FONT_BOLD_26   = "bold 26px monospace";
const FONT_13        = "13px monospace";
const FONT_12        = "12px monospace";
const FONT_TITLE     = "bold 52px monospace";
const FONT_HEADING   = "bold 44px monospace";
const FONT_HEADING_SM = "bold 40px monospace";
const FONT_VALUE     = "20px monospace";
const FONT_VALUE_BOLD = "bold 20px monospace";
const FONT_PROMPT    = "bold 15px monospace";
const FONT_PROMPT_SM = "bold 14px monospace";
const FONT_POPUP     = "bold 22px monospace";
const FONT_STAT      = "14px monospace";
const FONT_EMPTY     = "16px monospace";
const FONT_MUTE      = "11px monospace";
const FONT_BADGE     = "bold 12px monospace";

// Cached DPR: initialized once and re-read when canvas dimensions change.
let _dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
let _lastCanvasW = 0;
let _lastCanvasH = 0;

// Menu overlay cache — offscreen canvas + cache key that invalidates on
// mode, level, audio, or score change. Avoids ~30 fillText calls per frame.
let _menuCacheCanvas: HTMLCanvasElement | null = null;
let _menuCacheCtx: CanvasRenderingContext2D | null = null;
let _menuCacheKey = "";

const TEXT_DIM   = "#777";
const TEXT_FAINT = "#444";
const ACCENT     = "#00e5ff";
const AMBER      = "#ffb300";
const RED        = "#ff5252";

function fmtScore(n: number): string {
  if (n === _lastFmtScore) return _lastFmtResult;
  _lastFmtScore = n;
  _lastFmtResult = n.toLocaleString("en-US");
  return _lastFmtResult;
}

// Single-entry cache for fmtScore — avoids per-frame toLocaleString overhead
// when the score hasn't changed between frames (common in slow-paced play).
let _lastFmtScore = 0;
let _lastFmtResult = "0";

// Offscreen canvas cache — only redrawn when the board reference changes
let boardCacheCanvas: HTMLCanvasElement | null = null;
let cachedBoard: Board | null = null;
let cachedCellSize = 0;

function renderBoardStatic(board: Board, cellSize: number): HTMLCanvasElement {
  if (!boardCacheCanvas || cellSize !== cachedCellSize) {
    boardCacheCanvas = document.createElement("canvas");
    boardCacheCanvas.width = BOARD_WIDTH * cellSize;
    boardCacheCanvas.height = VISIBLE_HEIGHT * cellSize;
    cachedCellSize = cellSize;
  }
  const off = boardCacheCanvas.getContext("2d");
  if (!off) return boardCacheCanvas;

  // Board background — derived from PIECE_COLORS for maximum contrast
  off.fillStyle = PLAYFIELD.bg;
  off.fillRect(0, 0, boardCacheCanvas.width, boardCacheCanvas.height);

  // Border
  off.strokeStyle = PLAYFIELD.border;
  off.lineWidth = 2;
  off.strokeRect(0, 0, boardCacheCanvas.width, boardCacheCanvas.height);

  // Grid lines — translucent for subtle contrast while keeping them visible
  off.beginPath();
  off.strokeStyle = PLAYFIELD.grid;
  off.lineWidth = 0.5;
  for (let row = 1; row < VISIBLE_HEIGHT; row++) {
    off.moveTo(0, row * cellSize);
    off.lineTo(boardCacheCanvas.width, row * cellSize);
  }
  for (let col = 1; col < BOARD_WIDTH; col++) {
    off.moveTo(col * cellSize, 0);
    off.lineTo(col * cellSize, boardCacheCanvas.height);
  }
  off.stroke();

  // Locked cells (visible rows only)
  for (let row = 0; row < VISIBLE_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const boardRow = row + BUFFER_HEIGHT;
      const cell = board[boardRow]?.[col];
      if (cell) {
        const color = PIECE_COLORS[cell as TetriminoType];
        drawCell(off, col, row, color, cellSize);
      }
    }
  }

  return boardCacheCanvas;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cellSize: number,
  isAttractMode?: boolean,
  selectedMode?: GameMode,
  selectedStartLevel?: number,
  audioEnabled?: boolean,
  pauseMenuSelection?: number,
  dt?: number,
): void {
  // Refresh DPR cache when canvas dimensions change (window resize)
  const { width, height } = ctx.canvas;
  if (width !== _lastCanvasW || height !== _lastCanvasH) {
    _dpr = window.devicePixelRatio || 1;
    _lastCanvasW = width;
    _lastCanvasH = height;
  }
  const dpr = _dpr;
  const canvasWidth = ctx.canvas.width / dpr;
  const canvasHeight = ctx.canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Background (dark fill + subtle star field)
  renderBackground(ctx, canvasWidth, canvasHeight);

  // Calculate board position (centered)
  const boardPixelWidth = BOARD_WIDTH * cellSize;
  const boardPixelHeight = VISIBLE_HEIGHT * cellSize;
  const boardX = Math.floor((canvasWidth - boardPixelWidth) / 2);
  const boardY = Math.floor((canvasHeight - boardPixelHeight) / 2);

  // Push layout to effects module for update-phase particle spawning
  setParticleLayout(boardX, boardY, cellSize);

  // Draw cached board static layer — only redrawn when board ref changes
  if (state.board !== cachedBoard || cellSize !== cachedCellSize) {
    renderBoardStatic(state.board, cellSize);
    cachedBoard = state.board;
  }
  if (boardCacheCanvas) {
    ctx.drawImage(boardCacheCanvas, boardX, boardY);
  }

  // Board-area drawings use a translated context so coordinates are grid-relative
  ctx.save();
  ctx.translate(boardX, boardY);

  // Draw ghost piece
  if (state.activePiece && state.phase === GamePhase.Playing) {
    drawGhost(ctx, state.activePiece, state.ghostY, cellSize);
  }

  // Draw active piece
  if (state.activePiece && state.phase === GamePhase.Playing) {
    drawPiece(ctx, state.activePiece, cellSize);
  }

  // Draw line clear animation
  if (state.phase === GamePhase.LineClear) {
    drawLineClearAnimation(ctx, state, cellSize);
  }

  ctx.restore();

  // Draw popups (floating action text)
  if (state.popups.length > 0) {
    drawPopups(ctx, state.popups, boardX, boardY, boardPixelWidth);
  }

  // Draw overlays — unified menu overlay renders whenever attract mode is active
  // or the game is in menu phase (covers attract AI game + mode selection)
  if (state.phase === GamePhase.Menu || isAttractMode) {
    drawMenuOverlay(ctx, canvasWidth, canvasHeight, selectedMode ?? GameMode.Marathon, selectedStartLevel ?? 0, audioEnabled ?? true);
  } else if (state.phase === GamePhase.Paused) {
    drawPauseMenu(ctx, canvasWidth, canvasHeight, pauseMenuSelection ?? 0);
  } else if (state.phase === GamePhase.GameOver) {
    drawGameOver(ctx, canvasWidth, canvasHeight, state);
  } else if (state.phase === GamePhase.Victory) {
    drawVictory(ctx, canvasWidth, canvasHeight, state);
  }

  // Draw HUD (only during active gameplay, not in menu/attract)
  if (state.phase !== GamePhase.Menu && !isAttractMode && state.phase !== GamePhase.Paused) {
    drawHUD(ctx, boardX + boardPixelWidth + 20, boardY, state, cellSize, audioEnabled ?? true);
  }

  // Visual effects (particles, screen flash)
  renderEffects(ctx, canvasWidth, canvasHeight, dt ?? 16);

  ctx.restore();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  color: string,
  cellSize: number
): void {
  const x = col * cellSize;
  const y = row * cellSize;
  const inset = 1;

  ctx.fillStyle = color;
  ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);

  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, 2);
  ctx.fillRect(x + inset, y + inset, 2, cellSize - inset * 2);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + inset, y + cellSize - inset - 2, cellSize - inset * 2, 2);
  ctx.fillRect(x + cellSize - inset - 2, y + inset, 2, cellSize - inset * 2);
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  cellSize: number
): void {
  const shape = PIECE_SHAPES[piece.type][piece.rotation];
  const color = PIECE_COLORS[piece.type];

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const visibleRow = piece.pos.y + r - BUFFER_HEIGHT;
        const boardCol = piece.pos.x + c;
        if (visibleRow >= 0 && visibleRow < VISIBLE_HEIGHT) {
          drawCell(ctx, boardCol, visibleRow, color, cellSize);
        }
      }
    }
  }
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  ghostY: number,
  cellSize: number
): void {
  const shape = PIECE_SHAPES[piece.type][piece.rotation];
  const color = PIECE_COLORS[piece.type];

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const visibleRow = ghostY + r - BUFFER_HEIGHT;
        const boardCol = piece.pos.x + c;
        if (visibleRow >= 0 && visibleRow < VISIBLE_HEIGHT) {
          const x = boardCol * cellSize;
          const y = visibleRow * cellSize;
          const inset = 1;

          ctx.strokeStyle = color;
          ctx.globalAlpha = GHOST_OPACITY;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + inset + 1, y + inset + 1, cellSize - inset * 2 - 2, cellSize - inset * 2 - 2);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}

function drawLineClearAnimation(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cellSize: number
): void {
  const flash = Math.sin(state.lineClearTimer * (3 * Math.PI / LINE_CLEAR_ANIM_DURATION)) > 0;
  if (!flash) return;

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  for (const boardRow of state.clearedRowIndices) {
    const visibleRow = boardRow - BUFFER_HEIGHT;
    if (visibleRow >= 0 && visibleRow < VISIBLE_HEIGHT) {
      ctx.fillRect(0, visibleRow * cellSize, BOARD_WIDTH * cellSize, cellSize);
    }
  }
}

// ── Overlay helpers ────────────────────────────────────────────────────

function overlayBg(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.82): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

function drawTitle(ctx: CanvasRenderingContext2D, cx: number, y: number): void {
  ctx.letterSpacing = "6px";
  ctx.font = FONT_TITLE;
  ctx.fillStyle = TEXT;
  ctx.fillText("TETRYST", cx, y);
  ctx.letterSpacing = "0px";
}

function rule(ctx: CanvasRenderingContext2D, cx: number, y: number, halfW = 110): void {
  ctx.strokeStyle = "#2a2a3e";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, y);
  ctx.lineTo(cx + halfW, y);
  ctx.stroke();
}

function hudLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.font = FONT_BOLD_11;
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(text, x, y);
}

// ── Screen functions ───────────────────────────────────────────────────

function renderMenuContent(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  selectedMode: GameMode,
  selectedStartLevel: number,
  audioEnabled: boolean,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  overlayBg(ctx, canvasWidth, canvasHeight, 0.58);
  ctx.textAlign = "center";

  drawTitle(ctx, cx, cy - 68);
  rule(ctx, cx, cy - 42);

  // Mode label
  ctx.font = FONT_BOLD_11;
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillText("MODE", cx, cy - 18);

  // Mode selector
  ctx.font = FONT_BOLD_26;
  ctx.fillStyle = ACCENT;
  ctx.fillText(`‹  ${selectedMode}  ›`, cx, cy + 8);

  // Mode-specific content
  const isMarathon = selectedMode === GameMode.Marathon;
  let scoresY: number;

  if (isMarathon) {
    ctx.font = FONT_BOLD_11;
    ctx.fillStyle = TEXT_FAINT;
    ctx.fillText("START LEVEL", cx, cy + 32);

    ctx.font = FONT_BOLD_26;
    ctx.fillStyle = AMBER;
    ctx.fillText(`↑  ${selectedStartLevel + 1}  ↓`, cx, cy + 56);
    scoresY = cy + 82;
  } else if (selectedMode === GameMode.Sprint) {
    ctx.font = FONT_13;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Clear 40 lines as fast as you can", cx, cy + 34);
    scoresY = cy + 58;
  } else {
    ctx.font = FONT_13;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Score as many points as you can in 2 min", cx, cy + 34);
    scoresY = cy + 58;
  }

  // High scores
  const scores = loadHighScores(selectedMode).slice(0, 5);
  if (scores.length > 0) {
    ctx.font = FONT_BOLD_11;
    ctx.fillStyle = AMBER;
    ctx.fillText("TOP  SCORES", cx, scoresY);

    const scoreLabel = selectedMode === GameMode.Sprint ? "TIME" : "SCORE";
    ctx.fillText(`#    ${scoreLabel}           LVL   LINES`, cx, scoresY + 16);

    ctx.font = FONT_13;
    scores.forEach((s, i) => {
      const y = scoresY + 34 + i * 16;
      const primary = selectedMode === GameMode.Sprint ? formatMs(s.score) : fmtScore(s.score);
      const rank = `${i + 1}.${i < 9 ? "  " : " "}`;
      ctx.fillStyle = i < 3 ? TEXT : TEXT_DIM;
      ctx.fillText(
        `${rank}${primary.padEnd(12)}  Lv ${s.level + 1}  ${s.lines}L`,
        cx,
        y,
      );
    });
  } else {
    ctx.font = FONT_EMPTY;
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("No scores yet!", cx, scoresY + 18);
  }

  const promptY = isMarathon ? cy + 196 : cy + 176;
  ctx.font = FONT_PROMPT;
  ctx.fillStyle = AMBER;
  ctx.fillText("PRESS  ENTER  TO  PLAY", cx, promptY);

  // Audio indicator
  ctx.font = FONT_12;
  ctx.fillStyle = audioEnabled ? "#44aa66" : "#885555";
  ctx.fillText(audioEnabled ? "♪  on" : "♪  off", cx, promptY + 20);

  // Controls bar at bottom
  const barH = 38;
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fillRect(0, canvasHeight - barH, canvasWidth, barH);

  ctx.font = FONT_13;
  ctx.fillStyle = TEXT_DIM;
  const hint = isMarathon
    ? "← → mode  ·  ↑ ↓ level  ·  Z / X rotate  ·  Space drop  ·  C hold  ·  M mute"
    : "← → mode  ·  Z / X rotate  ·  Space drop  ·  C hold  ·  M mute";
  ctx.fillText(hint, cx, canvasHeight - barH / 2 + 5);
}

function drawMenuOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  selectedMode: GameMode,
  selectedStartLevel: number,
  audioEnabled: boolean,
): void {
  const cacheKey = `${selectedMode}:${selectedStartLevel}:${audioEnabled}:${getScoresGeneration()}`;

  // Ensure cache canvas matches current dimensions
  if (!_menuCacheCanvas || _menuCacheCanvas.width !== canvasWidth || _menuCacheCanvas.height !== canvasHeight) {
    try {
      if (typeof OffscreenCanvas !== "undefined") {
        _menuCacheCanvas = new OffscreenCanvas(canvasWidth, canvasHeight) as unknown as HTMLCanvasElement;
      } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
        _menuCacheCanvas = document.createElement("canvas");
        _menuCacheCanvas.width = canvasWidth;
        _menuCacheCanvas.height = canvasHeight;
      } else {
        _menuCacheCanvas = null;
      }
      _menuCacheCtx = _menuCacheCanvas?.getContext("2d") ?? null;
    } catch {
      _menuCacheCanvas = null;
      _menuCacheCtx = null;
    }
    _menuCacheKey = ""; // force re-render
  }

  if (_menuCacheCanvas && _menuCacheCtx && _menuCacheKey === cacheKey) {
    // Cache hit — blit cached overlay
    ctx.drawImage(_menuCacheCanvas, 0, 0);
    return;
  }

  // Cache miss — render to cache canvas
  if (_menuCacheCanvas && _menuCacheCtx) {
    _menuCacheCtx.save();
    renderMenuContent(_menuCacheCtx, canvasWidth, canvasHeight, selectedMode, selectedStartLevel, audioEnabled);
    _menuCacheCtx.restore();
    _menuCacheKey = cacheKey;
    // Blit to main canvas
    ctx.drawImage(_menuCacheCanvas, 0, 0);
  } else {
    // No cache available — render directly
    renderMenuContent(ctx, canvasWidth, canvasHeight, selectedMode, selectedStartLevel, audioEnabled);
  }
}

const PAUSE_OPTIONS = ["Resume", "Restart", "Quit to Menu"];

function drawPauseMenu(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  selection: number,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  overlayBg(ctx, canvasWidth, canvasHeight, 0.72);
  ctx.textAlign = "center";

  ctx.letterSpacing = "6px";
  ctx.font = FONT_HEADING_SM;
  ctx.fillStyle = TEXT;
  ctx.fillText("PAUSED", cx, cy - 64);
  ctx.letterSpacing = "0px";

  // Menu options — color indicates selection; no prefix to avoid font-metric shifting
  ctx.font = FONT_VALUE_BOLD;
  PAUSE_OPTIONS.forEach((opt, i) => {
    const y = cy - 8 + i * 32;
    ctx.fillStyle = i === selection ? ACCENT : TEXT;
    ctx.fillText(opt, cx, y);
  });

  // Hint
  ctx.font = FONT_12;
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText("↑ ↓ navigate  ·  Enter select  ·  P resume", cx, cy + 86);
}

function drawGameOver(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: GameState,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  overlayBg(ctx, canvasWidth, canvasHeight);
  ctx.textAlign = "center";

  ctx.letterSpacing = "4px";
  ctx.font = FONT_HEADING;
  ctx.fillStyle = RED;
  ctx.fillText("GAME  OVER", cx, cy - 90);
  ctx.letterSpacing = "0px";

  rule(ctx, cx, cy - 66);

  // Primary stat
  if (state.mode === GameMode.Sprint) {
    ctx.font = FONT_BOLD_11;
    ctx.fillStyle = TEXT_FAINT;
    ctx.fillText("TIME", cx, cy - 44);
    ctx.font = FONT_BOLD_26;
    ctx.fillStyle = TEXT;
    ctx.fillText(formatMs(state.modeTimer), cx, cy - 18);
  } else {
    ctx.font = FONT_BOLD_11;
    ctx.fillStyle = TEXT_FAINT;
    ctx.fillText("SCORE", cx, cy - 44);
    ctx.font = FONT_BOLD_26;
    ctx.fillStyle = TEXT;
    ctx.fillText(fmtScore(state.score), cx, cy - 18);
  }

  ctx.font = FONT_STAT;
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`Level ${state.level + 1}   ·   ${state.lines} lines`, cx, cy + 8);

  drawBestScores(ctx, state.mode, cx, cy + 40);

  ctx.font = FONT_PROMPT_SM;
  ctx.fillStyle = AMBER;
  ctx.fillText("PRESS  ENTER  TO  PLAY  AGAIN", cx, cy + 152);
}

function drawVictory(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: GameState,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  overlayBg(ctx, canvasWidth, canvasHeight);
  ctx.textAlign = "center";

  let headline: string;
  let headlineColor: string;
  let primaryLabel: string;
  let primaryValue: string;

  if (state.mode === GameMode.Sprint) {
    headline = "SPRINT  CLEAR";
    headlineColor = ACCENT;
    primaryLabel = "TIME";
    primaryValue = formatMs(state.modeTimer > 0 ? state.modeTimer : 0);
  } else if (state.mode === GameMode.Ultra) {
    headline = "TIME'S  UP";
    headlineColor = AMBER;
    primaryLabel = "SCORE";
    primaryValue = fmtScore(state.score);
  } else {
    headline = "YOU  WIN";
    headlineColor = AMBER;
    primaryLabel = "SCORE";
    primaryValue = fmtScore(state.score);
  }

  ctx.letterSpacing = "4px";
  ctx.font = FONT_HEADING;
  ctx.fillStyle = headlineColor;
  ctx.fillText(headline, cx, cy - 90);
  ctx.letterSpacing = "0px";

  rule(ctx, cx, cy - 66);

  ctx.font = FONT_BOLD_11;
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillText(primaryLabel, cx, cy - 44);
  ctx.font = FONT_BOLD_26;
  ctx.fillStyle = TEXT;
  ctx.fillText(primaryValue, cx, cy - 18);

  ctx.font = FONT_STAT;
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`Level ${state.level + 1}   ·   ${state.lines} lines`, cx, cy + 8);

  drawBestScores(ctx, state.mode, cx, cy + 40);

  ctx.font = FONT_PROMPT_SM;
  ctx.fillStyle = AMBER;
  ctx.fillText("PRESS  ENTER  FOR  MENU", cx, cy + 152);
}

/** Shared high scores rendering used by game-over and victory overlays. */
function drawBestScores(ctx: CanvasRenderingContext2D, mode: string, cx: number, y: number): void {
  const scores = loadHighScores(mode).slice(0, 5);
  if (scores.length === 0) return;
  ctx.font = FONT_BOLD_11;
  ctx.fillStyle = AMBER;
  ctx.fillText("BEST  SCORES", cx, y);
  ctx.font = FONT_13;
  ctx.fillStyle = TEXT_DIM;
  scores.forEach((s, i) => {
    const primary = mode === GameMode.Sprint ? formatMs(s.score) : fmtScore(s.score);
    ctx.fillText(`${i + 1}.  ${primary}   Lv ${s.level + 1}   ${s.lines}L`, cx, y + 18 + i * 18);
  });
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const centis = Math.floor((ms % 1000) / 10);
  return `${min}:${sec.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  hudX: number,
  hudY: number,
  state: GameState,
  cellSize: number,
  audioEnabled: boolean,
): void {
  ctx.textAlign = "left";

  // Mode name
  ctx.font = FONT_BOLD_11;
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillText(state.mode.toUpperCase(), hudX, hudY + 14);

  if (state.mode === GameMode.Sprint) {
    hudLabel(ctx, "TIME", hudX, hudY + 40);
    ctx.font = FONT_VALUE;
    ctx.fillStyle = TEXT;
    ctx.fillText(formatMs(state.modeTimer), hudX, hudY + 62);

    hudLabel(ctx, "LINES LEFT", hudX, hudY + 96);
    ctx.font = FONT_VALUE;
    ctx.fillStyle = ACCENT;
    ctx.fillText(Math.max(0, SPRINT_LINE_TARGET - state.lines).toString(), hudX, hudY + 118);

  } else if (state.mode === GameMode.Ultra) {
    hudLabel(ctx, "TIME LEFT", hudX, hudY + 40);
    ctx.font = FONT_VALUE_BOLD;
    ctx.fillStyle = state.modeTimer < ULTRA_DANGER_THRESHOLD ? RED : TEXT;
    ctx.fillText(formatMs(state.modeTimer), hudX, hudY + 62);

    hudLabel(ctx, "SCORE", hudX, hudY + 96);
    ctx.font = FONT_VALUE;
    ctx.fillStyle = TEXT;
    ctx.fillText(fmtScore(state.score), hudX, hudY + 118);

  } else {
    // Marathon
    hudLabel(ctx, "SCORE", hudX, hudY + 40);
    ctx.font = FONT_VALUE;
    ctx.fillStyle = TEXT;
    ctx.fillText(fmtScore(state.score), hudX, hudY + 62);

    hudLabel(ctx, "LEVEL", hudX, hudY + 96);
    ctx.font = FONT_VALUE;
    ctx.fillStyle = TEXT;
    ctx.fillText((state.level + 1).toString(), hudX, hudY + 118);

    hudLabel(ctx, "LINES", hudX, hudY + 152);
    ctx.font = FONT_VALUE;
    ctx.fillStyle = TEXT;
    ctx.fillText(state.lines.toString(), hudX, hudY + 174);
  }

  // B2B / combo indicators
  if (state.backToBack) {
    ctx.font = FONT_BADGE;
    ctx.fillStyle = AMBER;
    ctx.fillText("B2B", hudX, hudY + 204);
  }
  if (state.combo >= 1) {
    ctx.font = FONT_BADGE;
    ctx.fillStyle = ACCENT;
    ctx.fillText(`${state.combo}× COMBO`, hudX, state.backToBack ? hudY + 220 : hudY + 204);
  }

  // Hold piece
  const holdY = hudY + 240;
  hudLabel(ctx, "HOLD", hudX, holdY);

  if (state.heldPiece !== null) {
    drawSmallPiece(ctx, hudX, holdY + 8, state.heldPiece, cellSize * 0.5, state.hasSwappedThisTurn ? 0.3 : 1);
  }

  // Mute indicator
  ctx.font = FONT_MUTE;
  ctx.fillStyle = audioEnabled ? "#44aa66" : "#885555";
  ctx.fillText(audioEnabled ? "♪  on" : "♪  off", hudX, holdY + 90);

  // Next queue
  const nextY = holdY + 110;
  hudLabel(ctx, "NEXT", hudX, nextY);

  for (let i = 0; i < Math.min(state.nextQueue.length, NEXT_QUEUE_SIZE); i++) {
    drawSmallPiece(ctx, hudX, nextY + 10 + i * (cellSize * 0.5 * 4 + 8), state.nextQueue[i].type, cellSize * 0.5, 1);
  }
}

function drawSmallPiece(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: TetriminoType,
  size: number,
  alpha: number
): void {
  const shape = PIECE_SHAPES[type][0];
  const color = PIECE_COLORS[type];

  ctx.globalAlpha = alpha;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        ctx.fillStyle = color;
        const cx = x + c * size;
        const cy = y + r * size;
        ctx.fillRect(cx + 1, cy + 1, size - 2, size - 2);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawPopups(
  ctx: CanvasRenderingContext2D,
  popups: PopupItem[],
  boardX: number,
  boardY: number,
  boardW: number,
): void {
  const cx = boardX + boardW / 2;
  const baseY = boardY + 80;
  ctx.textAlign = "center";
  ctx.font = FONT_POPUP;
  popups.forEach((p, i) => {
    const alpha = 1 - p.timer / p.duration;
    const dy = (p.timer / p.duration) * -40;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, cx, baseY + i * 28 + dy);
  });
  ctx.globalAlpha = 1;
}
