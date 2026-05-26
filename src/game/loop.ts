import { type GameState, type InputAction, GamePhase, GameMode } from "../core/types.ts";
import { processAction } from "../core/actions.ts";
import { applyGravity } from "../core/gravity.ts";
import { shouldLock as checkLock, resetLockState } from "../core/lock-delay.ts";
import { lockPiece, isLockOut } from "../core/board.ts";
import { updateEntryDelay } from "../core/entry-delay.ts";
import { checkModeVictory } from "../core/mode-rules.ts";
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
    this.loop(this.lastTime);
  }

  stop(): void {
    this.keyboard.detach();
    window.removeEventListener("resize", this.recalcCellSize);
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private recalcCellSize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.ctx.canvas;
    const logicalWidth = width / dpr;
    const logicalHeight = height / dpr;
    const byWidth = Math.floor((logicalWidth * 0.5) / 10);
    const byHeight = Math.floor((logicalHeight * 0.9) / 20);
    this.cellSize = Math.min(byWidth, byHeight, 36);
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
      this.state = startGame(createInitialState(this.selectedMode), this.selectedStartLevel);
      return;
    }

    if (action.type === "Start" && this.state.phase === GamePhase.Victory) {
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
    }

    // Hard-drop locks the piece immediately and bypasses lockActivePiece, so
    // checkModeVictory is never reached via the normal gravity-lock path.
    if (action.type === "HardDrop" && checkModeVictory(this.state)) {
      this.triggerVictory();
    }
  }

  private loop = (now: number): void => {
    let dt = now - this.lastTime;
    this.lastTime = now;

    if (dt > MAX_DT) dt = MAX_DT;
    if (dt < 0) dt = 0;

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

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // Don't accumulate DAS/ARR timers while paused (held keys would fire
    // immediately on unpause otherwise).
    if (this.state.phase !== GamePhase.Paused) {
      this.keyboard.update(dt);
    }

    // Mode timer runs every frame regardless of phase so Ultra countdown
    // doesn't pause during line-clear animation or entry delay.
    this.updateModeTimer(dt);

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
        this.updateLineClear(dt);
        break;
      case GamePhase.EntryDelay:
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

  private updateModeTimer(dt: number): void {
    if (this.state.phase === GamePhase.Victory) return;
    if (this.state.mode === GameMode.Ultra) {
      const next = Math.max(0, this.state.modeTimer - dt);
      this.state = { ...this.state, modeTimer: next };
      if (next <= 0) {
        this.triggerVictory();
      }
    } else if (this.state.mode === GameMode.Sprint && this.state.phase === GamePhase.Playing) {
      this.state = { ...this.state, modeTimer: this.state.modeTimer + dt };
    }
  }

  private updatePlaying(dt: number): void {
    // Tick popups
    this.state = tickPopups(this.state, dt);

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
    this.state = startGame(createInitialState());
    this.prevPhase = GamePhase.Playing;
  }

  private startAttractMode(): void {
    this.isAttractMode = true;
    this.audioEnabled = false;
    this.aiController = createAttractAIController();
    this.state = startGame(createInitialState(this.selectedMode));
    this.prevPhase = GamePhase.Playing;
  }

  private exitAttractMode(): void {
    this.isAttractMode = false;
    this.audioEnabled = true;
    this.aiController = null;
  }
}
