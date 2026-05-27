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
