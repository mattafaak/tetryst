import {
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
} from "../core/constants.ts";
import { loadHighScores } from "../core/high-scores.ts";

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

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cellSize: number,
  isAttractMode?: boolean,
  selectedMode?: GameMode,
  selectedStartLevel?: number,
  audioEnabled?: boolean,
): void {
  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = ctx.canvas.width / dpr;
  const canvasHeight = ctx.canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Clear
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Calculate board position (centered)
  const boardPixelWidth = BOARD_WIDTH * cellSize;
  const boardPixelHeight = VISIBLE_HEIGHT * cellSize;
  const boardX = Math.floor((canvasWidth - boardPixelWidth) / 2);
  const boardY = Math.floor((canvasHeight - boardPixelHeight) / 2);

  // Draw board background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(boardX, boardY, boardPixelWidth, boardPixelHeight);

  // Draw board border
  ctx.strokeStyle = "#2a2a3e";
  ctx.lineWidth = 2;
  ctx.strokeRect(boardX, boardY, boardPixelWidth, boardPixelHeight);

  // Draw grid lines
  ctx.beginPath();
  ctx.strokeStyle = "#1e1e2e";
  ctx.lineWidth = 0.5;
  for (let row = 1; row < VISIBLE_HEIGHT; row++) {
    ctx.moveTo(boardX, boardY + row * cellSize);
    ctx.lineTo(boardX + boardPixelWidth, boardY + row * cellSize);
  }
  for (let col = 1; col < BOARD_WIDTH; col++) {
    ctx.moveTo(boardX + col * cellSize, boardY);
    ctx.lineTo(boardX + col * cellSize, boardY + boardPixelHeight);
  }
  ctx.stroke();

  // Draw locked cells (only visible portion)
  for (let row = 0; row < VISIBLE_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const boardRow = row + BUFFER_HEIGHT;
      const cell = state.board[boardRow]?.[col];
      if (cell) {
        const color = PIECE_COLORS[cell as TetriminoType];
        drawCell(ctx, boardX, boardY, col, row, color, cellSize);
      }
    }
  }

  // Draw ghost piece
  if (state.activePiece && state.phase === GamePhase.Playing) {
    drawGhost(ctx, boardX, boardY, state.activePiece, state.ghostY, cellSize);
  }

  // Draw active piece
  if (state.activePiece && state.phase === GamePhase.Playing) {
    drawPiece(ctx, boardX, boardY, state.activePiece, cellSize);
  }

  // Draw line clear animation
  if (state.phase === GamePhase.LineClear) {
    drawLineClearAnimation(ctx, boardX, boardY, state, cellSize);
  }

  // Draw popups (floating action text)
  if (state.popups.length > 0) {
    drawPopups(ctx, state.popups, boardX, boardY, boardPixelWidth);
  }

  // Draw overlays
  if (isAttractMode) {
    drawAttractOverlay(ctx, canvasWidth, canvasHeight);
  } else if (state.phase === GamePhase.Menu) {
    drawMenu(ctx, canvasWidth, canvasHeight, selectedMode ?? GameMode.Marathon, selectedStartLevel ?? 0, audioEnabled ?? true);
  } else if (state.phase === GamePhase.Paused) {
    drawPause(ctx, canvasWidth, canvasHeight);
  } else if (state.phase === GamePhase.GameOver) {
    drawGameOver(ctx, canvasWidth, canvasHeight, state);
  } else if (state.phase === GamePhase.Victory) {
    drawVictory(ctx, canvasWidth, canvasHeight, state);
  }

  // Draw HUD
  if (!isAttractMode) {
    drawHUD(ctx, boardX + boardPixelWidth + 20, boardY, state, cellSize, audioEnabled ?? true);
  }

  ctx.restore();
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
  col: number,
  row: number,
  color: string,
  cellSize: number
): void {
  const x = boardX + col * cellSize;
  const y = boardY + row * cellSize;
  const inset = 1;

  ctx.fillStyle = color;
  ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);

  // Highlight (top-left shine)
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, 2);
  ctx.fillRect(x + inset, y + inset, 2, cellSize - inset * 2);

  // Shadow (bottom-right)
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + inset, y + cellSize - inset - 2, cellSize - inset * 2, 2);
  ctx.fillRect(x + cellSize - inset - 2, y + inset, 2, cellSize - inset * 2);
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
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
          drawCell(ctx, boardX, boardY, boardCol, visibleRow, color, cellSize);
        }
      }
    }
  }
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
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
          const x = boardX + boardCol * cellSize;
          const y = boardY + visibleRow * cellSize;
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
  boardX: number,
  boardY: number,
  state: GameState,
  cellSize: number
): void {
  const flash = Math.sin(state.lineClearTimer * 0.03) > 0;
  if (!flash) return;

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  for (const boardRow of state.clearedRowIndices) {
    const visibleRow = boardRow - BUFFER_HEIGHT;
    if (visibleRow >= 0 && visibleRow < VISIBLE_HEIGHT) {
      ctx.fillRect(boardX, boardY + visibleRow * cellSize, BOARD_WIDTH * cellSize, cellSize);
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

  // Level selector (Marathon only)
  if (selectedMode === GameMode.Marathon) {
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = TEXT_FAINT;
    ctx.fillText("START LEVEL", cx, cy + 22);

    ctx.font = "bold 26px monospace";
    ctx.fillStyle = AMBER;
    ctx.fillText((selectedStartLevel + 1).toString(), cx, cy + 50);
  }

  const promptY = selectedMode === GameMode.Marathon ? cy + 96 : cy + 30;

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

function drawPause(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  overlayBg(ctx, canvasWidth, canvasHeight, 0.72);
  ctx.textAlign = "center";

  ctx.letterSpacing = "6px";
  ctx.font = "bold 40px monospace";
  ctx.fillStyle = TEXT;
  ctx.fillText("PAUSED", cx, cy - 4);
  ctx.letterSpacing = "0px";

  ctx.font = "13px monospace";
  ctx.fillStyle = TEXT_DIM;
  ctx.fillText("press P to resume", cx, cy + 28);
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
    ctx.fillStyle = state.modeTimer < 30000 ? RED : TEXT;
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
    ctx.fillText(`${state.combo + 1}× COMBO`, hudX, state.backToBack ? hudY + 220 : hudY + 204);
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
