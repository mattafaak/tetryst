# Tetryst

**[Play it here: mattafaak.github.io/tetryst](https://mattafaak.github.io/tetryst/)**

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
| `↑` `X` | Rotate clockwise |
| `Z` | Rotate counter-clockwise |
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
| 1 (Single) | 100 x level |
| 2 (Double) | 300 x level |
| 3 (Triple) | 500 x level |
| 4 (Tetris) | 800 x level |

A **T-Spin** is when you wedge a T-piece into a gap using a wall kick (not just rotating it in open air). It scores more:

| | No lines | Single | Double | Triple |
|---|:---:|:---:|:---:|:---:|
| T-Spin | 400 | 800 | 1,200 | 1,600 |
| T-Spin Mini | 100 | 200 | — | — |

**Back-to-back (B2B):** Chain two difficult clears (Tetris or T-Spin) and the second gets a 1.5x multiplier. A single line clear breaks the streak.

**Combo:** Every consecutive piece that clears lines adds 50 x combo count x (level + 1).

**Perfect Clear:** Clear the entire board at once — 800-3,200 x level depending on how many lines.

---

## How leveling works

Marathon doesn't just count lines. Difficult clears count for more:

| Clear | Effective lines |
|-------|:---:|
| Single | 1 |
| Double | 3 |
| Triple | 5 |
| Tetris | 8 |
| T-Spin Double | 12 |

You need 10 effective lines for the next level. One T-Spin Double levels you up. One Tetris almost does. Back-to-back clears give a 1.5x multiplier on effective lines too.

---

## Guideline compliance

This is a full implementation of the 2009 Tetris Design Guideline. Every mechanic listed below is verified correct against the spec.

**7-bag randomizer.** Older Tetris was pure random, so you could get five Z-pieces in a row. This shuffles all 7 pieces into a bag, deals them one at a time, then reshuffles. Every 7 drops you get exactly one of each shape. The first piece is always I, J, L, or T (never O, S, or Z, which are harder to place on an empty board).

**SRS (Super Rotation System).** The official rotation standard. All 8 rotation transitions for JLSTZ pieces and all 8 for the I-piece use the exact TDG kick tables. Try to rotate near a wall and the piece kicks sideways 1-2 cells to make room. The O-piece has no kicks.

**T-spin detection (3-corner rule + kick exception).** The game checks the four diagonal corners of the T-piece's 3x3 bounding box. 3 or more occupied corners and it's a T-Spin; if only the two front corners are occupied, it's a Mini. Kick tests 4 and 5 (the last two wall-kick offsets) always produce a full T-Spin regardless of the corner check — this is the TDG kick exception.

**Lock delay with extended placement.** When a piece touches the ground, you have 500ms before it locks. Moving or rotating resets that timer, up to 15 times per piece. If the piece falls to a new lowest row, the reset counter is cleared — so you can keep stalling as long as you keep moving down.

**IRS (Initial Rotation System).** Press a rotation key during the entry delay or line-clear animation and the next piece spawns already rotated. Works for both clockwise and counter-clockwise.

**IHS (Initial Hold System).** Press Hold during the entry delay or line-clear animation and the next piece is immediately swapped into the hold slot on spawn.

**DAS/ARR.** Hold left or right: the piece moves once, waits 300ms (DAS), then slides every 50ms (ARR). Soft drop has no initial delay and repeats at 50ms. These match the TDG reference timings.

**Gravity curve.** 16-level speed table from 1000ms/row (level 0) down to 5ms/row (level 15). Gravity accumulates across frames so the piece drops the correct number of rows even at extreme speeds.

**Lock-out and block-out.** Lock-out: a piece that locks entirely in the 20-row hidden buffer above the visible field ends the game. Block-out: a newly spawned piece that overlaps existing blocks ends the game.

**Ghost piece.** A faint outline showing exactly where the piece lands if you hard drop.

**5-piece next queue.** Within the TDG-specified range of 4-6.

**Hold.** Swap the current piece with storage. Once per piece drop.
