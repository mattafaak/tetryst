# Audio Sequencer Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-note oscillator model with 3 permanent oscillators (one per tonal channel), fix the 180ms loop stutter, and reduce pulse wave harshness.

**Architecture:** One `OscillatorNode` per tonal channel (pulse1, pulse2, triangle) runs for the life of `start()`→`stop()`. Note transitions are scheduled via `setValueAtTime` on `osc.frequency` and `gainNode.gain` (ADSR). Loop stutter is fixed by tracking `cycleAudioStart` and using `songDuration - 0.2s` for the timeout. Noise channel stays per-note (unchanged).

**Tech Stack:** TypeScript, Web Audio API, Vitest

---

## Files Changed

| File | Change |
|------|--------|
| `src/audio/apu.ts` | One-line: harmonics 32 → 9 |
| `src/audio/sequencer.ts` | Full rewrite — permanent oscillators, cycle tracking, new ADSR |
| `src/audio/audio.test.ts` | Add 3 new tests, update 1 existing test's expected values |

---

### Task 1: `apu.ts` — reduce Fourier harmonics from 32 to 9

**Files:**
- Modify: `src/audio/apu.ts`
- Test: `src/audio/audio.test.ts`

- [ ] **Step 1: Add failing test for harmonic count**

In `src/audio/audio.test.ts`, inside the `describe("apu — createPulseOsc", ...)` block (after the existing 3 tests), add:

```typescript
it("PeriodicWave imag array has exactly 9 entries (8 harmonics)", () => {
  const captured = { ref: null as Float32Array | null };
  const { apuCtx } = makeApuCtx(captured);
  createPulseOsc(apuCtx as unknown as AudioContext, 0.25);
  expect(captured.ref!.length).toBe(9);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A4 "8 harmonics"
```

Expected: FAIL — `Expected: 9 / Received: 32`

- [ ] **Step 3: Change harmonics constant in `apu.ts`**

In `src/audio/apu.ts`, line 41, change:
```typescript
const harmonics = 32;
```
to:
```typescript
const harmonics = 9;
```

- [ ] **Step 4: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all pass, no failures.

- [ ] **Step 5: Commit**

```bash
git add src/audio/apu.ts src/audio/audio.test.ts
git commit -m "feat: reduce pulse wave harmonics 32→9 for less harsh timbre"
```

---

### Task 2: `audio.test.ts` — add 3 failing tests and update 1 existing test

**Files:**
- Modify: `src/audio/audio.test.ts`

These tests must be written BEFORE the implementation so they can fail first, verifying they actually test the new behavior.

- [ ] **Step 1: Add two new tests to the `Sequencer — start/stop` describe block**

After the existing `NOISE_SONG` constant (after line ~561) and before the `beforeEach`, add a new song constant:

```typescript
const THREE_CHANNEL_SONG: Song = {
  title: "Three channel test",
  bpm: 120,
  pulse1: [{ beat: 0, dur: 1, freq: 440 }],
  pulse2: [{ beat: 0, dur: 1, freq: 330 }],
  triangle: [{ beat: 0, dur: 1, freq: 110 }],
  noise: [],
  totalBeats: 1,
};
```

Then add these two tests at the END of the `describe("Sequencer — start/stop", ...)` block (after the last existing test):

```typescript
it("start() creates exactly 3 OscillatorNodes — one per tonal channel regardless of note count", () => {
  const { ctx, oscs, mixer } = makeSeqCtx();
  const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

  seq.start(THREE_CHANNEL_SONG, ctx as unknown as AudioContext);

  expect(oscs).toHaveLength(3);
});

it("second cycle schedules pulse1 first note at cycleAudioStart + songDuration", () => {
  const callbacks: Array<() => void> = [];
  vi.stubGlobal("window", {
    setTimeout: vi.fn((cb: () => void) => { callbacks.push(cb); return callbacks.length; }),
    clearTimeout: vi.fn(),
  });

  const { ctx, oscs, mixer } = makeSeqCtx();
  const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

  const LOOP_SONG: Song = {
    title: "Loop test",
    bpm: 120, // beatDuration = 0.5s
    pulse1: [{ beat: 0, dur: 1, freq: 440 }],
    pulse2: [],
    triangle: [],
    noise: [],
    totalBeats: 1, // songDuration = 0.5s
  };

  seq.start(LOOP_SONG, ctx as unknown as AudioContext);

  // pulse1 osc is the first oscillator created
  const pulse1Osc = oscs[0];
  const freqParam = pulse1Osc.frequency as { setValueAtTime: ReturnType<typeof vi.fn> };

  // First cycle: note scheduled at startTime = 0 + 0.08 = 0.08
  const firstCalls = freqParam.setValueAtTime.mock.calls;
  const firstScheduledTime = firstCalls.find((c: unknown[]) => c[0] === 440)?.[1] as number;
  expect(firstScheduledTime).toBeCloseTo(0.08, 2);

  // Trigger second cycle
  callbacks[0]();

  // Second cycle: note scheduled at cycleAudioStart + songDuration = 0.08 + 0.5 = 0.58
  const allCalls = freqParam.setValueAtTime.mock.calls;
  const secondScheduledTime = allCalls.filter((c: unknown[]) => c[0] === 440)[1]?.[1] as number;
  expect(secondScheduledTime).toBeCloseTo(0.58, 2);
});
```

- [ ] **Step 2: Update the `setTempoMultiplier` test expected delay values**

In the `describe("Sequencer — start/stop", ...)` block, find the `"setTempoMultiplier(2.0) halves the effective beat duration for the next cycle"` test and replace its assertion lines and comment:

Change:
```typescript
    seq.start(TEMPO_SONG, ctx as unknown as AudioContext);
    expect(delays[0]).toBeCloseTo(2100, -2); // base tempo
```
to:
```typescript
    seq.start(TEMPO_SONG, ctx as unknown as AudioContext);
    // BPM=120, totalBeats=4: songDuration=2.0s → timeout=(2.0-0.2)×1000=1800ms
    expect(delays[0]).toBeCloseTo(1800, -2); // base tempo
```

Change:
```typescript
    // With 2× multiplier: beatDur=0.25s → delay=(4×0.25+0.1)×1000=1100ms
    expect(delays[1]).toBeCloseTo(1100, -2);
```
to:
```typescript
    // With 2× multiplier: beatDur=0.25s → timeout=(1.0-0.2)×1000=800ms
    expect(delays[1]).toBeCloseTo(800, -2);
```

- [ ] **Step 3: Run tests to verify the 3 new/updated tests fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|✗|×" | head -20
```

Expected: 3 failures:
- `"start() creates exactly 3 OscillatorNodes"` — currently creates per-note oscs (count > 3)
- `"second cycle schedules pulse1 first note at cycleAudioStart + songDuration"` — timing mismatch
- `"setTempoMultiplier(2.0)"` — delay is 2100, not 1800

- [ ] **Step 4: Commit test changes**

```bash
git add src/audio/audio.test.ts
git commit -m "test: add continuous-osc + loop timing tests (red)"
```

---

### Task 3: `sequencer.ts` — full rewrite

**Files:**
- Modify: `src/audio/sequencer.ts`

- [ ] **Step 1: Replace the contents of `sequencer.ts` entirely**

```typescript
import { type APUMixer, type ChannelNote, type NoiseNote, type Song, createPulseOsc } from "./apu.ts";

const LOOK_AHEAD = 0.08; // 80ms

export class Sequencer {
  private mixer: APUMixer;
  private song: Song | null = null;
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private tempoMultiplier = 1.0;
  private songTimeout: number | null = null;
  private cycleAudioStart = 0;

  private pulse1Osc: OscillatorNode | null = null;
  private pulse2Osc: OscillatorNode | null = null;
  private triangleOsc: OscillatorNode | null = null;
  private pulse1Gain: GainNode | null = null;
  private pulse2Gain: GainNode | null = null;
  private triangleGain: GainNode | null = null;
  private pulse1Filter: BiquadFilterNode | null = null;
  private pulse2Filter: BiquadFilterNode | null = null;

  private activeNoiseSources: AudioBufferSourceNode[] = [];
  private activeNoiseGains: GainNode[] = [];
  private activeNoiseFilters: BiquadFilterNode[] = [];

  constructor(mixer: APUMixer) {
    this.mixer = mixer;
  }

  start(song: Song, ctx: AudioContext): void {
    this.stop();
    this.song = song;
    this.ctx = ctx;
    this.isPlaying = true;
    this.cycleAudioStart = ctx.currentTime + LOOK_AHEAD;

    this.pulse1Osc = createPulseOsc(ctx, 0.25);
    this.pulse2Osc = createPulseOsc(ctx, 0.5);
    this.triangleOsc = ctx.createOscillator();
    this.triangleOsc.type = "triangle";

    this.pulse1Gain = ctx.createGain();
    this.pulse2Gain = ctx.createGain();
    this.triangleGain = ctx.createGain();
    this.pulse1Gain.gain.value = 0;
    this.pulse2Gain.gain.value = 0;
    this.triangleGain.gain.value = 0;

    this.pulse1Filter = ctx.createBiquadFilter();
    this.pulse1Filter.type = "lowpass";
    this.pulse1Filter.frequency.value = 4500;

    this.pulse2Filter = ctx.createBiquadFilter();
    this.pulse2Filter.type = "lowpass";
    this.pulse2Filter.frequency.value = 4500;

    this.pulse1Osc.connect(this.pulse1Gain);
    this.pulse1Gain.connect(this.pulse1Filter);
    this.pulse1Filter.connect(this.mixer.pulse1);

    this.pulse2Osc.connect(this.pulse2Gain);
    this.pulse2Gain.connect(this.pulse2Filter);
    this.pulse2Filter.connect(this.mixer.pulse2);

    this.triangleOsc.connect(this.triangleGain);
    this.triangleGain.connect(this.mixer.triangle);

    this.pulse1Osc.start();
    this.pulse2Osc.start();
    this.triangleOsc.start();

    this.scheduleOneCycle();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.songTimeout !== null) {
      window.clearTimeout(this.songTimeout);
      this.songTimeout = null;
    }

    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.pulse1Gain?.gain.cancelScheduledValues?.(now);
      this.pulse2Gain?.gain.cancelScheduledValues?.(now);
      this.triangleGain?.gain.cancelScheduledValues?.(now);
      this.pulse1Osc?.frequency.cancelScheduledValues?.(now);
      this.pulse2Osc?.frequency.cancelScheduledValues?.(now);
      this.triangleOsc?.frequency.cancelScheduledValues?.(now);
    }

    for (const osc of [this.pulse1Osc, this.pulse2Osc, this.triangleOsc]) {
      if (osc) try { osc.stop(); } catch { /* already stopped */ }
    }
    for (const node of [this.pulse1Gain, this.pulse2Gain, this.triangleGain, this.pulse1Filter, this.pulse2Filter]) {
      if (node) try { node.disconnect(); } catch { /* already disconnected */ }
    }

    this.pulse1Osc = null;
    this.pulse2Osc = null;
    this.triangleOsc = null;
    this.pulse1Gain = null;
    this.pulse2Gain = null;
    this.triangleGain = null;
    this.pulse1Filter = null;
    this.pulse2Filter = null;

    for (const s of this.activeNoiseSources) try { s.stop(); } catch { /* done */ }
    for (const f of this.activeNoiseFilters) try { f.disconnect(); } catch { /* done */ }
    for (const g of this.activeNoiseGains) try { g.disconnect(); } catch { /* done */ }
    this.activeNoiseSources = [];
    this.activeNoiseFilters = [];
    this.activeNoiseGains = [];

    this.cycleAudioStart = 0;
  }

  setTempoMultiplier(factor: number): void {
    this.tempoMultiplier = factor;
  }

  private scheduleOneCycle(): void {
    if (!this.isPlaying || !this.song || !this.ctx) return;

    for (const f of this.activeNoiseFilters) try { f.disconnect(); } catch { /* done */ }
    for (const g of this.activeNoiseGains) try { g.disconnect(); } catch { /* done */ }
    this.activeNoiseSources = [];
    this.activeNoiseFilters = [];
    this.activeNoiseGains = [];

    const ctx = this.ctx;
    const song = this.song;
    const beatDuration = (60 / song.bpm) / this.tempoMultiplier;
    const startTime = this.cycleAudioStart;

    this.scheduleTonalNotes(song.pulse1, this.pulse1Osc!, this.pulse1Gain!, startTime, beatDuration, false);
    this.scheduleTonalNotes(song.pulse2, this.pulse2Osc!, this.pulse2Gain!, startTime, beatDuration, false);
    this.scheduleTonalNotes(song.triangle, this.triangleOsc!, this.triangleGain!, startTime, beatDuration, true);
    this.scheduleNoiseChannel(song.noise, ctx, this.mixer.noise, startTime, beatDuration);

    const songDuration = song.totalBeats * beatDuration;
    this.cycleAudioStart += songDuration;

    this.songTimeout = window.setTimeout(
      () => this.scheduleOneCycle(),
      Math.max(50, (songDuration - 0.2) * 1000),
    );
  }

  private scheduleTonalNotes(
    notes: ChannelNote[],
    osc: OscillatorNode,
    gainNode: GainNode,
    startTime: number,
    beatDuration: number,
    isTriangle: boolean,
  ): void {
    for (const note of notes) {
      if (note.freq === 0) continue;

      const t = startTime + note.beat * beatDuration;
      const dur = note.dur * beatDuration;
      const end = t + dur;

      osc.frequency.setValueAtTime(note.freq, t);

      if (isTriangle) {
        const a = Math.min(0.002, dur * 0.10);
        const r = Math.min(0.005, dur * 0.15);
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(1.0, t + a);
        gainNode.gain.setValueAtTime(1.0, end - r);
        gainNode.gain.linearRampToValueAtTime(0, end);
      } else {
        const a = Math.min(0.010, dur * 0.15);
        const d = Math.min(0.060, dur * 0.30);
        const s = 0.65;
        const r = Math.min(0.040, dur * 0.30);
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(1.0, t + a);
        gainNode.gain.exponentialRampToValueAtTime(s, t + a + d);
        gainNode.gain.setValueAtTime(s, end - r);
        gainNode.gain.exponentialRampToValueAtTime(0.001, end);
        gainNode.gain.setValueAtTime(0, end);
      }
    }
  }

  private scheduleNoiseChannel(
    notes: NoiseNote[],
    ctx: AudioContext,
    channelGain: GainNode,
    startTime: number,
    beatDuration: number,
  ): void {
    for (const note of notes) {
      const t = startTime + note.beat * beatDuration;
      const dur = note.dur * beatDuration;
      const bufLen = Math.max(1, Math.ceil(ctx.sampleRate * dur));

      const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(note.vol, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(note.hp, t);

      source.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(channelGain);

      source.start(t);
      source.stop(t + dur);

      this.activeNoiseSources.push(source);
      this.activeNoiseFilters.push(filter);
      this.activeNoiseGains.push(noiseGain);
    }
  }
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test 2>&1 | tail -15
```

Expected: all tests pass, including the 3 previously failing tests from Task 2. No regressions.

If any test fails, check the failure message. Common issues:
- `"start() creates an oscillator for each tonal note"` now expects `>= 1` — with 3 permanent oscs this is satisfied (3 >= 1). Should pass.
- `"stop() calls stop() on all active oscillators"` — iterates `oscs` (length 3), checks each `.stop` was called. Should pass.
- `"stop() calls clearTimeout to cancel the pending loop"` — `clearTimeout` called with the timeout handle. Should pass.

- [ ] **Step 3: Verify build still passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: success, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/audio/sequencer.ts
git commit -m "feat: continuous-osc sequencer — fix loop stutter, polyphony, harshness"
```

---

### Task 4: Verify end-to-end behavior

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 2: Run build with size check**

```bash
npm run build 2>&1 | tail -5
```

Expected: success. Gzip size should remain ≤ 70 kB (the sequencer rewrite has no size impact — fewer nodes means slightly smaller runtime footprint).

- [ ] **Step 3: Add Phase 29 to Plans.md**

Open `Plans.md` and append the following after the Phase 28 table, before the `## Archive` section:

```markdown
## Phase 29: Audio sequencer overhaul — continuous oscillators, loop stutter, harshness [tdd:required]

| Task | Content | DoD | Depends | Status |
|------|---------|-----|---------|--------|
| 29.1 | **Reduce Fourier harmonics 32 → 9** — `createPulseOsc` in `apu.ts` | Harmonic count test passes; `npm test` green | - | cc:完了 |
| 29.2 | **Sequencer: continuous oscillators + loop stutter fix** — rewrite `sequencer.ts`; 3 permanent oscs; `cycleAudioStart` tracking; `(songDuration - 0.2) * 1000` timeout | 3 new tests pass; `npm test` green; no 180ms gap on loop | 29.1 | cc:完了 |
```
