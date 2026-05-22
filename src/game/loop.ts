import { type GameState, type InputAction, GamePhase, TetriminoType } from "../core/types.ts";
import { processAction } from "../core/actions.ts";
import { applyGravity } from "../core/gravity.ts";
import { shouldLock as checkLock } from "../core/lock-delay.ts";
import { lockPiece, clearLines } from "../core/board.ts";
import { updateEntryDelay } from "../core/entry-delay.ts";
import { updateCombo } from "../core/combo.ts";
import { evaluateClear, detectTSpin } from "../core/scoring.ts";
import { createInitialState, startGame, spawnNextPiece } from "../core/state.ts";
import { renderFrame } from "../render/canvas.ts";
import { KeyboardHandler } from "../input/keyboard.ts";
import { playSFX } from "../audio/sfx.ts";
import { playMusic, stopMusic } from "../audio/music.ts";
import { AIController, createAttractAIController } from "../ai/ai-controller.ts";
import {
  LINE_CLEAR_ANIM_DURATION,
  LINES_PER_LEVEL,
} from "../core/constants.ts";

const MAX_DT = 100;

export class Game {
  private state: GameState;
  private keyboard: KeyboardHandler;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private cellSize: number = 30;
  private prevPhase: GamePhase = GamePhase.Menu;
  private aiController: AIController | null = null;
  private audioEnabled: boolean = true;
  private isAttractMode: boolean = false;
  private attractNeedsReset: boolean = false;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.keyboard = new KeyboardHandler();
    this.state = createInitialState();
  }

  start(): void {
    this.keyboard.setCallback((action: InputAction) => {
      this.handleInput(action);
    });
    this.keyboard.attach();
    this.lastTime = performance.now();
    this.cellSize = this.calculateCellSize();
    this.loop(this.lastTime);
  }

  stop(): void {
    this.keyboard.detach();
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private calculateCellSize(): number {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.ctx.canvas;
    const logicalWidth = width / dpr;
    const logicalHeight = height / dpr;
    const byWidth = Math.floor((logicalWidth * 0.5) / 10);
    const byHeight = Math.floor((logicalHeight * 0.9) / 20);
    return Math.min(byWidth, byHeight, 36);
  }

  private handleInput(action: InputAction): void {
    // Any key during attract mode starts a real game
    if (this.isAttractMode) {
      this.exitAttractMode();
      this.prevPhase = GamePhase.Menu;
      this.state = startGame(createInitialState());
      return;
    }

    if (action.type === "Start" && this.state.phase === GamePhase.Menu) {
      this.state = startGame(this.state);
      return;
    }

    if (action.type === "Start" && this.state.phase === GamePhase.GameOver) {
      this.state = startGame(createInitialState());
      return;
    }

    const newState = processAction(this.state, action);
    if (newState !== this.state) {
      if (this.audioEnabled) {
        switch (action.type) {
          case "MoveLeft":
          case "MoveRight":
            playSFX("move");
            break;
          case "RotateCW":
          case "RotateCCW":
            playSFX("rotate");
            break;
          case "HardDrop":
            playSFX("lock");
            break;
          case "Hold":
            playSFX("hold");
            break;
        }
      }
      this.state = newState;
    }
  }

  private playLockSFX(linesCleared: number, tSpinResult: import("../core/types.ts").TSpinResult): void {
    if (!this.audioEnabled) return;
    if (linesCleared === 4) {
      playSFX("tetris");
    } else if (tSpinResult.isTSpin && linesCleared > 0) {
      playSFX("tspin");
    } else if (linesCleared > 0) {
      playSFX("clear");
    }
  }

  private loop = (now: number): void => {
    let dt = now - this.lastTime;
    this.lastTime = now;

    if (dt > MAX_DT) dt = MAX_DT;
    if (dt < 0) dt = 0;

    this.cellSize = this.calculateCellSize();
    this.update(dt);
    renderFrame(this.ctx, this.state, this.cellSize, this.isAttractMode);

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.keyboard.update(dt);

    switch (this.state.phase) {
      case GamePhase.Menu:
        // Start attract mode AI immediately on the menu screen
        if (!this.isAttractMode) {
          this.startAttractMode();
        }
        this.updateAttractGame(dt);
        break;
      case GamePhase.Playing:
        if (this.isAttractMode) {
          this.updateAttractGame(dt);
        } else {
          this.updatePlaying(dt);
        }
        break;
      case GamePhase.LineClear:
        this.updateLineClear(dt);
        break;
      case GamePhase.EntryDelay:
        this.updateEntryDelayPhase(dt);
        break;
    }

    // Handle audio for all phase transitions regardless of source
    if (this.state.phase !== this.prevPhase) {
      this.onPhaseTransition(this.state.phase);
      this.prevPhase = this.state.phase;
    }
  }

  private onPhaseTransition(newPhase: GamePhase): void {
    if (!this.audioEnabled) return;
    switch (newPhase) {
      case GamePhase.Playing:
        playMusic();
        break;
      case GamePhase.Paused:
        stopMusic();
        break;
      case GamePhase.GameOver:
        playSFX("gameover");
        stopMusic();
        break;
    }
  }

  private updatePlaying(dt: number): void {
    const gravResult = applyGravity(this.state, dt);
    this.state = gravResult.state;

    const lockResult = checkLock(this.state, dt);
    this.state = lockResult.state;

    if (lockResult.shouldLock) {
      this.lockActivePiece();
    }
  }

  private lockActivePiece(): void {
    if (!this.state.activePiece) return;

    if (this.audioEnabled) playSFX("lock");

    const lockedPiece = this.state.activePiece;
    this.state.board = lockPiece(this.state.board, lockedPiece);
    this.state.activePiece = null;
    const tSpinResult = detectTSpin(this.state.board, lockedPiece);  // detect on locked-but-pre-clear board

    const clearResult = clearLines(this.state.board);
    this.state.board = clearResult.board;

    if (clearResult.linesCleared > 0) {
      this.state.clearedRowIndices = clearResult.clearedRowIndices;
      this.playLockSFX(clearResult.linesCleared, tSpinResult);

      const comboResult = updateCombo(this.state, clearResult.linesCleared);
      this.state = comboResult.state;

      const isPerfectClear = this.checkPerfectClear();
      const scoreResult = evaluateClear(
        clearResult.linesCleared,
        tSpinResult,
        this.state.level,
        this.state.backToBack,
        isPerfectClear,
      );

      this.state.score += scoreResult.score + comboResult.bonusScore;
      this.state.backToBack = scoreResult.isB2B;
      this.state.lines += clearResult.linesCleared;

      const newLevel = Math.floor(this.state.lines / LINES_PER_LEVEL);
      if (newLevel > this.state.level) {
        this.state.level = newLevel;
        if (this.audioEnabled) playSFX("levelup");
      }

      this.state.phase = GamePhase.LineClear;
      this.state.lineClearTimer = 0;
    } else {
      const comboResult = updateCombo(this.state, 0);
      this.state = comboResult.state;

      // Award T-spin no-clear bonus if applicable
      if (tSpinResult.isTSpin) {
        const scoreResult = evaluateClear(
          0,
          tSpinResult,
          this.state.level,
          this.state.backToBack,
          false,
        );
        this.state.score += scoreResult.score;
        this.state.backToBack = scoreResult.isB2B;
        if (this.audioEnabled) playSFX("tspin");
      }

      this.state.phase = GamePhase.EntryDelay;
      this.state.entryDelayTimer = 0;
    }
  }

  private updateLineClear(dt: number): void {
    this.state.lineClearTimer += dt;
    if (this.state.lineClearTimer >= LINE_CLEAR_ANIM_DURATION) {
      this.state.phase = GamePhase.EntryDelay;
      this.state.entryDelayTimer = 0;
    }
  }

  private updateEntryDelayPhase(dt: number): void {
    const result = updateEntryDelay(this.state, dt);
    this.state = result.state;

    if (result.ready) {
      this.state = spawnNextPiece(this.state);
      this.attractNeedsReset = true;
    }
  }

  private updateAttractGame(dt: number): void {
    if (!this.aiController) return;

    switch (this.state.phase) {
      case GamePhase.Playing: {
        // Reset AI controller if a new piece was just spawned
        if (this.attractNeedsReset) {
          this.aiController.reset();
          this.attractNeedsReset = false;
        }
        const action = this.aiController.update(this.state, dt);
        if (action) {
          this.state = processAction(this.state, action);
        }
        this.updatePlaying(dt);
        break;
      }
      case GamePhase.LineClear:
        this.updateLineClear(dt);
        break;
      case GamePhase.EntryDelay:
        this.updateEntryDelayPhase(dt);
        break;
      case GamePhase.GameOver:
        this.aiController.reset();
        this.state = startGame(createInitialState());
        this.prevPhase = GamePhase.Playing;
        break;
    }
  }

  private startAttractMode(): void {
    this.isAttractMode = true;
    this.audioEnabled = false;
    this.aiController = createAttractAIController();
    this.state = startGame(createInitialState());
    this.prevPhase = GamePhase.Playing;
  }

  private exitAttractMode(): void {
    this.isAttractMode = false;
    this.audioEnabled = true;
    this.aiController = null;
  }

  private checkPerfectClear(): boolean {
    for (let row = 0; row < this.state.board.length; row++) {
      for (let col = 0; col < this.state.board[row].length; col++) {
        if (this.state.board[row][col] !== null) {
          return false;
        }
      }
    }
    return true;
  }
}
