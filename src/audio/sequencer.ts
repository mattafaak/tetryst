import { APUMixer, ChannelNote, NoiseNote, Song, createPulseOsc } from "./apu.ts";

const LOOK_AHEAD = 0.08; // 80ms

export class Sequencer {
  private mixer: APUMixer;
  private song: Song | null = null;
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private tempoMultiplier = 1.0;
  private songTimeout: number | null = null;
  private activeOscs: OscillatorNode[] = [];
  private activeGains: GainNode[] = [];
  private activeSources: AudioBufferSourceNode[] = [];
  private activeFilters: BiquadFilterNode[] = [];

  constructor(mixer: APUMixer) {
    this.mixer = mixer;
  }

  start(song: Song, ctx: AudioContext): void {
    this.stop();
    this.song = song;
    this.ctx = ctx;
    this.isPlaying = true;
    this.scheduleOneCycle();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.songTimeout !== null) {
      window.clearTimeout(this.songTimeout);
      this.songTimeout = null;
    }
    for (const n of this.activeOscs) try { n.stop(); } catch { /* already stopped */ }
    for (const n of this.activeSources) try { n.stop(); } catch { /* already stopped */ }
    for (const f of this.activeFilters) try { f.disconnect(); } catch { /* already done */ }
    for (const g of this.activeGains) try { g.disconnect(); } catch { /* already done */ }
    this.activeOscs = [];
    this.activeSources = [];
    this.activeFilters = [];
    this.activeGains = [];
  }

  setTempoMultiplier(factor: number): void {
    this.tempoMultiplier = factor;
  }

  private scheduleOneCycle(): void {
    if (!this.isPlaying || !this.song || !this.ctx) return;

    // Purge previous cycle's naturally-finished nodes from the audio graph
    for (const f of this.activeFilters) try { f.disconnect(); } catch { /* already done */ }
    for (const g of this.activeGains) try { g.disconnect(); } catch { /* already done */ }
    this.activeOscs = [];
    this.activeSources = [];
    this.activeFilters = [];
    this.activeGains = [];

    const ctx = this.ctx;
    const song = this.song;
    const now = ctx.currentTime;
    const beatDuration = (60 / song.bpm) / this.tempoMultiplier;
    const startTime = now + LOOK_AHEAD;

    this.scheduleTonalChannel(song.pulse1, ctx, this.mixer.pulse1, startTime, beatDuration, "pulse1");
    this.scheduleTonalChannel(song.pulse2, ctx, this.mixer.pulse2, startTime, beatDuration, "pulse2");
    this.scheduleTonalChannel(song.triangle, ctx, this.mixer.triangle, startTime, beatDuration, "triangle");
    this.scheduleNoiseChannel(song.noise, ctx, this.mixer.noise, startTime, beatDuration);

    const songDuration = song.totalBeats * beatDuration;
    this.songTimeout = window.setTimeout(
      () => this.scheduleOneCycle(),
      (songDuration + 0.1) * 1000,
    );
  }

  private scheduleTonalChannel(
    notes: ChannelNote[],
    ctx: AudioContext,
    channelGain: GainNode,
    startTime: number,
    beatDuration: number,
    channel: "pulse1" | "pulse2" | "triangle",
  ): void {
    for (const note of notes) {
      if (note.freq === 0) continue;

      const t = startTime + note.beat * beatDuration;
      const dur = note.dur * beatDuration;

      let osc: OscillatorNode;
      if (channel === "pulse1") {
        osc = createPulseOsc(ctx, 0.25);
      } else if (channel === "pulse2") {
        osc = createPulseOsc(ctx, 0.5);
      } else {
        osc = ctx.createOscillator();
        osc.type = "triangle";
      }

      osc.frequency.setValueAtTime(note.freq, t);

      const noteGain = ctx.createGain();
      const a = 0.006; // attack 6ms
      const d = 0.050; // decay 50ms
      const s = 0.70;  // sustain level
      const r = 0.040; // release 40ms
      const end = t + dur;

      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(1.0, t + a);
      noteGain.gain.linearRampToValueAtTime(s, t + a + d);
      noteGain.gain.setValueAtTime(s, end - r);
      noteGain.gain.linearRampToValueAtTime(0, end);

      osc.connect(noteGain);
      noteGain.connect(channelGain);

      osc.start(t);
      osc.stop(end + 0.01);

      this.activeOscs.push(osc);
      this.activeGains.push(noteGain);
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
      source.stop(t + dur + 0.01);

      this.activeSources.push(source);
      this.activeFilters.push(filter);
      this.activeGains.push(noiseGain);
    }
  }
}
