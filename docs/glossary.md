# Tetris Glossary

A plain-English guide to the vocabulary of Tetris — from the official Tetris Design Guideline (TDG) to the slang you'll hear in competitive lobbies.

---

## The Basics

| Term | Plain English |
|------|---------------|
| **Mino** | A single square block. Every shape in Tetris is made of 4 minos. Think of them as Lego studs. |
| **Tetrimino** (or **Tetromino**) | One of the 7 geometric shapes formed by 4 minos. The official TDG spelling is *tetrimino*; the mathematical term is *tetromino*. Both mean the same thing — a shape made of 4 squares. |
| **Matrix** | The official name for the playing field: a 10-wide by 20-tall grid. Blocks land and stack here. |
| **Cell** | One position in the grid. A mino occupies one cell. |
| **Skyline** | The invisible horizontal line at the very top of the matrix. If blocks stack above it, you're in danger. |
| **Buffer Zone** | 20 extra rows *above* the visible playfield where pieces spawn. You don't see it, but it's there — if a piece locks entirely in the buffer zone, the game ends (lock out). |

---

## The 7 Tetriminos

Each shape is named after the letter it resembles. The colors are standardized by the TDG:

| Piece | Color | Shape | Nickname |
|-------|-------|-------|----------|
| **I** | Cyan | ████ | "the long bar", "the stick" |
| **J** | Blue | ┐ | "the hook" — looks like an inverted L |
| **L** | Orange | └ | "the elbow" |
| **O** | Yellow | ■ | "the square", "the box" |
| **S** | Green | ᔑ | "the snake" — curves right |
| **T** | Purple | ┬ | "the tee" |
| **Z** | Red | ᓂ | "the zigzag" — curves left |

S and Z are mirror images. Same for J and L. Players often group them: **JLSTZ** (the kickable ones) vs. **I** (its own kick rules) vs. **O** (doesn't kick at all — it's a square, rotation changes nothing visually).

---

## How You Play

| Term | Plain English |
|------|---------------|
| **Drop** | A piece falling straight down. In the original NES game, pieces fell at a fixed speed. Modern Tetris has two faster options: |
| **Soft Drop** | Hold down — the piece falls 20x faster than normal gravity. You get 1 point per row dropped. |
| **Hard Drop** | Press space — the piece teleports instantly to the bottom and locks. You get 2 points per row dropped. The fastest way to place a piece. |
| **Lock Down** | The moment a piece becomes permanent — it can no longer be moved or rotated. It's now part of the stack. |
| **Hold** | Swap the current falling piece with the one in storage. You can only hold once per piece (no infinite swapping). Use it to save a piece for when you need it. |
| **Next Queue** | Shows the next pieces coming up. The TDG requires showing at least 3; Tetryst shows 5. This lets you plan ahead. |
| **Ghost Piece** | A faint outline showing exactly where the piece will land if you hard drop. Helps beginners see where they're placing things. |

---

## The Board — Visual Reference

```
   ┌────────────────────────┐
   │  BUFFER ZONE           │  ← Invisible. Pieces spawn here.
   │  (20 hidden rows)      │
   ├────────────────────────┤
   │  VISIBLE PLAYFIELD     │  ← What you see: 20 rows tall
   │                        │
   │  . . . . . . . . . .   │
   │  . . . . . . . . . .   │
   │  . . . . . . . . . .   │
   │  . . . . . . . . . .   │
   │  . . . X X . . . . .   │  ← Active piece (the falling one)
   │  . . . X X . . . . .   │
   │  . . . . . . . . . .   │
   │  L L L . . . . . . .   │
   │  L L L L Z Z . . . .   │
   │  J J L L Z Z . . . .   │  ← Stack (locked pieces)
   │  J J J L Z Z Z . . .   │
   └────────────────────────┘
  COLUMNS: 1 2 3 4 5 6 7 8 9 10

  ◌ Ghost piece (faint outline showing landing position)
  █ Locked piece (part of the stack)
```

| Term | Plain English |
|------|---------------|
| **Stack** | The accumulated pile of locked pieces. How you manage this is the entire game. |
| **Column** | One vertical stripe of the grid (10 total). Each column has a *height*. |
| **Well** | A vertical gap in the stack, usually 1 cell wide. A 1×4 well is where a Tetris comes from — drop an I-piece straight down it. |
| **Hole** | An empty cell with a locked piece above it. Holes are bad — you can't see them fill, and they'll never be cleared by the current piece. |
| **Bumpiness** | How uneven the top of your stack is. A flat stack is good (easier to place pieces). A jagged stack creates holes. |
| **Garbage** | (Versus modes) Random junk rows that rise from the bottom, sent by your opponent. |
| **Top Out** | Game over — your stack reached the top of the visible playfield. |
| **Block Out** | Game over — a piece spawned but immediately overlapped existing blocks. No room. |
| **Lock Out** | Game over — a piece locked entirely inside the buffer zone (completely above the visible field). |

---

## How Pieces Spawn: The 7-Bag System

Older Tetris used pure random. You could get 5 Z-pieces in a row and zero I-pieces for 40 drops. The 7-bag system solves this.

Imagine a bag with exactly one of each piece:
```
[T, Z, L, I, O, S, J]    ← shuffled randomly
 ↑  ↑  ↑  ↑  ↑  ↑  ↑
You draw them one at a time. When the bag is empty, refill and reshuffle.
```

**What this guarantees:**
- Every 7 pieces, you get *exactly one of each* shape
- No more than 2 of the same piece in a row (only at bag boundaries)
- Max 12 drops between I-pieces (worst case: last of bag 1, first of bag 3)
- You can plan — if you haven't seen an S in 5 drops, it's coming soon

**The First-Piece Bonus:** The first piece of the game is never O, S, or Z — only I, J, L, or T. These are easier to place on an empty board.

---

## Advanced Movement: SRS and Wall Kicks

| Term | Plain English |
|------|---------------|
| **SRS (Super Rotation System)** | The official rotation system, standardized by the TDG. It defines exactly how each piece rotates and what to do when rotation would hit a wall or floor. Think of it as the physics engine for piece rotation. |
| **Wall Kick** | When you try to rotate a piece next to a wall (or another block), the piece "kicks" sideways — it shifts over by 1 or 2 cells to make room. Without wall kicks, you couldn't rotate anywhere near the edges. |
| **Kick Table** | A lookup table that says "if rotation fails here, try these 4 offset positions in order." Different tables for JLSTZ pieces vs. I-piece (longer kicks) vs. O-piece (no kicks). |

### What SRS feels like in practice

Try to rotate an L-piece against the right wall:

```
Before:      After CW rotation:
┌───┐        ┌───┐
│ L │        │ L │
│ L │  →     └───┘
│ L │  L      L  
              L
```

Without a wall kick, the rotation would fail (it hits the wall). SRS tries: "ok, can I shift it left by 1? Left by 2?" — it kicks the piece 1 cell left and places it cleanly. You barely notice it happened, but that's the system working.

### T-Spin: The most important technique

| Term | Plain English |
|------|---------------|
| **T-Spin** | A move where you use a wall kick to *spin* a T-piece into a tight spot. Instead of pressing rotate freely, you wedge the T-piece into a gap it barely fits. This awards higher points than a regular line clear. |
| **T-Slot** | A 3-cell gap in the stack shaped like a T. The neck of the T is where the T-piece's center will land. |
| **3-Corner Rule** | How the game detects a T-Spin: look at the 4 diagonal corners around the T-piece's center. If at least 3 of them are occupied, it's a T-Spin. |
| **T-Spin Mini** | A variant where only 3 corners are occupied AND the two corners on the flat side of the T are the occupied ones. Worth fewer points than a full T-Spin. |

### Why T-Spins matter

A single line clear is worth 100 × level. A T-Spin Single is worth 800 × level — **8x more**. A T-Spin Double is 1200 × level. In modern Tetris, T-Spins are the primary strategy for high scores and versus-mode damage.

---

## Timing Windows

| Term | Plain English |
|------|---------------|
| **Lock Delay** | After a piece lands on the stack, you have 500ms before it locks in place. Each time you move or rotate the piece successfully, the timer resets (up to 15 resets max). This gives you time to wiggle it into tight spots. |
| **Move Reset** | Each successful movement or rotation while grounded resets the lock delay timer. You get 15 of these before the piece locks no matter what. |
| **Entry Delay** | A brief pause (200ms) between locking one piece and the next appearing. Gives the game time to collapse cleared rows and position the next piece. |
| **Gravity** | How fast pieces fall. In Marathon, gravity starts at 1 row per second (Level 1) and accelerates to 200 rows per second (Level 15). Sprint and Ultra keep gravity at Level 1 speed. |
| **DAS (Delayed Auto-Shift)** | Hold a left/right key. The piece moves once, pauses (167ms), then slides automatically at high speed. Prevents accidental double-moves. |
| **ARR (Auto-Repeat Rate)** | Once DAS kicks in, how fast the piece slides. 33ms between moves = very fast. Skilled players set this to 0 for instant wall-to-wall movement. |
| **Line Clear Animation** | A brief visual flash (roughly 400ms) when rows are cleared. During this time, pieces don't fall but the Ultra timer keeps ticking. |

---

## Scoring: How You Earn Points

### Line Clears

| Clear | Lines | Base Points | Plain English |
|-------|-------|-------------|---------------|
| **Single** | 1 line | 100 × level | One row filled |
| **Double** | 2 lines | 300 × level | Two rows at once |
| **Triple** | 3 lines | 500 × level | Three rows — requires an L, J, S, or Z |
| **Tetris** | 4 lines | 800 × level | All four rows with an I-piece. The classic payoff. |

### T-Spin Bonuses

A T-Spin means you wedged a T-piece into a gap using a wall kick, not by just turning freely.

| Clear | Points |
|-------|--------|
| T-Spin (no lines) | 400 × level |
| T-Spin Single | 800 × level |
| T-Spin Double | 1,200 × level |
| T-Spin Triple | 1,600 × level |
| T-Spin Mini (no lines) | 100 × level |
| T-Spin Mini Single | 200 × level |

### Streak Bonuses

| Bonus | How it works |
|-------|-------------|
| **Back-to-Back (B2B)** | Do two "difficult" clears in a row (Tetris or T-Spin) and get a 1.5× multiplier on the second one. Do a single in between and the streak resets. |
| **Combo** | Clear lines on consecutive pieces. Each clear after the first adds 50 × combo count × (level + 1). The streak resets when a piece locks without clearing anything. |
| **Perfect Clear** | Clear *every single block* on the board at once. Awards massive points: 800–3,200 × level depending on how many lines you cleared. The rarest and most rewarding move. |

### Other Points

| Action | Points |
|--------|--------|
| Soft drop | 1 per row dropped |
| Hard drop | 2 per row dropped |

### Variable Goal — how Marathon leveling works

Marathon doesn't just count lines. Each difficult clear gives *effective lines* toward the next level:

| Clear | Effect on Level |
|-------|----------------|
| Single | +1 line |
| Double | +3 lines |
| Triple | +5 lines |
| Tetris | **+8 lines** |
| T-Spin Double | **+12 lines** |
| Back-to-Back | ×1.5 multiplier |

You need 10 effective lines to advance one level. A Tetris is worth 8 lines, so one Tetris almost levels you up. A T-Spin Double is worth 12 — that's a full level in one move.

---

## Game Modes

| Mode | The goal | How it ends |
|------|----------|-------------|
| **Marathon** | Reach Level 15. Gravity accelerates with each level. The classic endurance test. | Game over when you top out. |
| **Sprint** | Clear 40 lines as fast as possible. No leveling — gravity stays at Level 1 speed. | Clock stops when line 40 clears. |
| **Ultra** | Score as many points as possible in 3 minutes. No leveling. Timer runs continuously (even during line-clear animations). | 3-minute countdown. |

---

## The Competitive Lexicon

Terms you'll hear in modern Tetris (TETR.IO, Jstris, Hard Drop community):

| Term | Meaning |
|------|---------|
| **APM** | Attacks Per Minute — how many lines of garbage you send per minute. The core stat in versus play. |
| **Downstack** | Deliberately clearing lines on your side to lower your stack height. Defense. |
| **Upstack** | Building your stack higher to set up T-Spins or Tetrises. Offense. |
| **Finesse** | Using the fewest possible key presses to place a piece perfectly. A measure of mechanical skill. |
| **Misdrop** | Placing a piece in the wrong spot. We've all been there. |
| **Flood / Drought** | Too many / too few of a particular piece. Even with 7-bag, short-term patterns can feel streaky. |
| **Spike** | A sudden burst of garbage lines sent to an opponent (usually from a T-Spin Double or Tetris). |
| **8-Spinner** | An opener that sends 8 lines of garbage. Common in competitive matches. |
| **Perfect Clear (PC) Opener** | An opening sequence designed to clear the entire board within the first ~10 pieces. High risk, high reward. |
| **Donation** | A setup where you intentionally take garbage to set up a bigger attack. |
| **Stalling** | Deliberately delaying your piece placement (e.g., during a 4-wide combo) to let garbage accumulate and extend your chain. |
| **Zone** | (TETR.IO) A freeze mechanic where you bank cleared lines and release them as a single massive spike. |
| **Crash** | (NES) The NES Tetris freeze bug at Level 155+. |
| **Rolling / Hypertapping** | Two finger techniques for achieving high-speed play on NES hardware. Rolling (using finger rolls, like drumming) has largely replaced hypertapping (rapid single-finger vibration). |
| **Floating / Suspension** | An advanced building technique where pieces are deliberately placed over gaps without support, creating T-Spin opportunities. |
| **Burning / Shaving** | Clearing lines inefficiently just to survive or reduce stack height. Desperate times. |
| **Baiting** | (Tetris 99) Building high to look vulnerable, drawing attackers, then dumping a big clear on them. |
| **T-spin Setup / Opener** | A predetermined sequence of moves for the first ~6-8 pieces of a game that guarantees a T-Spin. Every competitive player knows several openers. |
| **Piece Dependency** | A setup that only works with a specific piece — if that piece doesn't arrive in time, the setup fails. |
| **Parity** | An analytical method for evaluating board flatness — every cell has a "color" (like a chessboard), and imbalanced color counts predict hole formation. |
| **DAS Preservation** | Maintaining DAS charge between pieces by not releasing the direction key during entry delay. Allows instant movement as soon as the next piece spawns. |

---

## Mechanical Hearts and the Frontier of Tetris

Tetris theory is still evolving. **Mechanical Hearts** (also known as LST Spin) is a loop technique discovered in 2023-2024 that lets you cycle through bags while maintaining a near-perfect board. It's named because the T-piece tracks a heart-shaped path. This is cutting-edge stuff — being debated and refined in forums right now.

Most players will never need it. But the fact that people are *still inventing new techniques* in a 40-year-old game says something.

---

## Official vs. Common Terminology

The Tetris Company enforces specific official terms for licensed products. The community often uses different words:

| Official (TDG) | Common Usage |
|----------------|--------------|
| Tetrimino | Tetromino, "piece" |
| Matrix | Board, playfield, grid |
| Mino | Block, cell, square |
| Lock Down | Lock, place, snap |
| Random Generator | 7-bag, bag system |
| Receive Queue | Garbage meter |
| T-Slot | T-spin hole, the pocket |
| Line Clear | Line, row clear |
| Skyline | Top of the field |
| Fall Speed | Gravity, speed, drop rate |

In practice, nobody says "matrix" in a Twitch chat. They say "board." The glossary above leans toward plain English over official branding — you'll sound like a player, not a manual.
