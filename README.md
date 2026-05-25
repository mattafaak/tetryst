# Tetryst

**[▶ Play Now — mattafaak.github.io/tetryst](https://mattafaak.github.io/tetryst/)**

A Tetris clone built in TypeScript, compliant with the 2009 Tetris Design Guideline (TDG).

## Quickstart

**In the browser:** [mattafaak.github.io/tetryst](https://mattafaak.github.io/tetryst/)

**Download and play offline** (macOS / Linux):
```bash
curl -fsSL https://mattafaak.github.io/tetryst/ -o tetryst.html && \
  (open tetryst.html 2>/dev/null || xdg-open tetryst.html 2>/dev/null || \
   echo "Open tetryst.html in your browser")
```
The downloaded file is fully self-contained — no internet connection required after download.

---

## Development

```bash
npm install
npm run dev   # dev server at localhost:5173
```

## Game Modes

| Mode | Goal | Level |
|------|------|-------|
| **Marathon** | Clear lines to reach Level 15 | Advances via Variable Goal (Tetrises level you faster) |
| **Sprint** | Clear 40 lines as fast as possible | Fixed at your starting level |
| **Ultra** | Score as many points as you can in 3 minutes | Fixed at your starting level |

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
| `Enter` | Start game |

## Scoring

| Action | Points |
|--------|--------|
| Single | 100 × level |
| Double | 300 × level |
| Triple | 500 × level |
| Tetris | 800 × level |
| T-Spin Single | 800 × level |
| T-Spin Double | 1200 × level |
| T-Spin Triple | 1600 × level |
| Back-to-Back bonus | ×1.5 on consecutive Tetrises / T-Spins |
| Perfect Clear Tetris | 2000 × level |
| Soft drop | 1 pt per cell |
| Hard drop | 2 pts per cell |

## Development

```bash
npm test          # run tests (658 tests across 25 files)
npm run build     # production build → single-file dist/index.html
npm run preview   # preview production build
```

## TDG Compliance

- **§2** 10×20 visible playfield, 20-row buffer zone
- **§3** Super Rotation System (SRS) with wall kicks
- **§5** 7-bag randomizer with first-piece guarantee (never O/S/Z first)
- **§6** Ghost piece
- **§7** Full scoring table including T-spins, Back-to-Back, Perfect Clear, combo bonuses
- **§8** 5-piece next queue, 500ms lock delay, 15 move resets, 200ms entry delay
- **§9** T-spin detection (3-corner rule, full vs. mini)
- **§11** Variable Goal level system — effective line credits (Tetris = 8, T-Spin Double = 12, B2B +50%)
- **§12** TDG gravity speed curve (1000ms at level 1 → 5ms at level 15)
- **§13** DAS/ARR autorepeat
- **§15** Sprint and Ultra: fixed level throughout; Marathon: Variable Goal progression
