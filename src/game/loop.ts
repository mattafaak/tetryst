import { type GameState, type InputAction, GamePhase, GameMode } from "../core/types.ts";
import { processAction } from "../core/actions.ts";
import { applyGravity } from "../core/gravity.ts";
import { shouldLock as checkLock, resetLockState } from "../core/lock-delay.ts";
import { lockPiece, clearLines, isLockOut } from "../core/board.ts";
import { updateEntryDelay } from "../core/entry-delay.ts";
import { updateCombo } from "../core/combo.ts";
import { evaluateClear, detectTSpin, effectiveLinesFor, calculateLevelFromEffective } from "../core/scoring.ts";
import { createInitialState, startGame, spawnNextPiece } from "../core/state.ts";
import { renderFrame } from "../render/canvas.ts";
import { KeyboardHandler } from "../input/keyboard.ts";
import { playSFX } from "../audio/sfx.ts";
import { playMusic, stopMusic } from "../audio/music.ts";
import { AIController, createAttractAIController } from "../ai/ai-controller.ts";
import {
  LINE_CLEAR_ANIM_DURATION,
  MARATHON_MAX_LEVEL,
} from "../core/constants.ts";
import { checkModeVictory } from "../core/mode-rules.ts";
import { saveHighScore } from "../core/high-scores.ts";
import { pushPopup, tickPopups } from "../render/popups.ts";

const GAME_MODES: GameMode[] = [GameMode.Marathon, GameMode.Sprint, GameMode.Ultra];

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
  private selectedMode: GameMode = GameMode.Marathon;
  private selectedStartLevel: number = 0;

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
    // During attract mode: Enter starts a game immediately; any other key
    // returns to the menu so the player can choose mode and level first.
    if (this.isAttractMode) {
      this.exitAttractMode();
      this.state = createInitialState(this.selectedMode);
      this.prevPhase = GamePhase.Menu;
      if (action.type === "Start") {
        this.state = startGame(this.state, this.selectedStartLevel);
        return;
      }
      // Navigation and other keys fall through to the Menu handler below.
    }

    if (this.state.phase === GamePhase.Menu) {
      if (action.type === "Start") {
        this.state = startGame(
          createInitialState(this.selectedMode),
          this.selectedStartLevel,
        );
        return;
      }
      if (action.type === "MoveLeft") {
        const idx = GAME_MODES.indexOf(this.selectedMode);
        this.selectedMode = GAME_MODES[(idx - 1 + GAME_MODES.length) % GAME_MODES.length];
        return;
      }
      if (action.type === "MoveRight") {
        const idx = GAME_MODES.indexOf(this.selectedMode);
        this.selectedMode = GAME_MODES[(idx + 1) % GAME_MODES.length];
        return;
      }
      if (action.type === "RotateCW" || action.type === "SoftDrop") {
        this.selectedStartLevel = Math.min(MARATHON_MAX_LEVEL - 1, this.selectedStartLevel + 1);
        return;
      }
      if (action.type === "RotateCCW" || action.type === "HardDrop") {
        this.selectedStartLevel = Math.max(0, this.selectedStartLevel - 1);
        return;
      }
    }

    if (action.type === "Mute") {
      this.audioEnabled = !this.audioEnabled;
      if (!this.audioEnabled) {
        stopMusic();
      } else if (this.state.phase === GamePhase.Playing) {
        playMusic();
      }
      return;
    }

    if (action.type === "Start" && this.state.phase === GamePhase.GameOver) {
      this.state = startGame(createInitialState(this.selectedMode), this.selectedStartLevel);
      return;
    }

    if (action.type === "Start" && this.state.phase === GamePhase.Victory) {
      this.state = createInitialState(this.selectedMode);
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

    // Hard-drop locks the piece immediately and bypasses lockActivePiece, so
    // checkModeVictory is never reached via the normal gravity-lock path.
    if (action.type === "HardDrop" && checkModeVictory(this.state)) {
      this.triggerVictory();
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
    renderFrame(
      this.ctx,
      this.state,
      this.cellSize,
      this.isAttractMode,
      this.selectedMode,
      this.selectedStartLevel,
      this.audioEnabled,
    );

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
      case GamePhase.Victory:
      case GamePhase.GameOver:
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
      case GamePhase.Victory:
        stopMusic();
        break;
    }
  }

  private updatePlaying(dt: number): void {
    // Tick popups
    this.state = tickPopups(this.state, dt);

    // Ultra countdown
    if (this.state.mode === GameMode.Ultra) {
      this.state = {
        ...this.state,
        modeTimer: Math.max(0, this.state.modeTimer - dt),
      };
      if (checkModeVictory(this.state)) {
        this.triggerVictory();
        return;
      }
    }

    const gravResult = applyGravity(this.state, dt);
    this.state = gravResult.state;

    const lockResult = checkLock(this.state, dt);
    this.state = lockResult.state;

    if (lockResult.shouldLock) {
      this.lockActivePiece();
    }
  }

  private triggerVictory(): void {
    const scoreToSave = this.state.mode === GameMode.Sprint
      ? this.state.modeTimer
      : this.state.score;
    saveHighScore({
      score: scoreToSave,
      level: this.state.level,
      lines: this.state.lines,
      mode: this.state.mode,
    });
    this.state = { ...this.state, phase: GamePhase.Victory };
  }

  private lockActivePiece(): void {
    if (!this.state.activePiece) return;

    if (this.audioEnabled) playSFX("lock");

    const lockedPiece = this.state.activePiece;
    this.state.board = lockPiece(this.state.board, lockedPiece);
    this.state.activePiece = null;

    // Lock-Out: all minos in buffer zone ends the game (TDG §8)
    if (isLockOut(lockedPiece)) {
      this.state.lockState = resetLockState();
      this.state.phase = GamePhase.GameOver;
      return;
    }

    const tSpinResult = detectTSpin(this.state.board, lockedPiece);  // detect on locked-but-pre-clear board

    const clearResult = clearLines(this.state.board);
    this.state.board = clearResult.board;

    if (clearResult.linesCleared > 0) {
      this.state.clearedRowIndices = clearResult.clearedRowIndices;
      this.playLockSFX(clearResult.linesCleared, tSpinResult);

      const comboResult = updateCombo(this.state, clearResult.linesCleared);
      this.state = comboResult.state;

      const isPerfectClear = this.checkPerfectClear();
      const wasB2BActive = this.state.backToBack;
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

      if (this.state.mode === GameMode.Marathon) {
        const eff = effectiveLinesFor(
          clearResult.linesCleared,
          tSpinResult,
          scoreResult.isB2B && wasB2BActive,
        );
        this.state.effectiveLines += eff;
        const newLevel = calculateLevelFromEffective(this.state.effectiveLines);
        if (newLevel > this.state.level) {
          this.state.level = Math.min(newLevel, MARATHON_MAX_LEVEL);
          if (this.audioEnabled) playSFX("levelup");
          this.state = pushPopup(this.state, `LEVEL ${this.state.level}!`, "#ffff00");
        }
      }

      // Push action popups
      this.state = this.buildPopups(
        this.state,
        clearResult.linesCleared,
        tSpinResult,
        scoreResult.isB2B,
        isPerfectClear,
        this.state.combo,
      );

      // Check mode victory after scoring
      if (checkModeVictory(this.state)) {
        this.triggerVictory();
        return;
      }

      this.state.phase = GamePhase.LineClear;
      this.state.lineClearTimer = 0;
    } else {
      const comboResult = updateCombo(this.state, 0);
      this.state = comboResult.state;

      // Award T-spin no-clear bonus if applicable
      if (tSpinResult.isTSpin) {
        const wasB2BActive = this.state.backToBack;
        const scoreResult = evaluateClear(
          0,
          tSpinResult,
          this.state.level,
          this.state.backToBack,
          false,
        );
        this.state.score += scoreResult.score;
        this.state.backToBack = scoreResult.isB2B;
        if (this.state.mode === GameMode.Marathon) {
          const eff = effectiveLinesFor(0, tSpinResult, scoreResult.isB2B && wasB2BActive);
          this.state.effectiveLines += eff;
          const newLevel = calculateLevelFromEffective(this.state.effectiveLines);
          if (newLevel > this.state.level) {
            this.state.level = Math.min(newLevel, MARATHON_MAX_LEVEL);
            if (this.audioEnabled) playSFX("levelup");
            this.state = pushPopup(this.state, `LEVEL ${this.state.level}!`, "#ffff00");
          }
        }
        if (this.audioEnabled) playSFX("tspin");
      }

      this.state.phase = GamePhase.EntryDelay;
      this.state.entryDelayTimer = 0;
    }
  }

  private updateLineClear(dt: number): void {
    this.state = tickPopups(this.state, dt);
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
      case GamePhase.Victory:
        this.aiController.reset();
        this.state = startGame(createInitialState());
        this.prevPhase = GamePhase.Playing;
        break;
    }
  }

  private buildPopups(
    state: GameState,
    linesCleared: number,
    tSpinResult: import("../core/types.ts").TSpinResult,
    isB2B: boolean,
    isPerfectClear: boolean,
    combo: number,
  ): GameState {
    let s = state;
    if (linesCleared === 4) {
      s = pushPopup(s, "TETRIS!", "#00f0f0");
    } else if (tSpinResult.isTSpin && linesCleared === 3) {
      s = pushPopup(s, "T-SPIN TRIPLE", "#a000f0");
    } else if (tSpinResult.isTSpin && linesCleared === 2) {
      s = pushPopup(s, "T-SPIN DOUBLE", "#a000f0");
    } else if (tSpinResult.isTSpin && linesCleared === 1) {
      s = pushPopup(s, "T-SPIN SINGLE", "#a000f0");
    } else if (tSpinResult.isTSpin && linesCleared === 0) {
      s = pushPopup(s, "T-SPIN", "#a000f0");
    }
    if (isPerfectClear) {
      s = pushPopup(s, "PERFECT CLEAR!", "#ffffff");
    }
    if (isB2B) {
      s = pushPopup(s, "BACK-TO-BACK", "#f0a000");
    }
    if (combo >= 2) {
      s = pushPopup(s, `${combo}× COMBO`, "#00f0f0");
    }
    return s;
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
