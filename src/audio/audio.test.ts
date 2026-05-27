import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAudioContext, resetAudioContext } from "./audio-ctx.ts";
import { playSFX } from "./sfx.ts";
import { playMusic, stopMusic, freqOf, bassFreqOf, buildSchedule, BPM, BEAT_DURATION, MELODY_DATA } from "./music.ts";
import { createPulseOsc, createAPUMixer, type Song } from "./apu.ts";
import { Sequencer } from "./sequencer.ts";
import { SONG_TYPE_A } from "./songs/type-a.ts";
import { SONG_TYPE_B } from "./songs/type-b.ts";

let mockGain: Record<string, unknown>;
/** Shared array of oscillators created by playSFX, reset per test. */
let sfxOscs: Array<Record<string, unknown>>;
let mockAudioCtx: Record<string, unknown>;

function setupAudioCtx(state = "running") {
  sfxOscs = [];
  mockGain = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  };
  const mockSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  mockAudioCtx = {
    currentTime: 0,
    state,
    destination: {},
    sampleRate: 44100,
    createOscillator: vi.fn(() => {
      const o = {
        type: "",
        frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(() => mockGain),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      sfxOscs.push(o);
      return o;
    }),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    })),
    createBuffer: vi.fn(() => ({ getChannelData: vi.fn(() => new Float32Array(441)) })),
    createBufferSource: vi.fn(() => mockSource),
    createBiquadFilter: vi.fn(() => ({
      type: "",
      frequency: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
    resume: vi.fn(() => Promise.resolve()),
  };

  vi.stubGlobal("window", { setTimeout: vi.fn(), clearTimeout: vi.fn() });
  vi.stubGlobal("AudioContext", vi.fn(function () { return mockAudioCtx; }));
}

beforeEach(() => {
  setupAudioCtx();
});

afterEach(() => {
  stopMusic();
  vi.unstubAllGlobals();
});

describe("audio-ctx", () => {
  it("returns an AudioContext instance", () => {
    const ctx = getAudioContext();
    expect(ctx).toBeDefined();
    expect(ctx!.state).toBe("running");
  });

  it("returns the same instance on repeated calls", () => {
    const a = getAudioContext();
    const b = getAudioContext();
    expect(a).toBe(b);
  });

  it("returns null when AudioContext cannot be constructed", async () => {
    vi.resetModules();
    vi.stubGlobal("AudioContext", vi.fn(function () {
      throw new DOMException("AudioContext not supported");
    }));
    const { getAudioContext: getCtx } = await import("./audio-ctx.ts");
    expect(getCtx()).toBeNull();
  });
});

describe("sfx", () => {
  it("playSFX can be called with all effect types without throwing", () => {
    const types = ["move", "rotate", "lock", "clear", "tetris", "tspin", "hold", "levelup", "gameover"] as const;
    for (const t of types) {
      expect(() => playSFX(t)).not.toThrow();
    }
  });

  it("playSFX degrades gracefully when AudioContext is unavailable", async () => {
    vi.resetModules();
    vi.stubGlobal("AudioContext", vi.fn(function () {
      throw new DOMException("AudioContext not supported");
    }));
    const { playSFX: sfx } = await import("./sfx.ts");
    const types = ["move", "rotate", "lock", "clear", "tetris", "tspin", "hold", "levelup", "gameover"] as const;
    for (const t of types) {
      expect(() => sfx(t)).not.toThrow();
    }
  });
});

describe("music", () => {
  it("playMusic and stopMusic can be called without throwing", () => {
    expect(() => playMusic()).not.toThrow();
    expect(() => stopMusic()).not.toThrow();
  });

  it("stopMusic is idempotent", () => {
    playMusic();
    stopMusic();
    expect(() => stopMusic()).not.toThrow();
  });

  it("playMusic is idempotent", () => {
    playMusic();
    playMusic();
    stopMusic();
  });

  it("playMusic/stopMusic cycle does not throw", () => {
    playMusic();
    stopMusic();
    expect(() => stopMusic()).not.toThrow();
    playMusic();
    stopMusic();
  });
});

describe("audio behavioral — SFX parameter verification", () => {
  let oscs: Array<Record<string, unknown>>;
  let gains: Array<Record<string, unknown>>;

  beforeEach(() => {
    oscs = [];
    gains = [];
    resetAudioContext();
    const mockSource = {
      buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    };
    vi.stubGlobal("AudioContext", vi.fn(function () {
      return {
        currentTime: 0,
        state: "running",
        destination: {},
        sampleRate: 44100,
        createOscillator: vi.fn(() => {
          const o = {
            type: "",
            frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
            connect: vi.fn(() => gains[gains.length - 1]),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null as (() => void) | null,
          };
          oscs.push(o);
          return o;
        }),
        createGain: vi.fn(() => {
          const g = {
            connect: vi.fn(),
            disconnect: vi.fn(),
            gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          };
          gains.push(g);
          return g;
        }),
        createBufferSource: vi.fn(() => mockSource),
        createBiquadFilter: vi.fn(() => ({
          type: "", frequency: { value: 0, setValueAtTime: vi.fn() }, connect: vi.fn(),
        })),
        resume: vi.fn(() => Promise.resolve()),
      };
    }));
  });

  afterEach(() => {
    stopMusic();
    vi.unstubAllGlobals();
  });

  it('"move" SFX: triangle wave, 200Hz, 0.06s, volume 0.12', () => {
    playSFX("move");
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("triangle");
    expect((oscs[0].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(200, 0);
    expect(oscs[0].start).toHaveBeenCalledWith(0);
    expect(oscs[0].stop).toHaveBeenCalledWith(0.06);
    expect((gains[0].gain as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(0.12, 0);
  });

  it('"rotate" SFX: sine wave, 300Hz, 0.08s, volume 0.15', () => {
    playSFX("rotate");
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("sine");
    expect((oscs[0].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(300, 0);
    expect(oscs[0].stop).toHaveBeenCalledWith(0.08);
    expect((gains[0].gain as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(0.15, 0);
  });

  it('"lock" SFX: triangle wave, 100Hz, 0.12s, volume 0.2', () => {
    playSFX("lock");
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("triangle");
    expect((oscs[0].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(100, 0);
    expect(oscs[0].stop).toHaveBeenCalledWith(0.12);
    expect((gains[0].gain as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(0.2, 0);
  });

  it('"clear" SFX: sweep from 200Hz to 800Hz, triangle, 0.25s', () => {
    playSFX("clear");
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("triangle");
    expect((oscs[0].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(200, 0);
    expect((oscs[0].frequency as Record<string, unknown>).linearRampToValueAtTime).toHaveBeenCalledWith(800, 0.25);
    expect(oscs[0].stop).toHaveBeenCalledWith(0.25);
  });

  it('"tetris" SFX: chord of 4 frequencies [262, 330, 392, 523], each sine, 0.4s', () => {
    playSFX("tetris");
    expect(oscs).toHaveLength(4);
    for (const osc of oscs) {
      expect(osc.type).toBe("triangle");
    }
    // Collect all frequencies set across all 4 oscillators
    const freqs: number[] = [];
    for (const osc of oscs) {
      const calls = (osc.frequency as Record<string, unknown>).setValueAtTime as ReturnType<typeof vi.fn>;
      for (const call of calls.mock.calls) {
        if (typeof call[0] === "number") freqs.push(call[0]);
      }
    }
    expect(freqs.sort()).toEqual([262, 330, 392, 523]);
  });

  it('"tspin" SFX: triangle wave, 400Hz, 0.15s, volume 0.2', () => {
    playSFX("tspin");
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("triangle");
    expect((oscs[0].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(400, 0);
    expect(oscs[0].stop).toHaveBeenCalledWith(0.15);
    expect((gains[0].gain as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(0.2, 0);
  });

  it('"hold" SFX: triangle wave, 250Hz, 0.06s, volume 0.12', () => {
    playSFX("hold");
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("triangle");
    expect((oscs[0].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(250, 0);
    expect(oscs[0].stop).toHaveBeenCalledWith(0.06);
    expect((gains[0].gain as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(0.12, 0);
  });

  it('"levelup" SFX: 3 ascending tones (400→500→600Hz), triangle', () => {
    playSFX("levelup");
    expect(oscs).toHaveLength(3);
    for (const osc of oscs) {
      expect(osc.type).toBe("triangle");
    }
    expect((oscs[0].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(400, 0);
    expect(oscs[0].stop).toHaveBeenCalledWith(0.08);
    expect((oscs[1].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(500, 0.1);
    expect(oscs[1].stop).toHaveBeenCalledWith(0.18);
    expect((oscs[2].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(600, 0.2);
    expect(oscs[2].stop).toHaveBeenCalledWith(0.32);
  });

  it('"gameover" SFX: sweep 400→100Hz, triangle, 0.7s, volume 0.25', () => {
    playSFX("gameover");
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("triangle");
    expect((oscs[0].frequency as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(400, 0);
    expect((oscs[0].frequency as Record<string, unknown>).linearRampToValueAtTime).toHaveBeenCalledWith(100, 0.7);
    expect(oscs[0].stop).toHaveBeenCalledWith(0.7);
    expect((gains[0].gain as Record<string, unknown>).setValueAtTime).toHaveBeenCalledWith(0.25, 0);
  });

  it("osc.onended calls gain.disconnect()", () => {
    playSFX("move");
    expect(oscs).toHaveLength(1);
    expect(gains).toHaveLength(1);
    expect(gains[0].disconnect).not.toHaveBeenCalled();

    // Fire the onended handler that playTone assigned
    if (oscs[0].onended) {
      (oscs[0].onended as () => void)();
    }
    expect(gains[0].disconnect).toHaveBeenCalled();
  });

  it("sfx with decay applies exponentialRampToValueAtTime", () => {
    playSFX("lock");
    expect(gains).toHaveLength(1);
    expect((gains[0].gain as Record<string, unknown>).exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 0.12);
  });
});

describe("music behavioral — scheduling", () => {
  it("BPM is 144", () => {
    expect(BPM).toBe(144);
  });

  it("BEAT_DURATION is 60 / 144", () => {
    expect(BEAT_DURATION).toBeCloseTo(0.4167, 3);
  });

  it("MELODY_DATA has 176 entries", () => {
    expect(MELODY_DATA).toHaveLength(176);
  });

  it("freqOf resolves common notes correctly", () => {
    expect(freqOf("A4")).toBeCloseTo(440.0, 1);
    expect(freqOf("C5")).toBeCloseTo(523.25, 1);
    expect(freqOf("E5")).toBeCloseTo(659.25, 1);
    expect(freqOf("Gs4")).toBeCloseTo(415.30, 1);
  });

  it("freqOf returns null for unknown notes", () => {
    expect(freqOf("X9")).toBeNull();
    expect(freqOf("")).toBeNull();
  });

  it("bassFreqOf resolves known roots", () => {
    expect(bassFreqOf("E5")).toBeCloseTo(82.41, 1);
    expect(bassFreqOf("A4")).toBeCloseTo(110.0, 1);
    expect(bassFreqOf("D5")).toBeCloseTo(73.42, 1);
  });

  it("bassFreqOf returns null for rests, defaults to 110.0 for unknown", () => {
    expect(bassFreqOf("R")).toBeNull();
    expect(bassFreqOf("X5")).toBeCloseTo(110.0, 1);
  });

  it("buildSchedule produces 176 events with correct structure", () => {
    const schedule = buildSchedule(MELODY_DATA);
    expect(schedule).toHaveLength(176);
    for (const event of schedule) {
      expect(event).toHaveProperty("startBeat");
      expect(event).toHaveProperty("note");
      expect(event).toHaveProperty("durBeats");
      expect(typeof event.startBeat).toBe("number");
      expect(event.startBeat).toBeGreaterThanOrEqual(0);
      expect(event.durBeats).toBeGreaterThan(0);
    }
  });

  it("buildSchedule events are in chronological order", () => {
    const schedule = buildSchedule(MELODY_DATA);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].startBeat).toBeGreaterThanOrEqual(schedule[i - 1].startBeat);
    }
  });

  it("buildSchedule first beat starts at 0", () => {
    const schedule = buildSchedule(MELODY_DATA);
    expect(schedule[0].startBeat).toBe(0);
  });

  it("buildSchedule returns empty array for empty melody", () => {
    expect(buildSchedule([])).toEqual([]);
  });

  it("buildSchedule produces correct beat offsets and durations", () => {
    const melody = [
      { note: "A4", duration: 1 },
      { note: "B4", duration: 0.5 },
      { note: "C5", duration: 1.5 },
    ];
    const events = buildSchedule(melody);
    expect(events).toHaveLength(3);
    expect(events[0].startBeat).toBe(0);
    expect(events[0].durBeats).toBe(1);
    expect(events[0].note).toBe("A4");
    expect(events[1].startBeat).toBe(1);
    expect(events[1].durBeats).toBe(0.5);
    expect(events[1].note).toBe("B4");
    expect(events[2].startBeat).toBe(1.5);
    expect(events[2].durBeats).toBe(1.5);
    expect(events[2].note).toBe("C5");
  });

  it("buildSchedule bass carries forward on off-beats", () => {
    const melody = [
      { note: "A4", duration: 1 },
      { note: "B4", duration: 0.5 },
      { note: "C5", duration: 0.5 },
    ];
    const events = buildSchedule(melody);
    expect(events[0].bassFreq).toBe(110.0);
    expect(events[1].bassFreq).toBe(82.41);
    expect(events[2].startBeat).toBe(1.5);
    expect(events[2].bassFreq).toBe(82.41);
  });

  it("buildSchedule last event endBeat does not exceed total duration", () => {
    const events = buildSchedule(MELODY_DATA);
    const totalBeats = events.reduce((max, e) => Math.max(max, e.startBeat + e.durBeats), 0);
    expect(events[events.length - 1].startBeat + events[events.length - 1].durBeats).toBeLessThanOrEqual(totalBeats);
  });

  it("total melody duration is ≤ 176 beats", () => {
    const total = MELODY_DATA.reduce((sum, e) => sum + e.duration, 0);
    expect(total).toBeLessThanOrEqual(176);
  });
});

describe("apu — createPulseOsc", () => {
  function makeApuCtx(captureImag?: { ref: Float32Array | null }) {
    const mockOsc = {
      type: "" as string,
      frequency: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      setPeriodicWave: vi.fn(),
    };
    const apuCtx = {
      createPeriodicWave: vi.fn((real: Float32Array, imag: Float32Array) => {
        if (captureImag) captureImag.ref = imag;
        return { _real: real, _imag: imag };
      }),
      createOscillator: vi.fn(() => mockOsc),
    };
    return { apuCtx, mockOsc };
  }

  it("sets PeriodicWave on oscillator — not a built-in oscillator type", () => {
    const { apuCtx, mockOsc } = makeApuCtx();

    const osc = createPulseOsc(apuCtx as unknown as AudioContext, 0.25);

    expect(apuCtx.createPeriodicWave).toHaveBeenCalled();
    expect(mockOsc.setPeriodicWave).toHaveBeenCalled();
    // When PeriodicWave is set, type is "custom" — never one of the 4 built-in strings
    expect(osc.type).not.toBe("square");
    expect(osc.type).not.toBe("sine");
    expect(osc.type).not.toBe("triangle");
    expect(osc.type).not.toBe("sawtooth");
  });

  it("Fourier coeff imag[1] ≈ 2/π for duty=0.25 (NES 25% pulse character)", () => {
    const captured = { ref: null as Float32Array | null };
    const { apuCtx } = makeApuCtx(captured);

    createPulseOsc(apuCtx as unknown as AudioContext, 0.25);

    expect(captured.ref).not.toBeNull();
    expect(captured.ref![0]).toBe(0); // no DC offset
    expect(captured.ref![1]).toBeCloseTo(2 / Math.PI, 4); // ≈ 0.6366
    expect(captured.ref![2]).toBeCloseTo(0, 4);            // even harmonic ≈ 0
  });

  it("imag[1] for duty=0.125 is sin(π/4) scaled — thinner pulse than 25%", () => {
    const captured = { ref: null as Float32Array | null };
    const { apuCtx } = makeApuCtx(captured);

    createPulseOsc(apuCtx as unknown as AudioContext, 0.125);

    expect(captured.ref).not.toBeNull();
    const expected = (2 / Math.PI) * Math.sin(2 * Math.PI * 0.125); // ≈ 0.450
    expect(captured.ref![1]).toBeCloseTo(expected, 4);
  });
});

describe("apu — createAPUMixer", () => {
  function makeMixerCtx() {
    const gains: Array<{ connect: ReturnType<typeof vi.fn>; gain: { value: number } }> = [];
    const destination = {};
    const ctx = {
      destination,
      createGain: vi.fn(() => {
        const g = { connect: vi.fn(), gain: { value: 0 } };
        gains.push(g);
        return g;
      }),
    };
    return { ctx, gains, destination };
  }

  it("creates exactly 5 GainNodes", () => {
    const { ctx, gains } = makeMixerCtx();
    createAPUMixer(ctx as unknown as AudioContext);
    expect(gains).toHaveLength(5);
  });

  it("master GainNode connects to ctx.destination", () => {
    const { ctx, destination } = makeMixerCtx();
    const mixer = createAPUMixer(ctx as unknown as AudioContext);
    expect(mixer.master.connect).toHaveBeenCalledWith(destination);
  });

  it("channel GainNodes each connect to master", () => {
    const { ctx } = makeMixerCtx();
    const mixer = createAPUMixer(ctx as unknown as AudioContext);
    for (const ch of [mixer.pulse1, mixer.pulse2, mixer.triangle, mixer.noise]) {
      expect(ch.connect).toHaveBeenCalledWith(mixer.master);
    }
  });

  it("gain values match spec: pulse1=0.25, pulse2=0.20, triangle=0.18, noise=0.14, master=0.70", () => {
    const { ctx } = makeMixerCtx();
    const mixer = createAPUMixer(ctx as unknown as AudioContext);
    expect(mixer.pulse1.gain.value).toBe(0.25);
    expect(mixer.pulse2.gain.value).toBe(0.20);
    expect(mixer.triangle.gain.value).toBe(0.18);
    expect(mixer.noise.gain.value).toBe(0.14);
    expect(mixer.master.gain.value).toBe(0.70);
  });
});

describe("Sequencer — start/stop", () => {
  function makeSeqCtx() {
    const oscs: Array<Record<string, unknown>> = [];
    const gains: Array<Record<string, unknown>> = [];
    const sources: Array<Record<string, unknown>> = [];

    const makeGain = () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    });

    const ctx = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createOscillator: vi.fn(() => {
        const o = {
          type: "",
          frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          setPeriodicWave: vi.fn(),
        };
        oscs.push(o);
        return o;
      }),
      createGain: vi.fn(() => {
        const g = makeGain();
        gains.push(g);
        return g;
      }),
      createBuffer: vi.fn(() => ({ getChannelData: vi.fn(() => new Float32Array(44)) })),
      createBufferSource: vi.fn(() => {
        const s = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
        sources.push(s);
        return s;
      }),
      createBiquadFilter: vi.fn(() => ({
        type: "" as string,
        frequency: { value: 0, setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createPeriodicWave: vi.fn(() => ({})),
    };

    const mixer = {
      pulse1: makeGain(),
      pulse2: makeGain(),
      triangle: makeGain(),
      noise: makeGain(),
      master: makeGain(),
    };

    return { ctx, oscs, gains, sources, mixer };
  }

  const ONE_NOTE_SONG: Song = {
    title: "Test",
    bpm: 120,
    pulse1: [{ beat: 0, dur: 1, freq: 440 }],
    pulse2: [],
    triangle: [],
    noise: [],
    totalBeats: 1,
  };

  const NOISE_SONG: Song = {
    title: "Noise test",
    bpm: 120,
    pulse1: [],
    pulse2: [],
    triangle: [],
    noise: [{ beat: 0, dur: 0.5, vol: 0.5, hp: 6000 }],
    totalBeats: 1,
  };

  beforeEach(() => {
    vi.stubGlobal("window", { setTimeout: vi.fn(() => 42), clearTimeout: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("start() creates an oscillator for each tonal note", () => {
    const { ctx, oscs, mixer } = makeSeqCtx();
    const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

    seq.start(ONE_NOTE_SONG, ctx as unknown as AudioContext);

    expect(oscs.length).toBeGreaterThanOrEqual(1);
  });

  it("start() schedules a setTimeout for the next loop cycle", () => {
    const { ctx, mixer } = makeSeqCtx();
    const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

    seq.start(ONE_NOTE_SONG, ctx as unknown as AudioContext);

    expect(window.setTimeout).toHaveBeenCalled();
  });

  it("stop() calls stop() on all active oscillators", () => {
    const { ctx, oscs, mixer } = makeSeqCtx();
    const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

    seq.start(ONE_NOTE_SONG, ctx as unknown as AudioContext);
    seq.stop();

    for (const osc of oscs) {
      expect(osc.stop).toHaveBeenCalled();
    }
  });

  it("stop() calls clearTimeout to cancel the pending loop", () => {
    const { ctx, mixer } = makeSeqCtx();
    const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

    seq.start(ONE_NOTE_SONG, ctx as unknown as AudioContext);
    seq.stop();

    expect(window.clearTimeout).toHaveBeenCalledWith(42);
  });

  it("stop() is idempotent — calling twice does not throw", () => {
    const { ctx, mixer } = makeSeqCtx();
    const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

    seq.start(ONE_NOTE_SONG, ctx as unknown as AudioContext);
    expect(() => { seq.stop(); seq.stop(); }).not.toThrow();
  });

  it("noise notes create a BufferSource and BiquadFilter highpass", () => {
    const { ctx, sources, mixer } = makeSeqCtx();
    const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

    seq.start(NOISE_SONG, ctx as unknown as AudioContext);

    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(ctx.createBiquadFilter).toHaveBeenCalled();
  });

  it("setTempoMultiplier(2.0) halves the effective beat duration for the next cycle", () => {
    const callbacks: Array<() => void> = [];
    const delays: number[] = [];
    vi.stubGlobal("window", {
      setTimeout: vi.fn((cb: () => void, delay: number) => {
        callbacks.push(cb);
        delays.push(delay);
        return callbacks.length;
      }),
      clearTimeout: vi.fn(),
    });

    const { ctx, mixer } = makeSeqCtx();
    const seq = new Sequencer(mixer as unknown as ReturnType<typeof createAPUMixer>);

    // BPM=120, totalBeats=4: beatDur=0.5s → delay=(4×0.5+0.1)×1000=2100ms
    const TEMPO_SONG: Song = {
      title: "Tempo test",
      bpm: 120,
      pulse1: [],
      pulse2: [],
      triangle: [],
      noise: [],
      totalBeats: 4,
    };

    seq.start(TEMPO_SONG, ctx as unknown as AudioContext);
    expect(delays[0]).toBeCloseTo(2100, -2); // base tempo

    seq.setTempoMultiplier(2.0);
    // Trigger next cycle via the captured callback
    callbacks[0]();

    // With 2× multiplier: beatDur=0.25s → delay=(4×0.25+0.1)×1000=1100ms
    expect(delays[1]).toBeCloseTo(1100, -2);
  });
});

describe("song data — Type A", () => {
  function computeMaxBeatEnd(song: Song) {
    let max = 0;
    for (const n of [...song.pulse1, ...song.pulse2, ...song.triangle]) {
      max = Math.max(max, n.beat + n.dur);
    }
    for (const n of song.noise) {
      max = Math.max(max, n.beat + n.dur);
    }
    return max;
  }

  it("totalBeats equals max(note.beat + note.dur) across all channels", () => {
    expect(SONG_TYPE_A.totalBeats).toBeCloseTo(computeMaxBeatEnd(SONG_TYPE_A), 5);
  });

  it("bpm is 144", () => {
    expect(SONG_TYPE_A.bpm).toBe(144);
  });

  it("pulse1 has notes (lead melody)", () => {
    expect(SONG_TYPE_A.pulse1.length).toBeGreaterThan(0);
  });

  it("triangle has notes (bass line)", () => {
    expect(SONG_TYPE_A.triangle.length).toBeGreaterThan(0);
  });

  it("noise has notes (hi-hat percussion)", () => {
    expect(SONG_TYPE_A.noise.length).toBeGreaterThan(0);
  });

  it("all pulse1 notes have valid non-zero frequencies", () => {
    for (const n of SONG_TYPE_A.pulse1) {
      expect(n.freq).toBeGreaterThan(0);
    }
  });
});

describe("song data — Type B", () => {
  it("totalBeats equals max(note.beat + note.dur) across all channels", () => {
    let max = 0;
    for (const n of [...SONG_TYPE_B.pulse1, ...SONG_TYPE_B.pulse2, ...SONG_TYPE_B.triangle]) {
      max = Math.max(max, n.beat + n.dur);
    }
    for (const n of SONG_TYPE_B.noise) {
      max = Math.max(max, n.beat + n.dur);
    }
    expect(SONG_TYPE_B.totalBeats).toBeCloseTo(max, 5);
  });

  it("bpm is in waltz range (104–120)", () => {
    expect(SONG_TYPE_B.bpm).toBeGreaterThanOrEqual(104);
    expect(SONG_TYPE_B.bpm).toBeLessThanOrEqual(120);
  });

  it("pulse1 has notes and all frequencies are positive", () => {
    expect(SONG_TYPE_B.pulse1.length).toBeGreaterThan(0);
    for (const n of SONG_TYPE_B.pulse1) {
      expect(n.freq).toBeGreaterThan(0);
    }
  });
});
