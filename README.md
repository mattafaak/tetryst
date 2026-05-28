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

## What makes this Tetris tick

**7-bag randomizer.** Older Tetris was pure random, so you could get five Z-pieces in a row. This shuffles all 7 pieces into a bag, deals them one at a time, then reshuffles. Every 7 drops you get exactly one of each shape. The first piece is always I, J, L, or T (never O, S, or Z, which are harder to place on an empty board).

**SRS (Super Rotation System).** The official rotation standard. Try to rotate near a wall and the piece "kicks" sideways by 1-2 cells to make room. Without this you couldn't rotate near the edges. Different pieces have different kick tables — I-piece gets longer kicks, O-piece has none.

**T-spin detection (3-corner rule).** The game checks the four diagonals around a T-piece's center. If at least 3 are occupied, it's a T-Spin. If the two corners on the flat side are the occupied ones, it's a Mini (fewer points).

**Lock delay.** When a piece lands, you have 500ms before it locks. Moving or rotating resets that timer, up to 15 times. Between pieces there's a 200ms entry delay.

**DAS/ARR.** Hold a direction: the piece moves once, waits 300ms (DAS), then slides every 50ms (ARR). Prevents accidental double-taps.

**Ghost piece.** A faint outline showing where the piece lands if you hard drop.

**5-piece next queue.** See what's coming and plan ahead.

**Hold.** Swap the current piece with storage. Once per piece drop.
