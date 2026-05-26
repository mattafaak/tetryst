# Tetryst — A Tetris Clone

**[▶ Play Now — mattafaak.github.io/tetryst](https://mattafaak.github.io/tetryst/)**

A browser-based Tetris implementation in TypeScript, compliant with the **2009 Tetris Design Guideline**. Single-file build — download once, play offline forever.

```bash
# Download and play offline (macOS / Linux)
curl -fsSL https://mattafaak.github.io/tetryst/ -o tetryst.html
open tetryst.html          # macOS
xdg-open tetryst.html      # Linux
```

---

## Game Modes

| Mode | Goal | Timer | Leveling |
|------|------|-------|----------|
| **Marathon** | Reach Level 15 | No timer | Gravity accelerates level by level (1s → 5ms per row) |
| **Sprint** | Clear 40 lines fastest | Counts up | Fixed at selected start level |
| **Ultra** | Max points in 3 minutes | 3:00 countdown | Fixed at selected start level |

---

## Controls

| Key | Action |
|-----|--------|
| `←` `→` | Move |
| `↓` | Soft drop |
| `Space` | Hard drop |
| `↑` `Z` | Rotate CW |
| `X` | Rotate CCW |
| `C` `Shift` | Hold |
| `P` `Esc` | Pause |
| `M` | Mute |

### Menu

| Key | Action |
|-----|--------|
| `←` `→` | Change mode |
| `↑` `Z` | Raise start level (Marathon) |
| `↓` `Space` | Lower start level (Marathon) |
| `H` | High scores |
| `Enter` | Start |

### Pause

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate |
| `Enter` | Select |
| `P` `Esc` | Resume |

---

## Scoring

| Action | Points |
|--------|--------|
| Single | 100 × level |
| Double | 300 × level |
| Triple | 500 × level |
| Tetris | 800 × level |
| T-Spin (no lines) | 400 × level |
| T-Spin Single | 800 × level |
| T-Spin Double | 1,200 × level |
| T-Spin Triple | 1,600 × level |
| T-Spin Mini (no lines) | 100 × level |
| T-Spin Mini Single | 200 × level |
| Back-to-Back | ×1.5 multiplier |
| Perfect Clear | 800–3,200 × level |
| Combo | 50 × combo × (level + 1) |
| Soft drop | 1/cell |
| Hard drop | 2/cell |

---

## Features

**TDG 2009 Compliance** — 91 tests verify §2–§15: SRS wall kicks, 7-bag randomizer (first-piece guarantee), ghost piece, lock delay with 15 move resets, T-Spin detection via 3-corner rule, Variable Goal leveling, DAS 167ms/ARR 33ms, 5-piece next queue.

**NES-Style Chiptune** — Real-time Web Audio synthesis of Korobeiniki (three voices: triangle lead, bass, noise hi-hat). 9 distinct SFX (move, rotate, lock, line clear, Tetris, T-Spin, hold, level-up, game over). No audio files.

**AI Attract Mode** — When idle on the menu, an AI plays indefinitely. Evaluates every possible placement per piece by aggregate height, holes, bumpiness, and line clears. Press any key to take control.

**Single-File Build** — Everything inlined into one HTML file via `vite-plugin-singlefile`. No server, no internet, no dependencies after download.

**Visual Polish** — Animated star field background, colored line-clear particle bursts, screen flash on Tetris/T-Spin/Perfect Clear, offscreen canvas caching for the static board, popup action feed (TETRIS!, T-SPIN!, B2B, PERFECT CLEAR, LEVEL UP).

**High Scores** — Top 10 per mode saved to localStorage. Browse Marathon/Sprint/Ultra leaderboards with arrow keys (press H from menu). Sprint ranked by time; Marathon/Ultra by score.

**Pause Menu** — Resume, Restart, or Quit to Menu. Auto-pauses on tab blur.

**Responsive** — Canvas adapts to any window size. Playable portrait or landscape.

---

## Testing

670+ unit tests — 91 TDG compliance tests, property-based fuzz (collision, SRS, scoring, AI brain), full game-loop integration, DAS/ARR timing, and 15 Playwright E2E screenshot tests.

```bash
npm test            # All tests
npm run test:watch  # Watch mode
npm run test:e2e    # Playwright E2E
```

---

## Development

```bash
npm install            # Install dependencies
npm run dev            # Dev server at localhost:5173
npm run build          # TypeScript check + build → dist/index.html
npm run preview        # Preview production build
```

| Tech | Purpose |
|------|---------|
| TypeScript ~6.0 | Strict mode throughout |
| Vite ~8.0 | Dev server, HMR, build |
| Vitest ~4.1 | Unit + integration tests |
| Playwright ~1.60 | E2E screenshot tests |
| vite-plugin-singlefile | Single HTML output |
| Web Audio API | Synthesized chiptune + SFX |

### Structure

```
src/
├── core/        Game logic: board, SRS, gravity, scoring, lock delay
├── render/      Canvas: board, HUD, menus, popups, effects, star field
├── input/       Keyboard handler with DAS/ARR autorepeat
├── audio/       Web Audio synthesizer and SFX engine
├── ai/          Placement evaluator and AI controller
└── game/        Game loop: state machine, phase management
```

---

## TDG Compliance

| § | Requirement | Status |
|---|-------------|--------|
| §2 | 10×20 visible playfield + buffer zone | ✓ |
| §3 | SRS wall kicks (separate JLSTZ / I tables) | ✓ |
| §5 | 7-bag randomizer, first-piece guarantee | ✓ |
| §6 | Ghost piece (30% opacity) | ✓ |
| §7 | Scoring: T-Spins, B2B, Perfect Clear, combos | ✓ |
| §8 | 5 next queue, 500ms lock delay, 15 resets, 200ms entry delay | ✓ |
| §9 | 3-corner T-Spin detection (full vs. Mini) | ✓ |
| §11 | Variable Goal leveling (effective lines) | ✓ |
| §12 | Gravity curve (1,000ms → 5ms) | ✓ |
| §13 | DAS 167ms / ARR 33ms | ✓ |
| §15 | Mode-specific level behavior | ✓ |

---

## Glossary

New to Tetris? See **[docs/glossary.md](docs/glossary.md)** for a plain-English guide to every term used here — from tetriminos and the 7-bag system to T-Spins and competitive slang.
