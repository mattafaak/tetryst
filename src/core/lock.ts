import { type GameState, type Piece, type TSpinResult, GamePhase, GameMode } from "./types.ts";
import { clearLines, isPerfectClear } from "./board.ts";
import { detectTSpin, evaluateClear, effectiveLinesFor, calculateLevelFromEffective } from "./scoring.ts";
import { updateCombo } from "./combo.ts";
import { MARATHON_MAX_LEVEL } from "./constants.ts";
import { checkModeVictory } from "./mode-rules.ts";
import { canonicalKeypresses } from "./finesse.ts";

interface LockResult {
  state: GameState;
  linesCleared: number;
  isPerfectClear: boolean;
  tSpinResult: TSpinResult;
  scoreResult: import("./types.ts").ScoreResult;
  comboBonus: number;
  victoryTriggered: boolean;
  popupInfo: Array<{ text: string; color: string }>;
  needsLevelupSFX: boolean;
  needsTSpinSFX: boolean;
  needsFinesseSFX: boolean;
}

/**
 * Execute the common scoring/lock sequence shared by hard-drop and gravity-lock paths.
 *
 * Given a state with a piece already locked into the board (and `activePiece`
 * already set to null), this detects T-spin, clears lines, updates scoring
 * (combo, B2B, Marathon level), pushes popups, and checks for mode victory.
 *
 * Returns a LockResult containing the new state and metadata the caller can
 * use to play SFX and trigger victory externally.
 */
export function executeLock(state: GameState, lockedPiece: Piece): LockResult {
  const canonical = canonicalKeypresses(lockedPiece.type, lockedPiece.rotation, lockedPiece.pos.x);
  const hasFault = state.currentPieceKeypresses > canonical;
  let s = {
    ...state,
    piecesPlaced: state.piecesPlaced + 1,
    finesseFaults: hasFault ? state.finesseFaults + 1 : state.finesseFaults,
  };

  const tSpinResult = detectTSpin(s.board, lockedPiece, s.lockState.lastRotationKickIndex);
  const clearResult = clearLines(s.board);
  s.board = clearResult.board;

  let linesCleared = 0;
  let isPC = false;
  let scoreResult: import("./types.ts").ScoreResult = {
    score: 0, isB2B: false, isB2BBroken: false,
  };
  let comboBonus = 0;
  let combo = 0;
  let victoryTriggered = false;
  const popupInfo: Array<{ text: string; color: string }> = [];
  let needsLevelupSFX = false;
  let needsTSpinSFX = false;

  if (clearResult.linesCleared > 0) {
    linesCleared = clearResult.linesCleared;
    s.clearedRowIndices = clearResult.clearedRowIndices;

    const comboResult = updateCombo(s, clearResult.linesCleared);
    s = comboResult.state;
    comboBonus = comboResult.bonusScore;
    combo = s.combo;

    isPC = isPerfectClear(s.board);
    const wasB2BActive = s.backToBack;
    scoreResult = evaluateClear(
      clearResult.linesCleared,
      tSpinResult,
      s.level,
      s.backToBack,
      isPC,
    );

    s.score += scoreResult.score + comboBonus;
    s.backToBack = scoreResult.isB2B;
    s.lines += clearResult.linesCleared;

    if (s.mode === GameMode.Marathon) {
      const eff = effectiveLinesFor(
        clearResult.linesCleared,
        tSpinResult,
        scoreResult.isB2B && wasB2BActive,
      );
      s.effectiveLines += eff;
      const newLevel = calculateLevelFromEffective(s.effectiveLines);
      if (newLevel > s.level) {
        s.level = Math.min(newLevel, MARATHON_MAX_LEVEL);
        needsLevelupSFX = true;
      }
    }

    // Build popup info
    if (linesCleared === 4) {
      popupInfo.push({ text: "TETRIS!", color: "#00f0f0" });
    } else if (tSpinResult.isMini && linesCleared >= 1) {
      popupInfo.push({ text: "T-SPIN MINI", color: "#a000f0" });
    } else if (tSpinResult.isTSpin && linesCleared === 3) {
      popupInfo.push({ text: "T-SPIN TRIPLE", color: "#a000f0" });
    } else if (tSpinResult.isTSpin && linesCleared === 2) {
      popupInfo.push({ text: "T-SPIN DOUBLE", color: "#a000f0" });
    } else if (tSpinResult.isTSpin && linesCleared === 1) {
      popupInfo.push({ text: "T-SPIN SINGLE", color: "#a000f0" });
    }
    if (isPC) {
      popupInfo.push({ text: "PERFECT CLEAR!", color: "#ffffff" });
    }
    if (scoreResult.isB2B && wasB2BActive) {
      popupInfo.push({ text: "BACK-TO-BACK", color: "#f0a000" });
    } else if (scoreResult.isB2BBroken) {
      popupInfo.push({ text: "BREAK", color: "#f0a000" });
    }
    if (combo >= 2) {
      popupInfo.push({ text: `${combo}× COMBO`, color: "#00f0f0" });
    }
    if (needsLevelupSFX) {
      popupInfo.push({ text: `LEVEL ${s.level}!`, color: "#ffff00" });
    }

    // Check mode victory after all scoring
    if (checkModeVictory(s)) {
      victoryTriggered = true;
    }

    s.phase = GamePhase.LineClear;
    s.lineClearTimer = 0;
  } else {
    // No lines cleared
    s.clearedRowIndices = [];
    const comboResult = updateCombo(s, 0);
    s = comboResult.state;

    if (tSpinResult.isTSpin) {
      const wasB2BActive = s.backToBack;
      scoreResult = evaluateClear(0, tSpinResult, s.level, s.backToBack, false);
      s.score += scoreResult.score;
      s.backToBack = scoreResult.isB2B;

      if (s.mode === GameMode.Marathon) {
        const eff = effectiveLinesFor(0, tSpinResult, scoreResult.isB2B && wasB2BActive);
        s.effectiveLines += eff;
        const newLevel = calculateLevelFromEffective(s.effectiveLines);
        if (newLevel > s.level) {
          s.level = Math.min(newLevel, MARATHON_MAX_LEVEL);
          needsLevelupSFX = true;
        }
      }
      needsTSpinSFX = true;

      // Popup for T-Spin with 0-line clear (scoring applies but no visual feedback otherwise)
      popupInfo.push({
        text: tSpinResult.isMini ? "T-SPIN MINI" : "T-SPIN",
        color: "#a000f0",
      });

      if (needsLevelupSFX) {
        popupInfo.push({ text: `LEVEL ${s.level}!`, color: "#ffff00" });
      }
      if (scoreResult.isB2BBroken) {
        popupInfo.push({ text: "BREAK", color: "#f0a000" });
      }
    }

    // Check victory even on no-clear (T-spin no-clear can raise level in Marathon)
    if (checkModeVictory(s)) {
      victoryTriggered = true;
    }

    s.phase = GamePhase.EntryDelay;
    s.entryDelayTimer = 0;
  }

  s.lastLockResult = {
    linesCleared,
    isPerfectClear: isPC,
    isTSpin: tSpinResult.isTSpin,
    isTSpinMini: tSpinResult.isMini,
    needsLevelupSFX,
    needsTSpinSFX,
    needsFinesseSFX: hasFault,
    victoryTriggered,
  };

  return {
    state: s,
    linesCleared,
    isPerfectClear: isPC,
    tSpinResult,
    scoreResult,
    comboBonus,
    victoryTriggered,
    popupInfo,
    needsLevelupSFX,
    needsTSpinSFX,
    needsFinesseSFX: hasFault,
  };
}
