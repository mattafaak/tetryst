# Audio Engine Overhaul — Spec SSOT

Created: 2026-05-27  
Phase: 28  
Status: ACTIVE

---

## 1. Goal

Replace the current single-voice, single-song synthesizer (`music.ts`) with a
four-channel NES APU–style engine supporting three songs, per-mode defaults,
level-driven tempo modulation, and NES-authentic SFX. The underlying melodies
come from the NES and GB Tetris ROMs available at:

- `/home/jwhit/Downloads/Tetris (USA).nes`  
- `/home/jwhit/Downloads/Tetris (World) (Rev 1).gb`
  - GB music data confirmed at byte offset `0x5000–0x5200`

---

## 2. File Layout

```
src/audio/
  audio-ctx.ts          ← unchanged (shared AudioContext singleton)
  apu.ts                ← NEW: channel factory + APU mixer
  sequencer.ts          ← NEW: multi-channel song scheduler
  songs/
    type-a.ts           ← REFACTORED: Korobeiniki, 4-channel
    type-b.ts           ← NEW: second theme, 4-channel
    type-c.ts           ← NEW: third theme, 4-channel
  sfx-defs.ts           ← NEW: SFX event data (no Web Audio imports)
  music.ts              ← REPLACED: thin public API over Sequencer
  sfx.ts                ← REPLACED: plays sfx-defs via APU channels
  audio.test.ts         ← UPDATED: cover new engine paths
tools/
  extract-rom-music.py  ← NEW: ROM analysis helper (not bundled)
```

---

## 3. Preserved Public API

These exact signatures must be preserved (callers: `loop.ts`, `audio.test.ts`):

```typescript
// music.ts
export function playMusic(): void;
export function stopMusic(): void;

// sfx.ts
export type SFXName =
  | "move" | "rotate" | "lock" | "clear"
  | "tetris" | "tspin" | "hold" | "levelup" | "gameover";
export function playSFX(name: SFXName): void;
```

New additions to `music.ts`:

```typescript
// Select song index (0 = Type A, 1 = Type B, 2 = Type C)
export function setSong(index: 0 | 1 | 2): void;

// Tempo multiplier: 1.0 = base BPM, 1.3 = 30% faster
// Call from loop.ts on level-up: setTempoMultiplier(1.0 + level * 0.015)
export function setTempoMultiplier(factor: number): void;
```

---

## 4. Core Types  (`src/audio/apu.ts`)

```typescript
/** A single note for a tonal channel (pulse or triangle). */
export interface ChannelNote {
  beat: number;   // Start beat (0-indexed, fractional allowed)
  dur: number;    // Duration in beats (sustain portion, typically 0.85–0.95 of full)
  freq: number;   // Frequency Hz — 0 = rest (silence)
}

/** A single hit on the noise channel. */
export interface NoiseNote {
  beat: number;
  dur: number;    // Duration in beats
  vol: number;    // Relative volume 0.0–1.0 (applied against channel gain)
  hp: number;     // Highpass filter Hz (5000–8000 for hi-hat character)
}

/** Complete four-channel song. */
export interface Song {
  title: string;
  bpm: number;             // Base tempo; Sequencer applies tempoMultiplier on top
  pulse1: ChannelNote[];   // Lead melody — 25% duty cycle pulse
  pulse2: ChannelNote[];   // Harmony / countermelody — 50% duty cycle pulse
  triangle: ChannelNote[]; // Bass line — triangle oscillator
  noise: NoiseNote[];      // Percussion
  totalBeats: number;      // Precomputed: max(beat + dur) across all channels
}
```

---

## 5. APU Channel Factory  (`src/audio/apu.ts`)

### 5.1 Pulse wave with variable duty cycle

Web Audio `OscillatorNode` type `"square"` is locked at 50% duty.
Use `PeriodicWave` to approximate 25% and 12.5%:

```typescript
/**
 * Returns an OscillatorNode configured as a pulse wave.
 * duty: 0.25 → NES-style 25% pulse (bright, thin)
 *       0.50 → equivalent to built-in "square"
 */
export function createPulseOsc(
  ctx: AudioContext,
  duty: 0.125 | 0.25 | 0.5 | 0.75 = 0.25,
): OscillatorNode {
  const harmonics = 32;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  real[0] = 0; // no DC
  for (let n = 1; n < harmonics; n++) {
    imag[n] = (2 / (Math.PI * n)) * Math.sin(2 * Math.PI * duty * n);
  }
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
  return osc;
}
```

### 5.2 APU Mixer

```typescript
export interface APUMixer {
  pulse1: GainNode;    // Lead channel
  pulse2: GainNode;    // Harmony channel
  triangle: GainNode;  // Bass channel
  noise: GainNode;     // Percussion channel
  master: GainNode;    // Overall volume
}

/**
 * Build an APU-style mixer connected to ctx.destination.
 * Volume balance approximates NES hardware output levels.
 */
export function createAPUMixer(ctx: AudioContext): APUMixer;
```

**Volume balance (must match these values):**

| Channel  | GainNode.gain | Reason |
|----------|--------------|--------|
| pulse1   | 0.25         | Lead melody — audible over all |
| pulse2   | 0.20         | Supporting harmony |
| triangle | 0.18         | Bass — powerful but not muddy |
| noise    | 0.14         | Percussion — present but subtle |
| master   | 0.70         | Headroom; prevents clipping at full mix |

---

## 6. Sequencer  (`src/audio/sequencer.ts`)

### 6.1 Scheduling

```typescript
export class Sequencer {
  constructor(mixer: APUMixer)

  /** Load and immediately schedule the first cycle. */
  start(song: Song, ctx: AudioContext): void

  /** Stop all scheduled audio and clear internal state. */
  stop(): void

  /**
   * Update tempo. Safe to call mid-song; takes effect on next loop cycle.
   * factor = 1.0 → base BPM  |  factor = 1.3 → 30% faster
   */
  setTempoMultiplier(factor: number): void
}
```

### 6.2 Scheduling algorithm

The sequencer pre-schedules one full song at a time using
`AudioContext.currentTime` — no `setTimeout` for timing (only for triggering
the next cycle):

```
lookAhead = 0.08   // 80ms — keep this value
now = ctx.currentTime
beatDuration = (60 / song.bpm) / tempoMultiplier
scheduleSong(events, now + lookAhead)
songDuration = totalBeats * beatDuration
setTimeout(reschedule, (songDuration + 0.1) * 1000)
```

### 6.3 Per-channel scheduling

For each `ChannelNote` on pulse1/pulse2/triangle:
1. Create oscillator (`createPulseOsc(ctx, 0.25)` for pulse1, `createPulseOsc(ctx, 0.5)` for pulse2, `ctx.createOscillator()` type `"triangle"` for triangle)
2. Set `frequency.setValueAtTime(note.freq, t)` — skip if `freq === 0`
3. Apply ADSR envelope to note's GainNode: attack 6ms, decay 50ms, sustain 70%, release 40ms
4. Connect: oscillator → noteGain → channelGain (from mixer)

For each `NoiseNote`:
- Create white-noise `AudioBuffer` (existing `playNoise` approach, keep it)
- Apply highpass at `note.hp` Hz
- Use `note.vol` scaled against mixer.noise.gain

---

## 7. Song Data Format

### 7.1 Type A — Korobeiniki (`src/audio/songs/type-a.ts`)

**Source**: Expand the existing `MELODY` array in `music.ts` into four voices.  
**BPM**: 144  
**Time signature**: 2/4 (each "beat" = 1 quaver / eighth note)

The existing `MELODY` array becomes `pulse1` (lead, 25% duty).  
Add:
- `pulse2`: harmony line (thirds/sixths below melody in A minor)
- `triangle`: bass line derived from `BASS_ROOTS` mapping — but as explicit `ChannelNote[]` instead of the current per-note lookup
- `noise`: hi-hat on beats 1.5, 3.5, 5.5 ... (existing pattern, make explicit)

Export format:
```typescript
export const SONG_TYPE_A: Song = {
  title: "Type A",
  bpm: 144,
  pulse1: [...],   // existing MELODY converted
  pulse2: [...],   // new harmony
  triangle: [...], // explicit bass notes
  noise: [...],    // hi-hat pattern
  totalBeats: 176, // pre-computed
};
```

### 7.2 Type B — second theme (`src/audio/songs/type-b.ts`)

**Source**: Transcribe from the NES ROM (`Tetris (USA).nes`) or GB ROM (`Tetris (World) (Rev 1).gb`).  
**Character**: Slower and more lyrical than Type A; often 3/4 waltz feel.  
**BPM**: ~104–120  

ROM extraction guidance (see Section 11).

### 7.3 Type C — third theme (`src/audio/songs/type-c.ts`)

**Source**: Transcribe from the NES ROM.  
**Character**: Short, simple, high-energy; often loops faster.  
**BPM**: ~150–168  

---

## 8. SFX Definitions  (`src/audio/sfx-defs.ts`)

Each SFX is a pure data object describing a sequence of oscillator events.
No Web Audio imports in this file — it is pure TypeScript data.

```typescript
interface OscEvent {
  type: "osc";
  waveType: "pulse25" | "pulse50" | "triangle" | "sawtooth";
  startFreq: number;
  endFreq?: number;     // if set, use linearRamp; else constant
  duration: number;     // seconds
  delay: number;        // seconds offset from SFX trigger time
  volume: number;
  decay: boolean;
}

interface NoiseEvent {
  type: "noise";
  duration: number;
  delay: number;
  volume: number;
  hp: number;
}

type SFXEvent = OscEvent | NoiseEvent;

interface SFXDef {
  events: SFXEvent[];
}
```

**Target SFX character (NES-authentic):**

| SFX       | Character | Notes |
|-----------|-----------|-------|
| move      | Short low blip, pulse25, 150Hz, 60ms | Quiet, non-distracting |
| rotate    | Mid tone, pulse25, 280Hz, 80ms | Slightly higher than move |
| lock      | Low thud, triangle, 90Hz, 120ms | Weighty |
| clear     | Rising sweep, pulse50, 180→720Hz, 220ms | Satisfying |
| tetris    | Chord: [262, 330, 392, 523] Hz, triangle, 400ms | Celebratory |
| tspin     | Ascending pair, pulse25, 350+500Hz, 150ms | Special |
| hold      | Quick mid blip, pulse25, 240Hz, 60ms | Similar to move |
| levelup   | Three-tone fanfare, pulse25, 400/500/600Hz | Ascending |
| gameover  | Descending sweep, pulse25, 400→90Hz, 700ms | Mournful |

---

## 9. Game Loop Integration  (`src/game/loop.ts`)

### 9.1 Tempo modulation on level-up

In `loop.ts`, when `result.leveledUp` is true after `executeLock`:
```typescript
import { setTempoMultiplier } from "../audio/music.ts";
// ...
if (result.leveledUp) {
  setTempoMultiplier(1.0 + this.state.level * 0.015);
}
```

This gives ~15% speed increase at level 10, ~30% at level 20.

### 9.2 Mode → default song

In `loop.ts`, when starting a new game (`startGame()`):
```typescript
import { setSong } from "../audio/music.ts";
// ...
const songMap: Record<GameMode, 0 | 1 | 2> = {
  [GameMode.Marathon]: 0,  // Type A
  [GameMode.Ultra]: 1,     // Type B
  [GameMode.Sprint]: 2,    // Type C
};
setSong(songMap[this.selectedMode]);
```

---

## 10. Testing Requirements

All existing `audio.test.ts` tests must pass. Add:

1. **APU mixer test**: `createAPUMixer` creates 5 GainNodes; master connects to `ctx.destination`
2. **Pulse duty test**: `createPulseOsc(ctx, 0.25)` has `PeriodicWave` set (not built-in type)
3. **Sequencer start/stop**: `start()` schedules oscillators; `stop()` cleans them up
4. **Tempo multiplier**: `setTempoMultiplier(2.0)` halves the effective beat duration
5. **setSong**: calling `setSong(1)` then `playMusic()` plays SONG_TYPE_B
6. **Song totalBeats**: each exported song's `totalBeats` matches `max(note.beat + note.dur)` across all channels

---

## 11. ROM Extraction Guidance  (`tools/extract-rom-music.py`)

The implementing model should create this Python helper to assist transcription:

```python
#!/usr/bin/env python3
"""
Dump potential music data from NES/GB Tetris ROMs.
Usage:
  python3 tools/extract-rom-music.py nes  ~/Downloads/Tetris\ \(USA\).nes
  python3 tools/extract-rom-music.py gb   ~/Downloads/"Tetris (World) (Rev 1).gb"
"""
import sys, struct

def dump_nes(path):
    with open(path, 'rb') as f:
        data = f.read()
    prg = data[16 : 16 + data[4] * 16384]
    print(f"PRG-ROM: {len(prg)} bytes")
    # APU pulse period → Hz: freq = 1789773 / (16 * (period + 1))
    # Look for period values matching musical notes (e.g. A4=254, B4=226, E5=202)
    note_periods = {'A4':254,'B4':226,'C5':213,'D5':190,'E5':169}
    for name, p in note_periods.items():
        positions = [i for i in range(len(prg)-1) if prg[i]==p&0xFF]
        print(f"  {name} period={p}: {len(positions)} occurrences")

def dump_gb(path):
    with open(path, 'rb') as f:
        data = f.read()
    # GB music data confirmed at 0x5000–0x5200
    region = data[0x5000:0x5400]
    print(f"GB ROM 0x5000–0x5400 ({len(region)} bytes):")
    for i in range(0, min(256, len(region)), 16):
        print(f"  {0x5000+i:04x}: {' '.join(f'{b:02x}' for b in region[i:i+16])}")

if __name__ == "__main__":
    mode, path = sys.argv[1], sys.argv[2]
    if mode == 'nes': dump_nes(path)
    elif mode == 'gb': dump_gb(path)
```

For Type B and Type C note data, the implementing model should:
1. Run the extraction script to identify note patterns
2. Cross-reference with verified MIDI transcriptions (search for "NES Tetris Type B MIDI" or "GB Tetris Music B MIDI")
3. Transcribe using the `ChannelNote[]` format defined in Section 7

**Public domain note**: Korobeiniki is a Russian folk song (public domain). The NES/GB arrangements are copyrighted by Nintendo/Bullet-Proof Software but the underlying melodies are not. Type B (Bach Musette/Menuet) and Troika are also based on public domain compositions.

---

## 12. Build Constraint

The game builds to a single HTML file via `vite-plugin-singlefile`.  
`npm run build` must produce `dist/index.html` ≤ 70 kB gzip.  
Audio data (song arrays, sfx-defs) is pure TypeScript — no external assets.  
After the overhaul, gzip size should not exceed 20 kB gzip (currently ~17 kB).
