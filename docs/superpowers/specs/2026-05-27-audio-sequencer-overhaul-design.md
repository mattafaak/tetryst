# Audio Sequencer Overhaul — Design Spec

**Date:** 2026-05-27  
**Scope:** `src/audio/sequencer.ts`, `src/audio/apu.ts`  
**Unchanged:** `src/audio/songs/`, `src/audio/music.ts`, `src/audio/sfx.ts`, `src/audio/apu.ts` (APUMixer only)

---

## Problem Statement

Three confirmed bugs in the Phase 28 audio engine:

1. **Polyphony / phasing** — one oscillator is created per note, so a 176-note song cycle spawns ~500+ simultaneous oscillator nodes. Consecutive same-pitch notes (e.g. `["A4", 0.5], ["A4", 0.5]`) produce two overlapping oscillators at identical frequency, causing phase-cancellation and clicks. Each oscillator has a `end + 0.01s` stop tail, creating 10ms overlaps on every note boundary.

2. **Loop stutter (~180ms gap)** — `scheduleOneCycle` fires its `setTimeout` at `songDuration + 0.1s`, then sets `startTime = ctx.currentTime + 0.08s`. By then `currentTime ≈ songDuration + 0.1s`, so the next cycle's beat 0 lands at `songDuration + 0.18s` — a 180ms audible silence at every loop point.

3. **Harshness** — pulse wave uses 32 Fourier harmonics (energy up to ~14 kHz, causing aliasing); ADSR uses `linearRampToValueAtTime` throughout; no high-frequency rolloff on pulse channels. Triangle channel gets full ADSR treatment despite NES triangle having no volume envelope.

---

## Architecture

### Continuous Oscillators (pulse1, pulse2, triangle)

Replace the per-note oscillator model with **3 permanent oscillators** — one per tonal channel — created at `start()` and torn down at `stop()`.

Note transitions are scheduled by automating the oscillator's `.frequency` and `.gain` AudioParams using `setValueAtTime` / `exponentialRampToValueAtTime`. No new oscillator nodes are created during playback.

**Audio graph per pulse channel:**
```
PulseOscillator → NoteGainNode → LowpassFilter (4.5 kHz) → APUMixer.pulseN → master → destination
```

**Audio graph for triangle:**
```
TriangleOscillator → NoteGainNode → APUMixer.triangle → master → destination
```

The lowpass filter and note gain node are created once at `start()` and reused for all notes.

### Noise Channel — Unchanged

Noise hits are short (~15ms), infrequent, and toneless. The same-pitch phasing problem does not apply. Per-note `AudioBufferSourceNode` approach is correct for percussion and stays as-is.

---

## Loop Stutter Fix

Track `cycleAudioStart: number` — the absolute `AudioContext` timestamp when beat 0 of the current cycle began.

**First call:** `cycleAudioStart = ctx.currentTime + LOOK_AHEAD` (80ms)  
**Subsequent calls:** `cycleAudioStart += songDuration` (exact, no drift)

The `setTimeout` fires **200ms before** the next cycle's `cycleAudioStart`:

```
timeUntilNextSchedule = Math.max(50, (nextCycleAudioStart - ctx.currentTime - 0.2) * 1000)
```

This guarantees the scheduler always has at least 200ms to pre-fill the audio engine's buffer before the loop point, eliminating the gap.

Tempo multiplier changes (`setTempoMultiplier`) take effect at the next cycle boundary — same as before.

---

## ADSR Envelope

### Pulse channels

| Parameter | Value | Note |
|-----------|-------|------|
| Attack | `min(0.010, dur * 0.15)` | linear ramp to 1.0 |
| Decay | `min(0.060, dur * 0.30)` | exponential ramp to sustain |
| Sustain | 0.65 | held until release phase |
| Release | `min(0.040, dur * 0.30)` | exponential ramp to 0.001, then snap to 0 |

Attack and release are clamped to fractions of note duration to prevent out-of-order scheduling on fast notes (0.5-beat notes at BPM 160 = 187ms, 0.25-beat = 94ms).

Release uses `exponentialRampToValueAtTime(0.001, end)` followed by `setValueAtTime(0, end)` — exponential can't reach exactly 0, so we snap after.

Between notes, the channel gain sits at 0 (last release set it there). The next note's attack ramps it back up. This creates a natural brief silence between notes — including consecutive same-pitch notes — without any timing hack.

### Triangle channel

| Parameter | Value |
|-----------|-------|
| Attack | 2ms, linear |
| Sustain | 1.0 (full volume) |
| Release | 5ms, linear |

NES triangle has no volume envelope — it is either on (full) or silent. The 2ms/5ms ramps prevent hard clicks while preserving the characteristic abrupt triangle sound.

---

## Harshness Fixes

### 1. Fourier harmonics: 32 → 8

In `createPulseOsc` (`apu.ts`): change `const harmonics = 32` to `const harmonics = 9` (indices 0–8, yielding 8 harmonic partials). Fewer harmonics → rounder, less aliased pulse tone. 8 harmonics is still clearly "chip" in character.

### 2. Permanent lowpass filter per pulse channel

Each pulse channel's audio path includes a `BiquadFilterNode` of type `"lowpass"` at 4.5 kHz (`Q = 0.7`), created at `start()`. Rolls off harsh top-end without dulling the melody. Triangle channel gets no filter.

---

## `sequencer.ts` — Key Changes

**New state:**
```typescript
private cycleAudioStart = 0;
private pulse1Osc: OscillatorNode | null = null;
private pulse2Osc: OscillatorNode | null = null;
private triangleOsc: OscillatorNode | null = null;
private pulse1Gain: GainNode | null = null;
private pulse2Gain: GainNode | null = null;
private triangleGain: GainNode | null = null;
private pulse1Filter: BiquadFilterNode | null = null;
private pulse2Filter: BiquadFilterNode | null = null;
// Noise tracking arrays remain (activeNoiseSources, activeNoiseGains, activeNoiseFilters)
```

**`start()`:**
1. Call `stop()` (clean slate)
2. Set `cycleAudioStart = ctx.currentTime + LOOK_AHEAD`
3. Create and start 3 permanent oscillators + gain nodes + lowpass filters (pulse only)
4. **Initialize all permanent gain nodes to `gain = 0`** — ensures silence before the first note attack
5. Wire: `osc → gain → [filter →] channelMixerGain`
6. Call `scheduleOneCycle()`

**`stop()`:**
1. Clear timeout
2. Call `cancelScheduledValues(ctx.currentTime)` on all permanent gain and frequency AudioParams to flush queued automation
3. Stop and disconnect the 3 permanent oscillators + gains + filters
4. Stop all active noise sources (unchanged)
5. Reset `cycleAudioStart = 0`

**`scheduleTonalChannel(notes, osc, gainNode, startTime, beatDuration, isTriangle)`:**
- Iterates notes; skips `freq === 0` (silence — gain already at 0)
- `osc.frequency.setValueAtTime(note.freq, t)`
- Schedules ADSR on `gainNode.gain` using clamped parameters
- No new oscillator or gain nodes created

**`scheduleOneCycle()`:**
- Computes `startTime = cycleAudioStart`
- Schedules all 3 tonal channels + noise channel
- Computes `nextCycleAudioStart = cycleAudioStart + songDuration`
- Sets `cycleAudioStart = nextCycleAudioStart`
- Fires timeout at `max(50, (nextCycleAudioStart - ctx.currentTime - 0.2) * 1000)`

---

## `apu.ts` — Change

`createPulseOsc`: `const harmonics = 9` (was 32). No other changes.

---

## Testing

Existing tests in `audio.test.ts` cover: APU mixer topology, `createPulseOsc` uses PeriodicWave, sequencer start/stop, tempo multiplier, `setSong`, each song's `totalBeats` validity.

**New tests to add:**

| Test | What it verifies |
|------|-----------------|
| Sequencer start creates exactly 3 OscillatorNodes | Confirms continuous-osc architecture |
| Sequencer stop disconnects permanent oscillators | No zombie nodes |
| `scheduleOneCycle` sets `osc.frequency` values (not creates new oscs) | Core architecture invariant |
| Loop: second `scheduleOneCycle` call uses `cycleAudioStart + songDuration` as startTime | No loop gap |
| Clamped ADSR: on a 0.05-beat note, attack ≤ `dur * 0.15` and release ≤ `dur * 0.30` | Short-note scheduling correctness |
| `createPulseOsc` PeriodicWave has exactly 9 entries in imag array | Harmonic count |

All existing tests must continue to pass. `npm test` green.

---

## Files Changed

| File | Change |
|------|--------|
| `src/audio/sequencer.ts` | Full rewrite — continuous oscillators, cycle tracking, updated ADSR |
| `src/audio/apu.ts` | One-line change: harmonics 32 → 9 |
| `src/audio/audio.test.ts` | Add 6 new tests |
| Everything else | Unchanged |
