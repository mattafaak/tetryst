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
} from "../core/constants.ts";
import { loadHighScores } from "../core/high-scores.ts";


export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cellSize: number,
  isAttractMode?: boolean,
  selectedMode?: GameMode,
  selectedStartLevel?: number,
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
  const boardY = Math.floor(
    (canvasHeight - boardPixelHeight) / 2
  );

  // Draw board background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(boardX, boardY, boardPixelWidth, boardPixelHeight);

  // Draw board border
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.strokeRect(boardX, boardY, boardPixelWidth, boardPixelHeight);

  // Draw grid lines
  ctx.beginPath();
  ctx.strokeStyle = "#222";
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
    drawPiece(
      ctx,
      boardX,
      boardY,
      state.activePiece,
      cellSize
    );
  }

  // Draw line clear animation
  if (state.phase === GamePhase.LineClear) {
    drawLineClearAnimation(
      ctx,
      boardX,
      boardY,
      state,
      cellSize
    );
  }

  // Draw popups (floating action text)
  if (state.popups.length > 0) {
    drawPopups(ctx, state.popups, boardX, boardY, boardPixelWidth);
  }

  // Draw overlays
  if (isAttractMode) {
    drawAttractOverlay(ctx, canvasWidth, canvasHeight, state);
  } else if (state.phase === GamePhase.Menu) {
    drawMenu(ctx, canvasWidth, canvasHeight, selectedMode ?? GameMode.Marathon, selectedStartLevel ?? 0);
  } else if (state.phase === GamePhase.Paused) {
    drawPause(ctx, canvasWidth, canvasHeight);
  } else if (state.phase === GamePhase.GameOver) {
    drawGameOver(ctx, canvasWidth, canvasHeight, state);
  } else if (state.phase === GamePhase.Victory) {
    drawVictory(ctx, canvasWidth, canvasHeight, state);
  }

  // Draw HUD
  if (!isAttractMode) {
    drawHUD(
      ctx,
      boardX + boardPixelWidth + 20,
      boardY,
      state,
      cellSize
    );
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
          drawCell(
            ctx,
            boardX,
            boardY,
            boardCol,
            visibleRow,
            color,
            cellSize
          );
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
          ctx.strokeRect(
            x + inset + 1,
            y + inset + 1,
            cellSize - inset * 2 - 2,
            cellSize - inset * 2 - 2
          );
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
  // Flash cleared rows white, alternating every ~105ms
  const flash = Math.sin(state.lineClearTimer * 0.03) > 0;
  if (!flash) return;

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  for (const boardRow of state.clearedRowIndices) {
    const visibleRow = boardRow - BUFFER_HEIGHT;
    if (visibleRow >= 0 && visibleRow < VISIBLE_HEIGHT) {
      ctx.fillRect(
        boardX,
        boardY + visibleRow * cellSize,
        BOARD_WIDTH * cellSize,
        cellSize
      );
    }
  }
}

function drawMenu(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  selectedMode: GameMode,
  selectedStartLevel: number,
): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.fillText("TETRYST", canvasWidth / 2, canvasHeight / 2 - 80);

  // Mode selector
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "#888";
  ctx.fillText("MODE", canvasWidth / 2, canvasHeight / 2 - 28);
  ctx.font = "bold 24px monospace";
  ctx.fillStyle = "#00f0f0";
  ctx.fillText(`< ${selectedMode} >`, canvasWidth / 2, canvasHeight / 2);

  // Level selector (not shown for Sprint/Ultra)
  if (selectedMode === GameMode.Marathon) {
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("START LEVEL", canvasWidth / 2, canvasHeight / 2 + 34);
    ctx.font = "bold 24px monospace";
    ctx.fillStyle = "#f0a000";
    ctx.fillText(`↑ ${selectedStartLevel + 1} ↓`, canvasWidth / 2, canvasHeight / 2 + 58);
  }

  ctx.font = "20px monospace";
  ctx.fillStyle = "#ddd";
  ctx.fillText("Press ENTER to start", canvasWidth / 2, canvasHeight / 2 + 100);

  ctx.font = "14px monospace";
  ctx.fillStyle = "#555";
  ctx.fillText(
    "←/→: Mode  |  Z/Space: Level  |  Arrows: Move  |  C: Hold  |  P: Pause",
    canvasWidth / 2,
    canvasHeight / 2 + 130
  );
}

function drawPause(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", canvasWidth / 2, canvasHeight / 2);

  ctx.font = "16px monospace";
  ctx.fillStyle = "#888";
  ctx.fillText("Press P to resume", canvasWidth / 2, canvasHeight / 2 + 40);
}

function drawGameOver(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: GameState
): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#f44";
  ctx.font = "bold 48px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvasWidth / 2, canvasHeight / 2 - 80);

  ctx.fillStyle = "#fff";
  ctx.font = "24px monospace";
  ctx.fillText(`Score: ${state.score}`, canvasWidth / 2, canvasHeight / 2 - 36);

  ctx.font = "18px monospace";
  ctx.fillStyle = "#aaa";
  ctx.fillText(`Level: ${state.level + 1}  Lines: ${state.lines}`, canvasWidth / 2, canvasHeight / 2 - 4);

  // Top 5 high scores
  const scores = loadHighScores(state.mode).slice(0, 5);
  if (scores.length > 0) {
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#f0a000";
    ctx.fillText("BEST SCORES", canvasWidth / 2, canvasHeight / 2 + 28);
    ctx.font = "13px monospace";
    ctx.fillStyle = "#ccc";
    scores.forEach((s, i) => {
      const label = state.mode === GameMode.Sprint
        ? formatMs(s.score)
        : s.score.toString();
      ctx.fillText(`${i + 1}. ${label}  Lv${s.level + 1}  ${s.lines}L`, canvasWidth / 2, canvasHeight / 2 + 48 + i * 18);
    });
  }

  ctx.font = "16px monospace";
  ctx.fillStyle = "#888";
  ctx.fillText("Press ENTER to restart", canvasWidth / 2, canvasHeight / 2 + 148);
}

function drawVictory(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: GameState,
): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.textAlign = "center";

  if (state.mode === GameMode.Sprint) {
    ctx.fillStyle = "#00f0f0";
    ctx.font = "bold 36px monospace";
    ctx.fillText("SPRINT COMPLETE!", canvasWidth / 2, canvasHeight / 2 - 80);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px monospace";
    ctx.fillText(formatMs(state.modeTimer > 0 ? state.modeTimer : 0), canvasWidth / 2, canvasHeight / 2 - 40);
  } else if (state.mode === GameMode.Ultra) {
    ctx.fillStyle = "#f0a000";
    ctx.font = "bold 36px monospace";
    ctx.fillText("TIME'S UP!", canvasWidth / 2, canvasHeight / 2 - 80);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px monospace";
    ctx.fillText(`Score: ${state.score}`, canvasWidth / 2, canvasHeight / 2 - 40);
  } else {
    ctx.fillStyle = "#f0a000";
    ctx.font = "bold 48px monospace";
    ctx.fillText("YOU WIN!", canvasWidth / 2, canvasHeight / 2 - 80);
    ctx.fillStyle = "#fff";
    ctx.font = "24px monospace";
    ctx.fillText(`Score: ${state.score}`, canvasWidth / 2, canvasHeight / 2 - 36);
  }

  ctx.font = "18px monospace";
  ctx.fillStyle = "#aaa";
  ctx.fillText(`Level: ${state.level + 1}  Lines: ${state.lines}`, canvasWidth / 2, canvasHeight / 2);

  const scores = loadHighScores(state.mode).slice(0, 5);
  if (scores.length > 0) {
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#f0a000";
    ctx.fillText("BEST SCORES", canvasWidth / 2, canvasHeight / 2 + 34);
    ctx.font = "13px monospace";
    ctx.fillStyle = "#ccc";
    scores.forEach((s, i) => {
      const label = state.mode === GameMode.Sprint
        ? formatMs(s.score)
        : s.score.toString();
      ctx.fillText(`${i + 1}. ${label}  Lv${s.level + 1}  ${s.lines}L`, canvasWidth / 2, canvasHeight / 2 + 54 + i * 18);
    });
  }

  ctx.font = "16px monospace";
  ctx.fillStyle = "#888";
  ctx.fillText("Press ENTER for menu", canvasWidth / 2, canvasHeight / 2 + 154);
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
  cellSize: number
): void {
  ctx.textAlign = "left";

  if (state.mode === GameMode.Sprint) {
    // Sprint: elapsed time + lines remaining
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("TIME", hudX, hudY + 20);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText(formatMs(state.modeTimer), hudX, hudY + 45);

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("LINES LEFT", hudX, hudY + 80);
    ctx.fillStyle = "#00f0f0";
    ctx.font = "20px monospace";
    const linesLeft = Math.max(0, 40 - state.lines);
    ctx.fillText(linesLeft.toString(), hudX, hudY + 105);
  } else if (state.mode === GameMode.Ultra) {
    // Ultra: countdown timer + score
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("TIME LEFT", hudX, hudY + 20);
    const timeColor = state.modeTimer < 30000 ? "#f44" : "#fff";
    ctx.fillStyle = timeColor;
    ctx.font = "bold 22px monospace";
    ctx.fillText(formatMs(state.modeTimer), hudX, hudY + 48);

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("SCORE", hudX, hudY + 82);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText(state.score.toString(), hudX, hudY + 107);
  } else {
    // Marathon: score + level + lines
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("SCORE", hudX, hudY + 20);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText(state.score.toString(), hudX, hudY + 45);

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("LEVEL", hudX, hudY + 80);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText((state.level + 1).toString(), hudX, hudY + 105);

    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("LINES", hudX, hudY + 140);
    ctx.fillStyle = "#fff";
    ctx.font = "20px monospace";
    ctx.fillText(state.lines.toString(), hudX, hudY + 165);
  }

  // B2B indicator
  if (state.backToBack) {
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#f0a000";
    ctx.fillText("B2B", hudX, hudY + 195);
  }

  // Combo counter (shown when active: combo >= 1, so 0-bonus first clears are not shown)
  if (state.combo >= 1) {
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#00f0f0";
    ctx.fillText(`${state.combo + 1}× COMBO`, hudX, state.backToBack ? hudY + 212 : hudY + 195);
  }

  // Hold piece
  const holdY = hudY + 235;
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "#888";
  ctx.fillText("HOLD", hudX, holdY);

  if (state.heldPiece !== null) {
    drawSmallPiece(
      ctx,
      hudX,
      holdY + 10,
      state.heldPiece,
      cellSize * 0.5,
      state.hasSwappedThisTurn ? 0.3 : 1
    );
  }

  // Next queue
  const nextY = holdY + 130;
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "#888";
  ctx.fillText("NEXT", hudX, nextY);

  for (let i = 0; i < Math.min(state.nextQueue.length, 5); i++) {
    drawSmallPiece(
      ctx,
      hudX,
      nextY + 10 + i * (cellSize * 0.5 * 4 + 8),
      state.nextQueue[i].type,
      cellSize * 0.5,
      1
    );
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

function drawAttractOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  _state: GameState,
): void {
  // Dim the entire screen so the board is visible behind
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.textAlign = "center";

  // Title
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px monospace";
  ctx.fillText("TETRYST", canvasWidth / 2, canvasHeight / 2 - 70);

  // Start prompt
  ctx.font = "20px monospace";
  ctx.fillStyle = "#ddd";
  ctx.fillText("Press ENTER to start", canvasWidth / 2, canvasHeight / 2 + 10);

  // Top 3 Marathon scores
  const topScores = loadHighScores(GameMode.Marathon).slice(0, 3);
  if (topScores.length > 0) {
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#f0a000";
    ctx.fillText("TOP SCORES", canvasWidth / 2, canvasHeight / 2 + 44);
    ctx.font = "13px monospace";
    ctx.fillStyle = "#aaa";
    topScores.forEach((s, i) => {
      ctx.fillText(`${i + 1}. ${s.score}  Lv${s.level + 1}`, canvasWidth / 2, canvasHeight / 2 + 62 + i * 16);
    });
  }

  // Dark bar behind control instructions for readability
  const barHeight = 40;
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, canvasHeight - barHeight, canvasWidth, barHeight);

  // Single-line control legend centered in the dark bar
  ctx.font = "14px monospace";
  ctx.fillStyle = "#aaa";
  ctx.fillText(
    "Arrows: Move  |  Z: Rotate  |  Space: Drop  |  C: Hold  |  P: Pause",
    canvasWidth / 2,
    canvasHeight - barHeight / 2 + 5
  );
}
