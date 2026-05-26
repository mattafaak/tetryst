# Tetryst

**[Play it here — mattafaak.github.io/tetryst](https://mattafaak.github.io/tetryst/)**

A browser-based Tetris clone in TypeScript. Single-file build, no installation.

```bash
# Play offline (macOS / Linux)
curl -fsSL https://mattafaak.github.io/tetryst/ -o tetryst.html
open tetryst.html
```

---

## How to play

| Key | Action |
|-----|--------|
| `←` `→` | Move |
| `↓` | Soft drop (1 point per row) |
| `Space` | Hard drop (2 per row, locks instantly) |
| `↑` `Z` | Rotate clockwise |
| `X` | Rotate counter-clockwise |
| `C` `Shift` | Hold — stash the current piece for later |
| `P` `Esc` | Pause |
| `M` | Mute |

On the **menu**, `←` `→` changes the game mode. `↑`/`↓` adjusts the starting level in Marathon. Hit `Enter` to start.

If you **pause**, `↑` `↓` navigates between Resume, Restart, and Quit to Menu.

---

## Game modes

| Mode | Goal |
|------|------|
| **Marathon** | Reach level 15. Gravity speeds up as you go — starts at 1 row/second, ends at 200 rows/second. |
| **Sprint** | Clear 40 lines as fast as you can. Gravity stays slow the whole time. |
| **Ultra** | Score as much as possible in 3 minutes. |

---

## Scoring

Line clears are the main event:

| Lines | Base |
|-------|------|
| 1 (Single) | 100 × level |
| 2 (Double) | 300 × level |
| 3 (Triple) | 500 × level |
| 4 (Tetris) | 800 × level |

A **T-Spin** is when you wedge a T-piece into a gap using a wall kick (not just turning it in open air). It pays way more:

| | No lines | Single | Double | Triple |
|---|:---:|:---:|:---:|:---:|
| T-Spin | 400 | 800 | 1,200 | 1,600 |
| T-Spin Mini | 100 | 200 | — | — |

**Back-to-back (B2B):** If you chain two "difficult" clears (Tetris or T-Spin), the second one gets a 1.5× multiplier. A single line clear breaks the streak.

**Combo:** Every consecutive piece that clears lines adds 50 × combo count × (level + 1).

**Perfect Clear:** Clear the entire board at once — 800–3,200 × level depending on how many lines.

---

## How leveling works

Marathon doesn't just count lines. "Difficult" clears count for more:

| Clear | Effective lines |
|-------|:---:|
| Single | 1 |
| Double | 3 |
| Triple | 5 |
| Tetris | 8 |
| T-Spin Double | 12 |

You need 10 effective lines for the next level. So one T-Spin Double jumps you a level. One Tetris almost does. Back-to-back clears give a 1.5× multiplier on effective lines too.

---

## What makes this Tetris tick

**7-bag randomizer.** Older Tetris was pure random — you could get five Z-pieces in a row. This shuffles all 7 pieces into a bag, deals them one at a time, then reshuffles. Every 7 drops you get exactly one of each shape. The first piece is always I, J, L, or T (never O, S, or Z — easier to place on an empty board).

**SRS (Super Rotation System).** The official rotation standard. Try to rotate near a wall and the piece "kicks" sideways by 1–2 cells to make room. Without this you couldn't rotate near the edges. Different pieces have different kick tables — I-piece gets longer kicks, O-piece has none (rotating a square is pointless anyway).

**T-spin detection (3-corner rule).** The game checks the four diagonals around a T-piece's center. If at least 3 are occupied, it's a T-Spin. If the two corners on the flat side are the occupied ones, it's a Mini (fewer points).

**Lock delay.** When a piece lands, you have 500ms before it locks. Moving or rotating resets that timer — up to 15 times. Then it's locked. Between pieces there's a 200ms pause (entry delay) for the board to settle.

**DAS/ARR.** Hold a direction: the piece moves once, waits 167ms (DAS), then slides every 33ms (ARR). Prevents accidental double-taps.

**Ghost piece.** A faint outline showing exactly where the piece lands if you hard drop.

**5-piece next queue.** You can see what's coming and plan ahead.

**Hold.** Swap the current piece with storage. Once per piece drop — saves you from wasting a good piece.

---

## Board layout

```
   ┌────────────────────────┐
   │  BUFFER ZONE           │  ← hidden, pieces spawn here
   │  (20 rows above field) │
   ├────────────────────────┤
   │                        │  ← visible: 20 × 10 grid
   │  . . . . . . . . . .   │
   │  . . . . X X . . . .   │  ← active piece
   │  . . . . X X . . . .   │
   │  . . . . . . . . . .   │
   │  L L . . . . . . . .   │
   │  L L L Z Z . . . . .   │
   │  J L L Z Z . . . . .   │  ← locked pieces (the stack)
   │  J J L Z Z Z . . . .   │
   └────────────────────────┘
```

A **hole** is an empty cell with something above it — you can never fill those, so they're permanent damage. **Bumpiness** is how uneven your stack top is; flat is good. A **well** is a 1-wide gap; drop an I-piece through one for a Tetris.

---

## What's in the repo

```
src/
├── core/        Game logic: board, SRS, gravity, scoring, lock delay
├── render/      Canvas drawing: board, HUD, menus, effects, star field
├── input/       Keyboard handler with DAS/ARR
├── audio/       Synthesized chiptune and SFX (Web Audio API)
├── ai/          AI that plays itself (attract mode on the menu)
└── game/        Game loop and state machine
```

Everything compiles to one HTML file. No server, no dependencies, no internet once it's downloaded.

---

## Running it

```bash
npm install
npm run dev       # localhost:5173
npm run build     # TypeScript check + build → dist/index.html
npm run preview   # serve the built file
```

Tests use Vitest (~740, including 91 TDG compliance tests). Playwright covers E2E screenshots.

```bash
npm test            # unit + integration
npm run test:e2e    # Playwright
```

| Tech | What for |
|------|----------|
| TypeScript 6 | strict mode everywhere |
| Vite 8 | dev server, build |
| Vitest 4 | tests |
| Playwright 1.60 | E2E screenshot tests |
| Web Audio API | synthesized music + SFX (no audio files) |

---

## The 7 pieces

| Piece | Color | Shape |
|-------|-------|-------|
| I | Cyan | ████ |
| J | Blue | ┐ |
| L | Orange | └ |
| O | Yellow | ■ |
| S | Green | ᔑ |
| T | Purple | ┬ |
| Z | Red | ᓂ |

S and Z are mirrors of each other. Same with J and L. In rotation code, they're grouped as **JLSTZ** (same kick table), **I** (its own table), and **O** (no kicks).

---

## Things you might hear in competitive Tetris

| Term | What it means |
|------|---------------|
| **APM** | Attacks per minute — garbage sent per minute in versus modes |
| **Downstack** | Clearing lines to lower your stack (defense) |
| **Upstack** | Building higher to set up T-Spins (offense) |
| **Finesse** | Minimum key presses to place each piece |
| **Misdrop** | Put the piece in the wrong spot. We've all done it. |
| **Spike** | A sudden burst of garbage sent at once |
| **PC Opener** | An opening sequence designed for a Perfect Clear in the first ~10 pieces |
| **DAS Preservation** | Holding a direction through the entry delay so the next piece moves instantly |
