# Tetryst

**[▶ Play Now — mattafaak.github.io/tetryst](https://mattafaak.github.io/tetryst/)**

A Tetris clone built in TypeScript, fully compliant with the **2009 Tetris Design Guideline (TDG)**. Features synthesized NES-style chiptune audio, an AI-powered attract mode, and a single-file build for offline play.

## Quickstart

**In the browser:** [mattafaak.github.io/tetryst](https://mattafaak.github.io/tetryst/)

**Download and play offline** (macOS / Linux):
```bash
curl -fsSL https://mattafaak.github.io/tetryst/ -o tetryst.html && \
  (open tetryst.html 2>/dev/null || xdg-open tetryst.html 2>/dev/null || \
   echo "Open tetryst.html in your browser")
```
The downloaded file is fully self-contained — no internet connection required after download.

## Game Modes

| Mode | Goal | Duration | Level |
|------|------|----------|-------|
| **Marathon** | Clear lines to reach Level 15 | Until game over | Advances via Variable Goal (TDG §11) |
| **Sprint** | Clear 40 lines as fast as possible | Timed — fastest time wins | Fixed at your starting level |
| **Ultra** | Score as many points as you can in 3 minutes | 3:00 countdown | Fixed at your starting level |

## Unique Features

### TDG 2009 Compliance
Tetryst is engineered against the official Tetris Design Guideline, verified by **91 dedicated compliance tests** spanning sections §2–§15:

- **§2** — 10×20 visible playfield with 20-row buffer zone
- **§3** — Super Rotation System (SRS) with separate wall kick tables for JLSTZ and I pieces
- **§5** — 7-bag randomizer with first-piece guarantee (never O/S/Z first)
- **§6** — Ghost piece showing landing position at 30% opacity
- **§7** — Full scoring table including T-Spins, Mini T-Spins, Back-to-Back, Perfect Clear, and combo bonuses
- **§8** — 5-piece next queue, 500ms lock delay, 15 move resets, 200ms entry delay
- **§9** — T-Spin detection with 3-corner rule (full vs. Mini distinction)
- **§11** — Variable Goal level system using effective line credits (Tetris = 8 lines, T-Spin Double = 12, B2B +50%)
- **§12** — TDG gravity speed curve: 1000ms at Level 1 → 5ms at Level 15
- **§13** — DAS/ARR autorepeat (300ms initial delay, 50ms repeat)
- **§15** — Sprint and Ultra: fixed level throughout; Marathon: Variable Goal progression

### NES-Style Chiptune Synthesizer
Music is synthesized in real time using the **Web Audio API** — no audio files, no MIDI, no external assets. Features:

- **Korobeiniki theme** — 176 notes parsed from a verified MIDI source at 144 BPM
- **Three-voice arrangement** — triangle wave lead, triangle wave bass (note-root tracking on downbeats), and noise hi-hat on off-beats
- **ADSR envelopes** — soft attack, natural decay, gentle release for each note
- **AudioContext scheduling** — all timing via `currentTime`, no `setTimeout` drift
- **9 synthesized SFX** — distinct tones for move, rotate, lock, line clear, Tetris, T-Spin, hold, level-up (three ascending tones), and game over (descending sweep)

### AI Attract Mode
When idle on the menu, an AI takes over:
- Evaluates every possible placement for every piece rotation, scoring each by aggregate height, holes, bumpiness, and line clears
- Executes the optimal path via a state-machine controller (rotate → move → drop)
- Automatically restarts after game over, running indefinitely
- Displays top Marathon scores on the attract overlay
- Press any key to return to the static menu and select your mode

### Single-File Build
The production build inlines all JavaScript, CSS, and assets into a single HTML file via `vite-plugin-singlefile`. Download it once and play entirely offline — no server, no internet, no dependencies.

### Popup Action Feed
Floating in-game text announces scoring events as they happen: **TETRIS!**, **T-SPIN!**, **B2B**, **PERFECT CLEAR**, **LEVEL UP**, and combo streaks. Text fades and drifts upward over 300ms.

### Offscreen Canvas Caching
The static board layer (locked cells, grid, border) is rendered to an offscreen canvas and only redrawn when the board data changes — saving CPU for animation, piece movement, and overlay rendering.

### localStorage High Scores
Top 10 scores per mode are persisted in the browser. The **high score screen** (press H from the menu) lets you browse Marathon, Sprint, and Ultra leaderboards with arrow key tabs. Sprint scores are ranked by fastest time; Marathon and Ultra by highest score. Scores are also displayed on Game Over and Victory screens.

### Pause Menu
Press P or Escape to bring up a three-option overlay: **Resume** (or press P again), **Restart** (fresh game, same mode), or **Quit to Menu**. Navigate with arrow keys and select with Enter.

### Responsive Layout
Canvas and cell size recalculate on window resize, adapting the playfield to any browser size. Playable in portrait or landscape.

## Controls

| Key | Action |
|-----|--------|
| `←` / `→` | Move left / right |
| `↓` | Soft drop (1 pt/cell) |
| `Space` | Hard drop (2 pts/cell) |
| `↑` / `Z` | Rotate clockwise |
| `X` | Rotate counter-clockwise |
| `C` / `Shift` | Hold piece |
| `P` / `Esc` | Pause |
| `M` | Toggle mute |

### Menu navigation

| Key | Action |
|-----|--------|
| `←` / `→` | Change mode |
| `↑` / `Z` | Increase start level (Marathon) |
| `↓` / `Space` | Decrease start level (Marathon) |
| `H` | View high scores |
| `Enter` | Start game |

### Pause menu

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate options |
| `Enter` | Select option |
| `P` / `Esc` | Resume |

## Scoring

| Action | Points |
|--------|--------|
| Single | 100 × level |
| Double | 300 × level |
| Triple | 500 × level |
| Tetris | 800 × level |
| T-Spin No Lines | 400 × level |
| T-Spin Single | 800 × level |
| T-Spin Double | 1200 × level |
| T-Spin Triple | 1600 × level |
| T-Spin Mini No Lines | 100 × level |
| T-Spin Mini Single | 200 × level |
| Back-to-Back bonus | ×1.5 on consecutive Tetrises / T-Spins |
| Perfect Clear | 800–2000 × level (varies by line count) |
| B2B Tetris Perfect Clear | 3200 × level |
| Combo bonus | 50 × combo count × (level + 1) |
| Soft drop | 1 pt per cell |
| Hard drop | 2 pts per cell |

## Testing

Tetryst has **670+ tests** across **25 files**, making it one of the most thoroughly tested browser Tetris implementations available:

- **91 TDG compliance tests** — Each section (§2–§15) individually verified
- **Property-based fuzz tests** — Random sequences of moves, rotations, and drops validated against invariants
- **AI brain fuzz tests** — Placement evaluator tested with 10,000+ random board states
- **Scoring fuzz tests** — Thousands of random scenarios verify scoring math
- **Integration tests** — Full game loop with mock canvas, keyboard simulation, and attract mode
- **Edge case tests** — Boundary conditions, lock-out, T-Spin detection edge cases
- **SRS rotation tests** — Every wall kick table entry validated
- **DAS/ARR timing tests** — Autorepeat timing verified at millisecond precision

```bash
npm test            # run all tests (vitest)
npm run test:watch  # watch mode
npm run test:e2e    # Playwright E2E screenshot tests
```

## Development

```bash
npm install
npm run dev          # dev server at localhost:5173
npm run build        # TypeScript check + production build → dist/index.html
npm run preview      # preview production build
```

### Tech Stack

- **TypeScript** ~6.0 — strict mode across the entire codebase
- **Vite** ~8.0 — fast dev server and HMR
- **Vitest** ~4.1 — unit and integration test runner
- **Playwright** ~1.60 — E2E screenshot comparison tests
- **vite-plugin-singlefile** — all assets inlined into a single HTML output
- **Web Audio API** — synthesized music and sound effects (no audio files)

### Project Structure

```
src/
├── core/        # Game logic: board, pieces, SRS, gravity, scoring, lock delay, combos
├── render/      # Canvas rendering: board, HUD, menus, overlays, popups, animations
├── input/       # Keyboard handler with DAS/ARR autorepeat
├── audio/       # Web Audio chiptune synthesizer and SFX engine
├── ai/          # Placement evaluator and AI controller (attract mode)
└── game/        # Game loop: state machine, phase management, mode rules
```

## TDG Compliance Reference

| Section | Requirement | Status |
|---------|-------------|--------|
| §2 | Playfield: 10×20 visible + 20-row buffer | ✓ |
| §3 | SRS with wall kicks (separate JLSTZ / I tables) | ✓ |
| §5 | 7-bag randomizer, first-piece guarantee | ✓ |
| §6 | Ghost piece | ✓ |
| §7 | Scoring: T-Spins, B2B, Perfect Clear, combos | ✓ |
| §8 | 5 next, 500ms lock delay, 15 resets, 200ms entry delay | ✓ |
| §9 | T-Spin: 3-corner detection, full vs. Mini | ✓ |
| §11 | Variable Goal level system | ✓ |
| §12 | TDG gravity speed curve | ✓ |
| §13 | DAS 300ms / ARR 50ms | ✓ |
| §15 | Mode-specific level behavior | ✓ |
