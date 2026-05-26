# tetryst — Project Specification

## Game Overview
Browser-based Tetris clone. TypeScript, single-file HTML build, no runtime dependencies. Deployed via GitHub Pages.

## Game Modes
- **Marathon** — Reach level 15. Variable goal system (effective lines). Gravity accelerates per level.
- **Sprint** — Clear 40 lines as fast as possible. Fixed slow gravity.
- **Ultra** — Score as many points as possible in 3 minutes.

## Core Mechanics
- **Rotation**: SRS (Super Rotation System) with separate kick tables for JLSTZ and I pieces. O-piece is identity-only. 180° rotation not implemented (deferred).
- **Bag**: 7-bag randomizer. First bag restricted to I/J/L/T.
- **Lock delay**: 500ms, max 15 resets. Resets on horizontal move and rotation. Entry delay 200ms.
- **Input**: DAS (300ms) / ARR (50ms) for movement and soft drop. Non-DAS keys fire once per press.
- **Scoring**: Per TDG §7. Line clear scores, T-spin scores (3-corner rule), B2B (1.5×), combo, perfect clear. B2B eligible: Tetris, T-spin (any). Perfect clear NOT B2B-eligible (2009 TDG rule).
- **Leveling**: Variable effective line system. Marathon requires cumulative effective lines per level.

## Controls (default)
Defaults per README. All keys are configurable via the key-bindings overlay (Phase 24).

| Action | Default Key |
|--------|-------------|
| Move Left | `←` |
| Move Right | `→` |
| Soft Drop | `↓` |
| Hard Drop | `Space` |
| Rotate CW | `↑` / `Z` |
| Rotate CCW | `X` |
| Hold | `C` / `Shift` |
| Pause | `P` / `Esc` |
| Start | `Enter` |
| Mute | `M` |

## Input Architecture
- `KeyboardHandler` class with DAS/ARR processing
- Keys categorized as DAS actions (movement, soft drop) and non-DAS (all others)
- DAS actions auto-repeat with configurable DAS delay and ARR rate
- Non-DAS actions fire exactly once per keydown
- Bindings are injectable via constructor (not hardcoded maps)

## Persistence Model
| Data | Key | Format |
|------|-----|--------|
| High scores | `tetryst_scores_{mode}` | JSON array of `{score, level, lines, mode}` |
| Key bindings | `tetryst_keybindings` | JSON record of `KeyboardEvent.code` → `InputAction` |
| Audio state | `tetryst_audio` | `{enabled: boolean}` |

## Rendering
- Canvas-based. Offscreen canvas caching for board, menu overlay.
- Ghost piece, active piece, line-clear animation, particles, screen flash.
- HUD shows score, level, lines, mode-specific data, hold piece, next queue (5), B2B/combo badges.
- Star-field background with parallax drift and twinkle.

## Audio
- Web Audio API. Procedurally generated chiptune music (176-note melody).
- 9 SFX types: move, rotate, lock, hold, clear, tetris, tspin, levelup, gameover.
- Music scheduled in ~73s cycles. Active oscillator/gain tracking for cleanup.

## AI
- Plays itself for attract mode. Evaluates board state with heuristics (column heights, holes, bumpiness).
- Generates placements for each piece, scores them, picks best.
