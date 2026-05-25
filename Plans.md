# tetryst Plans.md

Created: 2026-05-25

---

## Phase 1: Core gameplay bugs

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 1.1 | **Fix Sprint elapsed time tracking** — `modeTimer` stays at 0 in Sprint mode because only Ultra counts down. Add `modeTimer += dt` in `updatePlaying` for Sprint, and verify the Victory screen / high scores display the correct completion time. | Sprint completion time > 0 on victory; high scores save and display correct time; existing test suite passes | - | cc:完了 |
| 1.2 | **Fix B2B popup on first eligible clear** — `buildPopups` receives `scoreResult.isB2B` which is already true after the first Tetris. Pass `scoreResult.isB2B && wasB2BActive` instead so "BACK-TO-BACK" only shows on consecutive eligible clears. | No "BACK-TO-BACK" popup on the first Tetris; popup still shows on second consecutive Tetris; existing tests pass | - | cc:完了 |

## Phase 2: Code cleanup

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 2.1 | **Deduplicate `checkCollision` in gravity.ts** — Delete the local `checkCollision` function and import it from `board.ts` instead. | gravity.ts uses the shared `checkCollision` from board.ts; all tests pass | - | cc:完了 |
| 2.2 | **Deduplicate `checkPerfectClear`** — There are two identical board-scanning implementations (actions.ts and loop.ts). Extract to a shared location (e.g., board.ts) and have both callers use it. | Single `checkPerfectClear` in board.ts; actions.ts and loop.ts both import it; tests pass | - | cc:完了 |
| 2.3 | **Remove dead code** — Clean up unused exports: `addSoftDropScore` (scoring.ts), `onPieceLanded`/`resetLockTimer` (lock-delay.ts), `transitionPhase`/`recalculateGhostY` (state.ts), `initAudio` (sfx.ts & music.ts), `toggleMusic`/`isMusicPlaying` (music.ts), `createCPUAIController` (ai-controller.ts). | No build warnings about unused exports; all tests pass | - | cc:完了 |

## Backlog

(none)

## Archive

(none)
