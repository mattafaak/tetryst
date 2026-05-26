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
} from "../core/constants.ts";
import { loadHighScores } from "../core/high-scores.ts";
import { renderBackground } from "./background.ts";
import { renderEffects, spawnClearParticles, setParticleRowKey, getParticleRowKey } from "./effects.ts";

// ── Design tokens ──────────────────────────────────────────────────────
const TEXT       = "#e2e2e2";
const TEXT_DIM   = "#777";
const TEXT_FAINT = "#444";
const ACCENT     = "#00e5ff";
const AMBER      = "#ffb300";
const RED        = "#ff5252";

function fmtScore(n: number): string {
  return n.toLocaleString("en-US");
}

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

  // Board background
  off.fillStyle = "#1a1a2e";
  off.fillRect(0, 0, boardCacheCanvas.width, boardCacheCanvas.height);

  // Border
  off.strokeStyle = "#2a2a3e";
  off.lineWidth = 2;
  off.strokeRect(0, 0, boardCacheCanvas.width, boardCacheCanvas.height);

  // Grid lines
  off.beginPath();
  off.strokeStyle = "#1e1e2e";
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
  showHighScores?: boolean,
  highScoreMode?: GameMode,
): void {
  const dpr = window.devicePixelRatio || 1;
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

  // Draw cached board static layer — only redrawn when board ref changes
  if (state.board !== cachedBoard || cellSize !== cachedCellSize) {
    renderBoardStatic(state.board, cellSize);
    cachedBoard = state.board;
  }
  ctx.drawImage(boardCacheCanvas!, boardX, boardY);

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

  // Draw line clear animation + spawn particles
  if (state.phase === GamePhase.LineClear) {
    drawLineClearAnimation(ctx, state, cellSize);
    spawnClearParticlesOnce(state.clearedRowIndices, boardX, boardY, cellSize);
  }

  ctx.restore();

  // Draw popups (floating action text)
  if (state.popups.length > 0) {
    drawPopups(ctx, state.popups, boardX, boardY, boardPixelWidth);
  }

  // Draw overlays
  if (isAttractMode) {
    drawAttractOverlay(ctx, canvasWidth, canvasHeight);
  } else if (state.phase === GamePhase.Menu && showHighScores) {
    drawHighScores(ctx, canvasWidth, canvasHeight, highScoreMode ?? GameMode.Marathon);
  } else if (state.phase === GamePhase.Menu) {
    drawMenu(ctx, canvasWidth, canvasHeight, selectedMode ?? GameMode.Marathon, selectedStartLevel ?? 0, audioEnabled ?? true);
  } else if (state.phase === GamePhase.Paused) {
    drawPauseMenu(ctx, canvasWidth, canvasHeight, pauseMenuSelection ?? 0);
  } else if (state.phase === GamePhase.GameOver) {
    drawGameOver(ctx, canvasWidth, canvasHeight, state);
  } else if (state.phase === GamePhase.Victory) {
    drawVictory(ctx, canvasWidth, canvasHeight, state);
  }

  // Draw HUD
  if (!isAttractMode) {
    drawHUD(ctx, boardX + boardPixelWidth + 20, boardY, state, cellSize, audioEnabled ?? true);
  }

  // Visual effects (particles, screen flash)
  renderEffects(ctx, canvasWidth, canvasHeight);

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
  const flash = Math.sin(state.lineClearTimer * 0.03) > 0;
  if (!flash) return;

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  for (const boardRow of state.clearedRowIndices) {
    const visibleRow = boardRow - BUFFER_HEIGHT;
    if (visibleRow >= 0 && visibleRow < VISIBLE_HEIGHT) {
      ctx.fillRect(0, visibleRow * cellSize, BOARD_WIDTH * cellSize, cellSize);
    }
  }
}

/** Spawn particles once per line-clear event (not every animation frame).
 *  Row-key tracking is in effects.ts and reset on clearEffects() so it
 *  doesn't leak across game sessions. */
function spawnClearParticlesOnce(
  rows: number[],
  boardX: number,
  boardY: number,
  cellSize: number,
): void {
  const key = rows.join(",");
  if (key === getParticleRowKey()) return;
  setParticleRowKey(key);
  spawnClearParticles(rows, boardX, boardY, cellSize);
}

// ── Overlay helpers ────────────────────────────────────────────────────

function overlayBg(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.82): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

function drawTitle(ctx: CanvasRenderingContext2D, cx: number, y: number): void {
  ctx.letterSpacing = "6px";
  ctx.font = "bold 52px monospace";
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
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(text, x, y);
}

// ── Screen functions ───────────────────────────────────────────────────

function drawMenu(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  selectedMode: GameMode,
  selectedStartLevel: number,
  audioEnabled: boolean,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  overlayBg(ctx, canvasWidth, canvasHeight, 0.85);
  ctx.textAlign = "center";

  drawTitle(ctx, cx, cy - 96);
  rule(ctx, cx, cy - 70);

  // Mode selector
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillText("MODE", cx, cy - 46);

  ctx.font = "bold 26px monospace";
  ctx.fillStyle = ACCENT;
  ctx.fillText(`‹  ${selectedMode}  ›`, cx, cy - 18);

  // Level selector (Marathon only) or mode description (Sprint/Ultra)
  if (selectedMode === GameMode.Marathon) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = TEXT_FAINT;
    ctx.fillText("START LEVEL", cx, cy + 22);

    ctx.font = "bold 26px monospace";
    ctx.fillStyle = AMBER;
    ctx.fillText(`↑  ${selectedStartLevel + 1}  ↓`, cx, cy + 50);
  } else if (selectedMode === GameMode.Sprint) {
    ctx.font = "13px monospace";
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Clear 40 lines as fast as you can", cx, cy + 26);
  } else {
    ctx.font = "13px monospace";
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Score as many points as you can in 2 min", cx, cy + 26);
  }

  const promptY = cy + 96;

  ctx.font = "bold 15px monospace";
  ctx.fillStyle = AMBER;
  ctx.fillText("PRESS  ENTER  TO  START", cx, promptY);

  ctx.font = "12px monospace";
  ctx.fillStyle = TEXT_FAINT;
  const hint = selectedMode === GameMode.Marathon
    ? "← → mode  ·  ↑ ↓ start level  ·  M mute"
    : "← → mode  ·  M mute";
  ctx.fillText(hint, cx, promptY + 24);

  ctx.font = "12px monospace";
  ctx.fillStyle = audioEnabled ? "#44aa66" : "#885555";
  ctx.fillText(audioEnabled ? "♪  on" : "♪  off", cx, promptY + 44);
}

function drawAttractOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  overlayBg(ctx, canvasWidth, canvasHeight, 0.58);
  ctx.textAlign = "center";

  drawTitle(ctx, cx, cy - 58);

  ctx.font = "bold 15px monospace";
  ctx.fillStyle = AMBER;
  ctx.fillText("PRESS  ENTER  TO  PLAY", cx, cy - 8);

  ctx.font = "12px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText("any key to select mode", cx, cy + 14);

  // Top Marathon scores
  const topScores = loadHighScores(GameMode.Marathon).slice(0, 3);
  if (topScores.length > 0) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = AMBER;
    ctx.fillText("TOP  SCORES", cx, cy + 50);
    ctx.font = "13px monospace";
    ctx.fillStyle = TEXT_DIM;
    topScores.forEach((s, i) => {
      ctx.fillText(
        `${i + 1}.  ${fmtScore(s.score)}   Lv ${s.level + 1}`,
        cx,
        cy + 68 + i * 18,
      );
    });
  }

  // Controls bar
  const barH = 38;
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fillRect(0, canvasHeight - barH, canvasWidth, barH);
  ctx.font = "13px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(
    "← → move  ·  Z / X rotate  ·  Space drop  ·  C hold  ·  M mute",
    cx,
    canvasHeight - barH / 2 + 5,
  );
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
  ctx.font = "bold 40px monospace";
  ctx.fillStyle = TEXT;
  ctx.fillText("PAUSED", cx, cy - 64);
  ctx.letterSpacing = "0px";

  // Menu options — color indicates selection; no prefix to avoid font-metric shifting
  ctx.font = "bold 20px monospace";
  PAUSE_OPTIONS.forEach((opt, i) => {
    const y = cy - 8 + i * 32;
    ctx.fillStyle = i === selection ? ACCENT : TEXT;
    ctx.fillText(opt, cx, y);
  });

  // Hint
  ctx.font = "12px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText("↑ ↓ navigate  ·  Enter select  ·  P resume", cx, cy + 86);
}

function drawHighScores(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  mode: GameMode,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  overlayBg(ctx, canvasWidth, canvasHeight, 0.85);
  ctx.textAlign = "center";

  ctx.letterSpacing = "6px";
  ctx.font = "bold 40px monospace";
  ctx.fillStyle = TEXT;
  ctx.fillText("HIGH  SCORES", cx, cy - 130);
  ctx.letterSpacing = "0px";

  // Mode tabs
  ctx.font = "bold 14px monospace";
  const modes = [GameMode.Marathon, GameMode.Sprint, GameMode.Ultra];
  const tabW = 130;
  const tabStartX = cx - (modes.length * tabW) / 2;
  modes.forEach((m, i) => {
    const tx = tabStartX + i * tabW + tabW / 2;
    ctx.fillStyle = m === mode ? ACCENT : TEXT_FAINT;
    ctx.fillText(m === mode ? `‹  ${m}  ›` : m, tx, cy - 98);
  });

  // Scores
  const scores = loadHighScores(mode).slice(0, 10);
  if (scores.length === 0) {
    ctx.font = "16px monospace";
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("No scores yet!", cx, cy - 44);
  } else {
    // Header — fixed-width columns matching data rows below
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = AMBER;
    const scoreLabel = mode === GameMode.Sprint ? "TIME" : "SCORE";
    const hRank = "#    ";
    const hScore = scoreLabel.padEnd(12);
    const hLevel = "LVL ".padEnd(5);
    const hLines = "LINES ".padEnd(7);
    ctx.fillText(`${hRank}${hScore} ${hLevel}${hLines}DATE`, cx, cy - 58);

    // Rows
    ctx.font = "13px monospace";
    scores.forEach((s, i) => {
      const y = cy - 38 + i * 18;
      const primary = mode === GameMode.Sprint ? formatMs(s.score) : fmtScore(s.score);
      const dateStr = s.date ? s.date.slice(0, 10) : "";
      const rank = `${i + 1}.${i < 9 ? "  " : " "}`;
      ctx.fillStyle = i < 3 ? TEXT : TEXT_DIM;
      ctx.fillText(
        `${rank}${primary.padEnd(12)} ${`Lv ${s.level + 1}`.padEnd(5)}${`${s.lines}`.padEnd(7)}${dateStr}`,
        cx,
        y,
      );
    });
  }

  // Footer
  ctx.font = "12px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText("← → mode  ·  H close  ·  any key to return", cx, cy + 98);
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
  ctx.font = "bold 44px monospace";
  ctx.fillStyle = RED;
  ctx.fillText("GAME  OVER", cx, cy - 90);
  ctx.letterSpacing = "0px";

  rule(ctx, cx, cy - 66);

  // Primary stat
  if (state.mode === GameMode.Sprint) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = TEXT_FAINT;
    ctx.fillText("TIME", cx, cy - 44);
    ctx.font = "bold 26px monospace";
    ctx.fillStyle = TEXT;
    ctx.fillText(formatMs(state.modeTimer), cx, cy - 18);
  } else {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = TEXT_FAINT;
    ctx.fillText("SCORE", cx, cy - 44);
    ctx.font = "bold 26px monospace";
    ctx.fillStyle = TEXT;
    ctx.fillText(fmtScore(state.score), cx, cy - 18);
  }

  ctx.font = "14px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`Level ${state.level + 1}   ·   ${state.lines} lines`, cx, cy + 8);

  // High scores
  const scores = loadHighScores(state.mode).slice(0, 5);
  if (scores.length > 0) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = AMBER;
    ctx.fillText("BEST  SCORES", cx, cy + 40);
    ctx.font = "13px monospace";
    ctx.fillStyle = TEXT_DIM;
    scores.forEach((s, i) => {
      const primary = state.mode === GameMode.Sprint ? formatMs(s.score) : fmtScore(s.score);
      ctx.fillText(
        `${i + 1}.  ${primary}   Lv ${s.level + 1}   ${s.lines}L`,
        cx,
        cy + 58 + i * 18,
      );
    });
  }

  ctx.font = "bold 14px monospace";
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
  ctx.font = "bold 44px monospace";
  ctx.fillStyle = headlineColor;
  ctx.fillText(headline, cx, cy - 90);
  ctx.letterSpacing = "0px";

  rule(ctx, cx, cy - 66);

  ctx.font = "bold 11px monospace";
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillText(primaryLabel, cx, cy - 44);
  ctx.font = "bold 26px monospace";
  ctx.fillStyle = TEXT;
  ctx.fillText(primaryValue, cx, cy - 18);

  ctx.font = "14px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText(`Level ${state.level + 1}   ·   ${state.lines} lines`, cx, cy + 8);

  // High scores
  const scores = loadHighScores(state.mode).slice(0, 5);
  if (scores.length > 0) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = AMBER;
    ctx.fillText("BEST  SCORES", cx, cy + 40);
    ctx.font = "13px monospace";
    ctx.fillStyle = TEXT_DIM;
    scores.forEach((s, i) => {
      const primary = state.mode === GameMode.Sprint ? formatMs(s.score) : fmtScore(s.score);
      ctx.fillText(
        `${i + 1}.  ${primary}   Lv ${s.level + 1}   ${s.lines}L`,
        cx,
        cy + 58 + i * 18,
      );
    });
  }

  ctx.font = "bold 14px monospace";
  ctx.fillStyle = AMBER;
  ctx.fillText("PRESS  ENTER  FOR  MENU", cx, cy + 152);
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
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = TEXT_FAINT;
  ctx.fillText(state.mode.toUpperCase(), hudX, hudY + 14);

  if (state.mode === GameMode.Sprint) {
    hudLabel(ctx, "TIME", hudX, hudY + 40);
    ctx.font = "20px monospace";
    ctx.fillStyle = TEXT;
    ctx.fillText(formatMs(state.modeTimer), hudX, hudY + 62);

    hudLabel(ctx, "LINES LEFT", hudX, hudY + 96);
    ctx.font = "20px monospace";
    ctx.fillStyle = ACCENT;
    ctx.fillText(Math.max(0, 40 - state.lines).toString(), hudX, hudY + 118);

  } else if (state.mode === GameMode.Ultra) {
    hudLabel(ctx, "TIME LEFT", hudX, hudY + 40);
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = state.modeTimer < ULTRA_DANGER_THRESHOLD ? RED : TEXT;
    ctx.fillText(formatMs(state.modeTimer), hudX, hudY + 62);

    hudLabel(ctx, "SCORE", hudX, hudY + 96);
    ctx.font = "20px monospace";
    ctx.fillStyle = TEXT;
    ctx.fillText(fmtScore(state.score), hudX, hudY + 118);

  } else {
    // Marathon
    hudLabel(ctx, "SCORE", hudX, hudY + 40);
    ctx.font = "20px monospace";
    ctx.fillStyle = TEXT;
    ctx.fillText(fmtScore(state.score), hudX, hudY + 62);

    hudLabel(ctx, "LEVEL", hudX, hudY + 96);
    ctx.font = "20px monospace";
    ctx.fillStyle = TEXT;
    ctx.fillText((state.level + 1).toString(), hudX, hudY + 118);

    hudLabel(ctx, "LINES", hudX, hudY + 152);
    ctx.font = "20px monospace";
    ctx.fillStyle = TEXT;
    ctx.fillText(state.lines.toString(), hudX, hudY + 174);
  }

  // B2B / combo indicators
  if (state.backToBack) {
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = AMBER;
    ctx.fillText("B2B", hudX, hudY + 204);
  }
  if (state.combo >= 1) {
    ctx.font = "bold 12px monospace";
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
  ctx.font = "11px monospace";
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
  ctx.font = "bold 22px monospace";
  popups.forEach((p, i) => {
    const alpha = 1 - p.timer / p.duration;
    const dy = (p.timer / p.duration) * -40;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, cx, baseY + i * 28 + dy);
  });
  ctx.globalAlpha = 1;
}
