# tetryst Plans.md

Created: 2026-05-25

> Phases 1–30 (all cc:完了) archived in [Plans-archive.md](Plans-archive.md).

---

## Phase 31: Game loop comprehensive test coverage [tdd:required]

**Overview**: `loop.ts` orchestrates all gameplay but has only 52% branch coverage — the single largest gap in the codebase. A 3-agent parallel audit confirmed TDG compliance is near-perfect; the lurking bugs are hiding in untested phase-transition and edge-case paths. This phase adds tests for every critical untested path in the game loop.

### Group A — Critical untested paths

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 31.1 | **Hard-drop lock-out: no SFX, no flash, activePiece=null** — When a piece hard-drops into a position entirely within the buffer zone (isLockOut=true), the loop must NOT call `playSFX("lock")`, NOT call `triggerFlash`, and must set `state.activePiece=null` with phase=GameOver. The path is at `loop.ts:304-340`. The SFX fix was implemented in 30.4 but the loop-level assertion (no triggerFlash) has no test. Write failing test first: fill board near top so hard-dropped piece locks out; assert `triggerFlash` not called, `playSFX("lock")` not called, phase=GameOver, activePiece=null. | Failing test added first; hard-drop lock-out path fully asserted; `triggerFlash` and `playSFX("lock")` confirmed silent on lock-out; all tests pass | - | cc:完了 |
| 31.2 | **Ultra timer expiry during LineClear and EntryDelay phases** — When `state.modeTimer` reaches 0 while phase=LineClear or phase=EntryDelay, victory must trigger immediately. These sub-phases are checked in the loop but no test exercises them. Write failing tests: (a) Ultra game in LineClear phase, advance modeTimer to 0 → state transitions to Victory; (b) Ultra game in EntryDelay phase, advance modeTimer to 0 → Victory. | Two failing tests added first; Ultra timer checked in both LineClear and EntryDelay; Victory triggered; all tests pass | - | cc:完了 |
| 31.3 | **Gravity-lock path: normal lock via gravity, and lock-out via gravity** — Two gravity paths: (a) piece on ground, dt accumulates to lock-delay threshold → piece locks via `lockActivePiece` (not directly via `executeLock`); (b) piece locks via gravity, next spawn causes block-out → GameOver, no SFX/flash. Write failing tests for both (`loop.ts:499-593`). | Two failing tests added first; gravity→lock chain verified; gravity→lock-out→GameOver verified; all tests pass | - | cc:完了 |

### Group B — Major untested paths

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 31.4 | **Pause menu: wrap-backward, quit-to-menu, resume clears popups** — Three untested pause paths at `loop.ts:241-256, 427-432`: (a) from selection 0, pressing Up wraps to selection 2 (PAUSE_MENU_COUNT-1); (b) selecting Quit resets state to `createInitialState()` and starts attract mode; (c) resuming from pause clears any popups that accumulated while paused. Write three failing tests first. | Three failing tests added first; wrap-backward, quit-to-menu, resume-clears-popups all verified; all tests pass | - | cc:完了 |
| 31.5 | **Key binding screen: Escape exits capture, deduplication removes old binding, Up/Down navigation** — Three key-binding paths at `loop.ts:91-138`: (a) pressing Escape during active key-capture mode exits without saving the binding; (b) pressing a key already bound to another action removes the old binding before assigning the new one; (c) pressing Up/Down while not in capture mode navigates the selector and wraps around. Write three failing tests first. | Three failing tests added first; all three key-binding paths verified; all tests pass | - | cc:完了 |
| 31.6 | **Attract mode lifecycle: AI reset on spawn, game restart on GameOver** — Two attract paths at `loop.ts:626-647`: (a) when the attract game locks a piece, `attractNeedsReset` is consumed and `AIController.reset()` is called exactly once before the next AI decision; (b) when the attract game reaches GameOver, `clearEffects()` is called and the game restarts with fresh state. Write two failing tests first. | Two failing tests added first; AI reset timing verified; attract restart verified; all tests pass | - | cc:完了 |
| 31.7 | **Popup expiry and level-up tempo multiplier** — Two loop update paths at `loop.ts:506-523, 570-572`: (a) popups with expired `duration` are removed from `state.popups` on the next tick after expiry; (b) level-up in Marathon mode calls `setTempoMultiplier(1.0 + newLevel × 0.015)`. Write two failing tests first. | Two failing tests added first; popup expiry and tempo multiplier verified; all tests pass | - | cc:完了 |

## Phase 32: Core logic edge cases [tdd:required]

**Overview**: The coverage audit identified specific untested branches in `state.ts` (75% branches), `actions.ts` (84%), `lock.ts`, and `scoring.ts` (90%). These are edge cases that protect against state corruption and incorrect scoring — exactly where silent bugs hide.

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 32.1 | **state.ts: empty-queue GameOver, hold-swap collision, holdPiece guards** — Three edge cases in `state.ts`: (a) `spawnFromQueue` with empty `nextQueue` AND empty `bag` → immediate GameOver, activePiece=null; (b) swapping a held piece that collides at spawn → GameOver, heldPiece updated, activePiece=null; (c) `holdPiece` called during Menu/Paused/LineClear/EntryDelay phases → state returned unchanged. Write failing tests first for all three. | Three failing tests added first; all edge cases verified; `state.ts` branches 75%→85%+; all tests pass | - | cc:完了 |
| 32.2 | **actions.ts: hard-drop lock-out path, buffered input during non-Playing, soft-drop timer** — Four `actions.ts` paths: (a) `handleHardDrop` with `isLockOut()=true` → phase=GameOver, no score added, `lastLockResult` undefined; (b) `RotateCW`/`RotateCCW` during EntryDelay/LineClear sets `bufferedRotation`, no immediate rotation; (c) `Hold` during EntryDelay with `hasSwappedThisTurn=false` sets `bufferedHold=true`, piece not held yet; (d) soft drop resets `gravityTimer` to 0. Write failing tests first. | Four failing tests added first; all paths verified; `actions.ts` branches 84%→92%+; all tests pass | - | cc:完了 |
| 32.3 | **actions.ts: wall kick clears onGround, MAX_LOCK_RESETS boundary, pausedFromPhase** — Four more `actions.ts` paths: (a) a successful wall kick that lifts the piece off the ground sets `onGround=false`; (b) horizontal move at `resets=MAX_LOCK_RESETS` where piece leaves ground does NOT reset the lock timer; (c) `handlePause` during LineClear saves `pausedFromPhase=LineClear`; (d) resume with `pausedFromPhase=undefined` falls back to `Playing`. Write failing tests first. | Four failing tests added first; all paths verified; all tests pass | - | cc:完了 |
| 32.4 | **lock.ts: T-spin with 0 lines cleared** — A T-piece locked into a valid T-spin geometry that does NOT clear any lines should: award T-spin-zero points (400×(level+1)), add "T-SPIN" popup to `state.popups`, and transition to `EntryDelay` (not `LineClear`). The `executeLock` path for T-spin-no-clear at `lock.ts:127-156` is currently untested. Write failing test first: board geometry where T-piece fits T-spin shape without clearing; assert score increased by 400×(level+1), popup contains "T-SPIN", phase=EntryDelay. | Failing test added first; T-spin zero-line scoring verified; popup "T-SPIN" present; phase=EntryDelay; all tests pass | - | cc:完了 |
| 32.5 | **lock.ts: Victory on T-spin no-clear in Marathon** — If a T-spin no-clear produces enough `effectiveLines` to reach `MARATHON_MAX_LEVEL`, `victoryTriggered` must be true in the returned result. This is the `lock.ts:159-161` path. Write failing test first: set Marathon level to one T-spin-zero away from victory threshold, lock T-spin no-clear, verify `victoryTriggered=true`. | Failing test added first; victoryTriggered=true on T-spin threshold verified; all tests pass | 32.4 | cc:完了 |
| 32.6 | **scoring.ts: T-spin mini paths, perfect-clear B2B fixed score, level boundary conditions** — Three `scoring.ts` edge cases: (a) `evaluateClear` with `isMini=true` and `linesCleared=0`/`1` applies `TSPIN_MINI_SCORES` correctly; (b) perfect clear with 4 lines + active B2B uses `PERFECT_CLEAR_B2B_TETRIS` constant, not `2000×1.5`; (c) `calculateLevelFromEffective(0)=0`, at exact threshold value, and between thresholds. Write failing tests first. | Three failing tests added first; mini scoring, PC B2B fixed score, level boundaries all verified; `scoring.ts` branches 90%→96%+; all tests pass | - | cc:完了 |

## Phase 33: Audio and render coverage [tdd:required]

**Overview**: `sfx.ts` has only 60% statement coverage with no tests for its synthesis logic. `canvas.ts` has 74% branch coverage with untested cache invalidation and mode-specific rendering paths. These gaps mean regressions in audio synthesis or rendering modes would not be caught.

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 33.1 | **sfx.ts: comprehensive synthesis tests** — `sfx.ts` lines 7-64 are almost entirely untested. Add tests for: (a) `playSFX` returns early without error when `getAudioContext()` returns null; (b) noise event: creates AudioBuffer with random data, `exponentialRampToValueAtTime` on gain, highpass filter connected; (c) oscillator event: `createPulseOsc` called for pulse25/pulse50, `linearRampToValueAtTime` applied only when `endFreq` defined; (d) `osc.onended` cleanup calls `gain.disconnect()`. Write failing tests first using Web Audio API mocks already in test-utils. | Four failing tests added first; all synthesis paths verified; `sfx.ts` statements 60%→90%+; all tests pass | - | cc:完了 |
| 33.2 | **canvas.ts: cache system — board cache invalidation, menu cache miss, OffscreenCanvas fallback** — Four cache paths: (a) locking a piece changes board reference → `boardCacheCanvas` is redrawn; (b) changing `selectedMode`, `audioEnabled`, or score changes the cache key → menu cache cleared and re-rendered; (c) `OffscreenCanvas` unavailable → falls back to `document.createElement`; (d) DPR or canvas dimensions change → `_menuCacheCanvas` recreated at new physical dimensions. Write failing tests first. | Four failing tests added first; all cache paths verified; `canvas.ts` branches improve from 74%; all tests pass | - | cc:完了 |
| 33.3 | **canvas.ts: mode-specific HUD and Victory screen rendering** — Four mode rendering paths at `canvas.ts:649-799`: (a) Sprint HUD shows time elapsed + lines remaining; (b) Ultra HUD shows countdown timer + score; (c) Marathon HUD shows score + level + lines; (d) Victory screen shows mode-correct headline and labels for Sprint, Ultra, and Marathon. Write failing tests with mock 2D context. | Four failing tests added first; all three modes verified in HUD and Victory; all tests pass | 33.2 | cc:完了 |

## Phase 34: Property-based tests for game invariants [tdd:skip:fuzz]

**Overview**: Fuzz/property tests prove that core invariants hold under arbitrary valid input sequences — catching bugs that targeted tests miss. These run under `npm run test:fuzz`.

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 34.1 | **Board invariants under random valid action sequences** — Property: after any sequence of `processAction` calls on a valid board, board dimensions remain BOARD_WIDTH×BOARD_HEIGHT, all non-empty cells hold valid TetriminoTypes, and no float/NaN values appear in numeric state. Add `src/core/board-invariants.fuzz.test.ts`, run 1000+ random action sequences per iteration. | Fuzz test runs 1000+ iterations without invariant violation; `npm run test:fuzz` passes | - | cc:完了 |
| 34.2 | **Scoring monotonicity and combo distribution** — Properties: (a) `state.score` never decreases and is never NaN/negative; (b) combo counter resets to 0 on a 0-clear and only increments on ≥1-clear; (c) `effectiveLinesFor` always returns a non-negative, non-NaN number. Add `src/core/scoring-invariants.fuzz.test.ts`. | Fuzz test passes 1000+ lock sequences without invariant violation; `npm run test:fuzz` passes | - | cc:完了 |
| 34.3 | **Phase FSM and activePiece invariants** — Properties: (a) phase transitions follow valid arcs (e.g., GameOver can only be exited by explicit `startGame`, not by input); (b) `activePiece === null` iff phase ∈ {Menu, GameOver, Victory}. Add `src/core/state-fsm.fuzz.test.ts`. | Fuzz test passes 1000+ random inputs without FSM violation; `npm run test:fuzz` passes | - | cc:完了 |

## Phase 35: Coverage gate + build verification [tdd:skip:build-check]

**Overview**: After all coverage work, enforce quantitative targets and verify no performance regressions.

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 35.1 | **Enforce branch coverage targets on all core files** — Run `npm run test:coverage` and verify: `loop.ts` branches ≥75%, `state.ts` branches ≥90%, `actions.ts` branches ≥92%, `scoring.ts` branches ≥95%, `sfx.ts` statements ≥90%, `canvas.ts` branches ≥85%. For any file still below target, identify the remaining uncovered branch and add the missing test. | `npm run test:coverage` output shows all targets met; no failing tests | 31.1–34.3 | cc:完了 |
| 35.2 | **Build and performance verification** — Confirm `npm test` (excluding fuzz) runs in <5s, `npm run build` succeeds, `dist/index.html` gzip ≤70kB. Verify no new hot-path allocations were introduced by test utilities leaking into production build. | Test suite <5s; build passes; gzip ≤70kB | 35.1 | cc:完了 |

## Phase 36: Close remaining correctness gaps [tdd:required]

**Overview**: Five specific gaps remain where the tests either provide a weaker-than-necessary guarantee, a silent behavioral bug could go undetected, or dead code reduces coverage confidence. Each is a targeted fix with a clear DoD.

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 36.1 | **7-bag strict exhaustion property** — `randomizer.test.ts` "distribution uniformity" uses ±50 tolerance over 1000 draws, which a fair-random (non-bag) distribution would also pass. Add a strict test: draw exactly 7×N pieces (N=100, total 700) and assert each of the 7 types appears *exactly* N times. This is the only test that proves the 7-bag guarantee, not just approximate uniformity. | New test added; draws 7×100=700 pieces; each type count === 100; test would fail if pieces.ts switched to `Math.random()` uniform draw | - | cc:完了 |
| 36.2 | **Ghost piece minimum-Y invariant** — `pieces.test.ts` proves `ghostY >= piece.pos.y` but not that ghost is at the *lowest* valid Y. A bug where ghost stops one row too early would not be caught. Add a property test: for every piece type × rotation on a random board, verify that `ghostY + 1` always results in a collision (piece at ghostY+1 overlaps the board or floor), proving ghost is truly at the final position. | New property test; for all 7 types × 4 rotations on empty board and board with obstacles, `ghostY+1` always collides; test fails if `getGhostY` returns early | - | cc:完了 |
| 36.3 | **Sprint and Marathon save correct high-score field** — `saveHighScoreMock` exists in `loop.test.ts` but is never asserted. The Sprint path at `loop.ts:450` uses `this.state.modeTimer` (elapsed time) instead of `this.state.score`. If that condition were reversed, no test would fail. Add two assertions: (a) Sprint GameOver/Victory calls `saveHighScore` with `score === state.modeTimer`; (b) Marathon GameOver calls `saveHighScore` with `score === state.score`. | Two new assertions in loop.test.ts; `saveHighScoreMock` verified for Sprint mode (modeTimer) and Marathon mode (score); test fails if Sprint/Marathon fields are swapped | - | cc:完了 |
| 36.4 | **Sprint end-to-end integration: 40 lines → Victory via game loop** — Sprint victory via `checkModeVictory` is unit-tested but the full chain `executeLock → checkModeVictory → victoryTriggered → triggerVictory() → onPhaseTransition(Victory) → stopMusic()` has no integration test. Set up a Sprint game with a board where one more line clear completes 40 lines, hard-drop to trigger it, and verify the game transitions to Victory. | New test in loop.test.ts; Sprint game reaches 40 lines via hard-drop; `g.state.phase === GamePhase.Victory`; `saveHighScoreMock` called with `modeTimer`; `stopMusic` called | 36.3 | cc:完了 |
| 36.5 | **`mode-rules.ts` dead default branch** — `checkModeVictory` has `default: return false` (line 13) which is unreachable because `GameMode` is an exhaustive enum. This leaves mode-rules.ts at 75% branch coverage. Add `/* c8 ignore next */` annotation, matching the pattern established for scoring.ts dead code. No behavior change. | `mode-rules.ts` branch coverage reaches 100%; annotation matches scoring.ts convention; all tests pass | - | cc:完了 |

## Archive

Phases 1–30 archived in [Plans-archive.md](Plans-archive.md). All tasks: cc:完了.
