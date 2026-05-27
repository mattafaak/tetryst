# tetryst Plans.md

Created: 2026-05-25

> Phases 1–25 (all cc:完了) archived in [Plans-archive.md](Plans-archive.md).

---

## Phase 26: Deep audit — bugs, test infrastructure, hot-path perf [tdd:required]

**Overview**: Findings from a 3-agent parallel audit (code correctness, test quality, performance). Three confirmed bugs (audio state clobber, activePiece non-null on GameOver, auto-pause failing during sub-phases), two broken tests that silently pass through real regressions (T-Spin Mini assertion never fires, popup tautology), and the highest-impact remaining hot-path allocations. Includes test infrastructure consolidation: 8 duplicate state factories, redundant test files, and missing coverage tooling.

### Required — bugs

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 26.1 | **Fix `startAttractMode`/`exitAttractMode` audio state clobber** — `startAttractMode` (loop.ts:631) hard-sets `this.audioEnabled = false` and `exitAttractMode` (loop.ts:640) hard-sets `this.audioEnabled = true`, overriding any mute the player set before entering attract mode. When a user mutes audio on the menu then presses Enter, mute is silently cleared. When a user quits a live game to menu (which calls `startAttractMode`), then starts a new game, music does not restart because `onPhaseTransition(Playing)` sees `audioEnabled = false`. Fix: save `this.audioEnabled` into a `private _preAttractAudio: boolean` before setting false in `startAttractMode`; restore it in `exitAttractMode` instead of hard-setting true. | User mute preference survives attract mode entry/exit; music restarts correctly after Quit to Menu; all tests pass | - | cc:完了 |
| 26.2 | **Fix `spawnFromQueue` and `holdPiece` returning non-null `activePiece` on GameOver** — `spawnFromQueue` block-out GameOver return (state.ts:155-165) spreads `state` which preserves `activePiece: piece` (the colliding piece). `holdPiece` swap GameOver return (state.ts:111) spreads `baseState` which inherited `activePiece` from the original state. Both leave `activePiece` non-null during GameOver, causing ghost rendering on the game-over screen and technically inconsistent state for AI in attract mode. Fix: add `activePiece: null` to both GameOver return objects. | `GameState.activePiece === null` in all GameOver transitions; no ghost on game-over screen; all tests pass | - | cc:完了 |
| 26.3 | **Fix auto-pause silently failing during LineClear and EntryDelay phases** — `onVisibilityChange` calls `handleInput({ type: "Pause" })` but `handlePause` (actions.ts:46-54) only transitions from `Playing → Paused`. During `LineClear` or `EntryDelay`, the pause is silently ignored — the game loop keeps ticking including the Ultra mode timer. Fix: expand `handlePause` to accept `LineClear` and `EntryDelay` as pauseable phases (transition to `Paused`). On resume, restore to `Playing` (slight LineClear animation restart is acceptable; the important invariant is that the Ultra timer stops). | Tab-switch pauses game during `LineClear` and `EntryDelay`; Ultra timer does not tick while tab-hidden; resume restores `Playing` phase; all tests pass | - | cc:完了 |

### Required — test fixes (broken tests that silently pass through real regressions)

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 26.4 | **Fix inconclusive T-Spin Mini popup test** — `lock.test.ts` line 198 wraps its assertion in `if (result.tSpinResult.isTSpin && result.tSpinResult.isMini)`, meaning it never fires if the geometry doesn't produce a Mini result. A regression removing T-Spin Mini popup logic would not be caught. Fix: construct a board geometry that reliably produces `isMini === true` (requires the piece to be in a corner with exactly 2 back-diagonal cells occupied and fewer than 2 front-diagonal cells), assert `isMini === true` unconditionally, and assert `state.popups` contains text `"T-SPIN MINI"`. | T-Spin Mini assertion fires unconditionally; `isMini === true` verified; popup text verified; all tests pass | - | cc:完了 |
| 26.5 | **Fix `integration.test.ts` popup tautology and theatrical tests** — Line 120 has `if (4 === 4) { state = pushPopup(state, "TETRIS!") }` — a hard-coded tautology that makes the test pass regardless of `executeLock` behavior. The entire popup test block manually constructs popups via `pushPopup` rather than driving `executeLock`, so removing popup emission from `lock.ts` would not break any test. Fix: rewrite popup integration tests to build a 4-line-clear board, call `executeLock`, and assert `state.popups` contains the expected entry (text + color). Remove the `4 === 4` literal and all manual `pushPopup` calls that bypass the real code path. | Popup tests exercise `executeLock`; removing "TETRIS!" popup emission from lock.ts causes test failure; no `if (4 === 4)` in codebase; all tests pass | - | cc:完了 |

### Required — new coverage for untested dispatch paths

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 26.6 | **Add `processAction` dispatch tests for Hold, Pause, Mute, KeyBindings** — These four action types reach `processAction` but are completely untested in `actions.test.ts`. The dispatch path is separate from the direct `holdPiece`/`handlePause` unit tests. Add: (a) `Hold` dispatches to `holdPiece` and updates `heldPiece`, (b) `Pause` during Playing returns Paused phase, (c) `Mute` is a no-op in `processAction` (returns state unchanged), (d) `KeyBindings` is a no-op in `processAction`. | 4 new tests covering Hold/Pause/Mute/KeyBindings dispatch; all pass | - | cc:完了 |

### Recommended — test infrastructure (structural cleanup)

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 26.7 | **Consolidate 8 local state factories into shared test-utils** — `lock.test.ts`, `actions.test.ts`, `lock-delay.test.ts`, `combo.test.ts`, `entry-delay.test.ts`, `gravity.test.ts`, `mode-rules.test.ts`, and `state.test.ts` each define their own local factory (`baseState`, `makeState`, `createTestState`). These diverge slightly and duplicate `createInitialState` logic. Add `playingState(overrides?: Partial<GameState>): GameState` to `test-utils.ts` returning a `GamePhase.Playing` state with a T-piece active, plus `makePiece(type?, x?, y?, rot?)` and a canonical `fillRows(n, board?)` helper. Migrate all 8 files to import from test-utils. | `playingState`, `makePiece`, `fillRows` in test-utils; 8 local factories removed; all tests pass | - | cc:完了 |
| 26.8 | **Delete `mode-rules.test.ts` and merge `music.test.ts` into `audio.test.ts`** — `mode-rules.test.ts` (11 tests) is a strict subset of `tdg-compliance.test.ts` "TDG §15" — every assertion is duplicated. `music.test.ts` (13 tests) duplicates the "music behavioral" section of `audio.test.ts`. Delete `mode-rules.test.ts`. Move any non-duplicate `music.test.ts` tests into `audio.test.ts` then delete `music.test.ts`. | Both files removed; no coverage lost; `npm test` passes; test count reduced by ~24 tests | - | cc:完了 |
| 26.9 | **Separate fuzz tests from fast unit test run** — `vitest.config.ts` `include: ["src/**/*.test.ts"]` matches `*.fuzz.test.ts`, adding 15–30 seconds to every `npm test` run (fuzz tests run 1000+ iterations). Add a vitest workspace project or `exclude` pattern so `npm test` skips `*.fuzz.test.ts`, and add `npm run test:fuzz` script for the property-based suite. | `npm test` excludes fuzz tests and runs noticeably faster; `npm run test:fuzz` runs property-based tests; all fuzz tests still pass; `package.json` updated | - | cc:完了 |
| 26.10 | **Add v8 coverage configuration to vitest** — No coverage provider is configured; `npm test` gives no branch/line report. Add `coverage: { provider: "v8", include: ["src/**/*.ts"], exclude: ["src/**/*.test.ts", "src/**/*.fuzz.test.ts", "src/test-utils/**"] }` to `vite.config.ts`. Add `npm run test:coverage` script. | `npm run test:coverage` produces coverage report; existing test behavior unchanged | 26.9 | cc:完了 |

### Recommended — performance (hot path)

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 26.11 | **Eliminate unconditional per-frame allocations in `applyGravity`** — `applyGravity` (gravity.ts:67-75) always creates 3 new objects (pos spread, piece spread, lockState spread + state spread) every frame even when the gravity timer hasn't accumulated enough to drop the piece and ground-contact hasn't changed. Add early-return path: when `!dropped` and `onGround === state.lockState.onGround`, return a minimal spread touching only `gravityTimer` (1 allocation), avoiding activePiece and lockState object creation. | `applyGravity` skips activePiece/lockState allocation on frames with no state change; gameplay and physics unchanged; all tests pass | - | cc:完了 |
| 26.12 | **Eliminate per-frame nested spreads in `shouldLock`** — `shouldLock` (lock-delay.ts:22-25) creates `{ ...state, lockState: { ...state.lockState, timer: t + dt } }` on every frame the piece is on the ground — 2 nested spreads × 60fps during the common lock-delay window (~500ms). Guard: when `!onGround` the function already returns early; add a second early-return when the piece is not yet near the lock boundary (`timer + dt < LOCK_DELAY`) and no locking condition is met, deferring the state spread until the boundary is actually crossed. | `shouldLock` allocates 0 objects on frames far from lock boundary; lock timing unchanged; all tests pass | - | cc:完了 |
| 26.13 | **Cache `loadHighScores(...).slice(0, 5)` in GameOver/Victory render** — `drawGameOver` and `drawVictory` call `loadHighScores(mode).slice(0, 5)` every frame during their screens (~60fps). `loadHighScores` has module-level `scoresCache` so localStorage isn't re-read, but `.slice(0, 5)` allocates a new 5-element array on every frame. Fix: cache the sliced result in `high-scores.ts` keyed on `mode + generation`; invalidate on `saveHighScore` by incrementing the generation counter. | `slice(0, 5)` allocates at most once per game-end event; `drawGameOver`/`drawVictory` frames return cached array reference; all tests pass | - | cc:完了 |

### Optional — minor polish

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 26.14 | **Hoist per-cell context state writes out of inner loops in `drawGhost` and `drawSmallPiece`** — `drawGhost` (canvas.ts:353-361) sets `fillStyle`, `globalAlpha` (×3), and `strokeStyle` on every cell — 5 constant-value writes per cell for a 4-cell piece (20 redundant writes per frame). `drawSmallPiece` (canvas.ts:841-847) sets `fillStyle` inside its inner loop with a constant color. Move all per-draw-call constants above the loops. | Context state set once per `drawGhost`/`drawSmallPiece` call; no visual change; all tests pass | - | cc:完了 |
| 26.15 | **Cache `formatMs` result to avoid per-frame string allocations** — `formatMs` (canvas.ts:726-731) creates 3 new strings per frame during Sprint/Ultra play (2× `toString()`, 2× `padStart()`, 1× template literal). Add a 1-entry cache: store last input ms truncated to centisecond granularity; return cached string when input is unchanged. | `formatMs` allocates strings only when the displayed time changes; Sprint/Ultra HUD unchanged; all tests pass | - | cc:完了 |
| 26.16 | **Name the `0.92` sustain-gap literal in music.ts** — `const gap = 0.92` (music.ts:358) is an undocumented magic number controlling note sustain duration. Extract to a module-level named constant `SUSTAIN_FRACTION` alongside other audio constants. | `SUSTAIN_FRACTION` constant defined; no behavior change; build passes | - | cc:完了 |

## Archive

Phases 1–25 archived in [Plans-archive.md](Plans-archive.md). All tasks: cc:完了.
