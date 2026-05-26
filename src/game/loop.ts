import { type GameState, type InputAction, type PopupItem, GamePhase, GameMode } from "../core/types.ts";
import { processAction } from "../core/actions.ts";
import { applyGravity } from "../core/gravity.ts";
import { shouldLock as checkLock, resetLockState } from "../core/lock-delay.ts";
import { lockPiece, isLockOut } from "../core/board.ts";
import { updateEntryDelay } from "../core/entry-delay.ts";
import { executeLock } from "../core/lock.ts";
import { createInitialState, startGame, spawnNextPiece } from "../core/state.ts";
import { renderFrame } from "../render/canvas.ts";
import { KeyboardHandler } from "../input/keyboard.ts";
import { playSFX } from "../audio/sfx.ts";
import { playMusic, stopMusic } from "../audio/music.ts";
import { AIController, createAttractAIController } from "../ai/ai-controller.ts";
import { LINE_CLEAR_ANIM_DURATION, MARATHON_MAX_LEVEL } from "../core/constants.ts";
import { saveHighScore } from "../core/high-scores.ts";
import { pushPopup, tickPopups } from "../render/popups.ts";
import { triggerFlash, clearEffects } from "../render/effects.ts";

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
  private menuIsStatic: boolean = false;
  private attractNeedsReset: boolean = false;
  private selectedMode: GameMode = GameMode.Marathon;
  private selectedStartLevel: number = 0;
  private pauseMenuSelection = 0;
  private showHighScores = false;
  private highScoreMode: GameMode = GameMode.Marathon;

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
    this.recalcCellSize();
    window.addEventListener("resize", this.recalcCellSize);
    // Guard for non-browser test environments
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
    this.loop(this.lastTime);
  }

  stop(): void {
    this.keyboard.detach();
    window.removeEventListener("resize", this.recalcCellSize);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /** Auto-pause when the tab loses focus so the game loop doesn't accumulate
   *  invisible time (especially important for Ultra mode's countdown). */
  private onVisibilityChange = (): void => {
    if (typeof document !== "undefined" && document.hidden && this.state.phase === GamePhase.Playing) {
      this.handleInput({ type: "Pause" });
    }
  };

  private recalcCellSize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.ctx.canvas;
    const logicalWidth = width / dpr;
    const logicalHeight = height / dpr;
    const byWidth = Math.floor((logicalWidth * 0.5) / 10);
    const byHeight = Math.floor((logicalHeight * 0.9) / 20);
    this.cellSize = Math.max(1, Math.min(byWidth, byHeight, 36));
  };

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
      // Navigation and other keys return to the static menu.
      this.menuIsStatic = true;
      // Fall through to the Menu handler below.
    }

    if (this.state.phase === GamePhase.Menu) {
      // High score screen is active — handle its navigation
      if (this.showHighScores) {
        if (action.type === "ShowHighScores") {
          this.showHighScores = false;
          return;
        }
        if (action.type === "MoveLeft") {
          const idx = GAME_MODES.indexOf(this.highScoreMode);
          this.highScoreMode = GAME_MODES[(idx - 1 + GAME_MODES.length) % GAME_MODES.length];
          return;
        }
        if (action.type === "MoveRight") {
          const idx = GAME_MODES.indexOf(this.highScoreMode);
          this.highScoreMode = GAME_MODES[(idx + 1) % GAME_MODES.length];
          return;
        }
        // Any other key dismisses high scores
        this.showHighScores = false;
        return;
      }

      // Handle toggle to high score screen
      if (action.type === "ShowHighScores") {
        this.showHighScores = true;
        this.highScoreMode = this.selectedMode;
        return;
      }

      if (action.type === "Start") {
        this.menuIsStatic = false;
        clearEffects();
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
      if (action.type === "RotateCW") {
        this.selectedStartLevel = (this.selectedStartLevel + 1) % MARATHON_MAX_LEVEL;
        return;
      }
      if (action.type === "RotateCCW" || action.type === "SoftDrop") {
        this.selectedStartLevel = (this.selectedStartLevel - 1 + MARATHON_MAX_LEVEL) % MARATHON_MAX_LEVEL;
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

    // During pause: navigation + selection, or resume
    if (this.state.phase === GamePhase.Paused) {
      if (action.type === "Pause") {
        this.pauseMenuSelection = 0;
        const newState = processAction(this.state, action);
        if (newState !== this.state) this.state = newState;
        return;
      }
      if (action.type === "RotateCW" || action.type === "MoveLeft") {
        this.pauseMenuSelection = (this.pauseMenuSelection - 1 + 3) % 3;
        return;
      }
      if (action.type === "SoftDrop" || action.type === "MoveRight") {
        this.pauseMenuSelection = (this.pauseMenuSelection + 1) % 3;
        return;
      }
      if (action.type === "Start") {
        if (this.pauseMenuSelection === 0) {
          // Resume
          this.pauseMenuSelection = 0;
          this.state = { ...this.state, phase: GamePhase.Playing };
        } else if (this.pauseMenuSelection === 1) {
          // Restart
          this.pauseMenuSelection = 0;
          clearEffects();
          this.state = startGame(createInitialState(this.selectedMode), this.selectedStartLevel);
          this.prevPhase = GamePhase.Playing;
        } else {
          // Quit to Menu
          this.pauseMenuSelection = 0;
          this.state = createInitialState(this.selectedMode);
          this.menuIsStatic = true;
          this.prevPhase = GamePhase.Menu;
        }
        return;
      }
      // All other actions ignored during pause
      return;
    }

    if (action.type === "Start" && this.state.phase === GamePhase.GameOver) {
      clearEffects();
      this.state = startGame(createInitialState(this.selectedMode), this.selectedStartLevel);
      return;
    }

    if (action.type === "Start" && this.state.phase === GamePhase.Victory) {
      clearEffects();
      this.menuIsStatic = true;
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

      // Hard-drop locks bypass lockActivePiece, so handle flash and SFX here
      // using the transient lastLockResult set by executeLock.
      if (action.type === "HardDrop") {
        const r = this.state.lastLockResult;
        if (r) {
          if (this.audioEnabled) {
            if (r.linesCleared > 0) {
              if (r.linesCleared === 4) {
                playSFX("tetris");
              } else if (r.isTSpin) {
                playSFX("tspin");
              } else {
                playSFX("clear");
              }
            }
            if (r.needsLevelupSFX) playSFX("levelup");
            if (r.needsTSpinSFX) playSFX("tspin");
          }

          // Screen flash for major events
          if (r.linesCleared === 4) {
            triggerFlash("#ffffff", 160);
          } else if (r.isTSpin && r.linesCleared >= 2) {
            triggerFlash("#ffb300", 160);
          }
          if (r.isPerfectClear) {
            triggerFlash("#ffffff", 200);
          }

          // executeLock already checked victory; use its result
          if (r.victoryTriggered) {
            this.triggerVictory();
          }
        }
        // Clear transient field so it doesn't pollute future frames
        this.state.lastLockResult = undefined;
      }
    }
  }

  private loop = (now: number): void => {
    try {
      let dt = now - this.lastTime;
      this.lastTime = now;

      if (dt > MAX_DT) dt = MAX_DT;
      if (dt < 0) dt = 0;
      if (isNaN(dt)) dt = 0;

      this.update(dt);
      renderFrame(
        this.ctx,
        this.state,
        this.cellSize,
        this.isAttractMode,
        this.selectedMode,
        this.selectedStartLevel,
        this.audioEnabled,
        this.pauseMenuSelection,
        this.showHighScores,
        this.highScoreMode,
      );
    } catch (err) {
      console.error("Game loop error:", err);
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // Don't accumulate DAS/ARR timers while paused (held keys would fire
    // immediately on unpause otherwise).
    if (this.state.phase !== GamePhase.Paused) {
      this.keyboard.update(dt);
    }

    switch (this.state.phase) {
      case GamePhase.Menu:
        if (!this.isAttractMode && !this.menuIsStatic) {
          this.startAttractMode();
        }
        if (this.isAttractMode) {
          this.updateAttractGame(dt);
        }
        break;
      case GamePhase.Playing:
        if (this.isAttractMode) {
          this.updateAttractGame(dt);
        } else {
          this.updatePlaying(dt);
        }
        break;
      case GamePhase.LineClear:
        // Ultra mode timer counts down during line-clear animation (fix 5.4)
        this.state = this.applyUltraTimer(this.state, dt);
        this.updateLineClear(dt);
        break;
      case GamePhase.EntryDelay:
        // Ultra mode timer counts down during entry delay (fix 5.4)
        this.state = this.applyUltraTimer(this.state, dt);
        this.updateEntryDelayPhase(dt);
        break;
      case GamePhase.Victory:
      case GamePhase.GameOver:
        if (this.isAttractMode) {
          this.restartAttractGame();
        }
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

  /** Apply Ultra countdown in non-Playing phases so timer stays continuous.
   *  Returns Victory-phase state when time expires so the caller's assignment
   *  propagates the phase correctly (fix 12.1: side-effect triggerVictory was
   *  overwritten by the returned spread from the original state parameter). */
  private applyUltraTimer(state: GameState, dt: number): GameState {
    if (state.mode !== GameMode.Ultra) return state;
    const next = Math.max(0, state.modeTimer - dt);
    if (next <= 0) {
      saveHighScore({
        score: state.score,
        level: state.level,
        lines: state.lines,
        mode: state.mode,
      });
      return { ...state, modeTimer: 0, phase: GamePhase.Victory };
    }
    return { ...state, modeTimer: next };
  }

  private updatePlaying(dt: number): void {
    // Single spread combining popup tick + mode timer (reduces per-frame
    // GameState spreads from 2→1 in the Playing hot path — fix 8.4).
    this.state = this.tickPlayingState(this.state, dt);

    const gravResult = applyGravity(this.state, dt);
    this.state = gravResult.state;

    const lockResult = checkLock(this.state, dt);
    this.state = lockResult.state;

    if (lockResult.shouldLock) {
      this.lockActivePiece();
    }
  }

  /** Combine popup expiry + mode timer update into a single state spread. */
  private tickPlayingState(state: GameState, dt: number): GameState {
    const nextPopups: PopupItem[] = [];
    for (const p of state.popups) {
      const t = p.timer + dt;
      if (t < p.duration) nextPopups.push({ ...p, timer: t });
    }
    let nextTimer: number | undefined;
    if (state.mode === GameMode.Ultra) {
      nextTimer = Math.max(0, state.modeTimer - dt);
      if (nextTimer <= 0) {
        saveHighScore({
          score: state.score,
          level: state.level,
          lines: state.lines,
          mode: state.mode,
        });
        return { ...state, popups: nextPopups, modeTimer: 0, phase: GamePhase.Victory };
      }
    } else if (state.mode === GameMode.Sprint) {
      nextTimer = state.modeTimer + dt;
    }
    if (nextTimer !== undefined) {
      return { ...state, popups: nextPopups, modeTimer: nextTimer };
    }
    return { ...state, popups: nextPopups };
  }

  private triggerVictory(): void {
    if (this.state.phase === GamePhase.Victory) return;
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

    const result = executeLock(this.state, lockedPiece);
    this.state = result.state;

    // Play SFX based on what happened
    if (this.audioEnabled) {
      if (result.linesCleared > 0) {
        if (result.linesCleared === 4) {
          playSFX("tetris");
        } else if (result.tSpinResult.isTSpin) {
          playSFX("tspin");
        } else {
          playSFX("clear");
        }
      }
      if (result.needsLevelupSFX) playSFX("levelup");
      if (result.needsTSpinSFX) playSFX("tspin");
    }

    // Screen flash for major events
    if (result.linesCleared === 4) {
      triggerFlash("#ffffff", 160);
    } else if (result.tSpinResult.isTSpin && result.linesCleared >= 2) {
      triggerFlash("#ffb300", 160);
    }
    if (result.isPerfectClear) {
      triggerFlash("#ffffff", 200);
    }

    // Apply popups
    for (const popup of result.popupInfo) {
      this.state = pushPopup(this.state, popup.text, popup.color);
    }

    // Check mode victory after all scoring
    if (result.victoryTriggered) {
      this.triggerVictory();
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
    }
  }

  private restartAttractGame(): void {
    this.aiController?.reset();
    clearEffects();
    this.state = startGame(createInitialState(this.selectedMode));
    this.prevPhase = GamePhase.Playing;
  }

  private startAttractMode(): void {
    this.isAttractMode = true;
    this.audioEnabled = false;
    this.aiController = createAttractAIController();
    clearEffects();
    this.state = startGame(createInitialState(this.selectedMode));
    this.prevPhase = GamePhase.Playing;
  }

  private exitAttractMode(): void {
    this.isAttractMode = false;
    this.audioEnabled = true;
    this.aiController = null;
  }
}
