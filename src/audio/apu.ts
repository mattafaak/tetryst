/** A single note for a tonal channel (pulse or triangle). */
export interface ChannelNote {
  beat: number;   // start beat (0-indexed, fractional allowed)
  dur: number;    // duration in beats (sustain portion, typically 0.85–0.95 of full)
  freq: number;   // frequency Hz — 0 = rest (silence)
}

/** A single hit on the noise channel. */
export interface NoiseNote {
  beat: number;
  dur: number;    // duration in beats
  vol: number;    // relative volume 0.0–1.0
  hp: number;     // highpass filter Hz (5000–8000 for hi-hat character)
}

/** Complete four-channel song. */
export interface Song {
  title: string;
  bpm: number;             // base tempo
  pulse1: ChannelNote[];   // lead melody — 25% duty cycle pulse
  pulse2: ChannelNote[];   // harmony — 50% duty cycle pulse
  triangle: ChannelNote[]; // bass line — triangle oscillator
  noise: NoiseNote[];      // percussion
  totalBeats: number;      // precomputed: max(beat + dur) across all channels
}

/**
 * Returns an OscillatorNode configured as a pulse wave.
 * duty 0.25/0.125/0.75 → PeriodicWave via Fourier series (NES-authentic).
 * duty 0.5 → built-in "square" type (sin(πn)=0 for all n, so formula degenerates).
 */
export function createPulseOsc(
  ctx: AudioContext,
  duty: 0.125 | 0.25 | 0.5 | 0.75 = 0.25,
): OscillatorNode {
  const osc = ctx.createOscillator();
  if (duty === 0.5) {
    osc.type = "square";
    return osc;
  }
  const harmonics = 9;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  // real[0] = 0 — no DC component
  for (let n = 1; n < harmonics; n++) {
    imag[n] = (2 / (Math.PI * n)) * Math.sin(2 * Math.PI * duty * n);
  }
  osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
  return osc;
}

export interface APUMixer {
  pulse1: GainNode;    // lead channel
  pulse2: GainNode;    // harmony channel
  triangle: GainNode;  // bass channel
  noise: GainNode;     // percussion channel
  master: GainNode;    // overall volume
}

/**
 * Build an APU-style mixer connected to ctx.destination.
 * Volume balance approximates NES hardware output levels.
 */
export function createAPUMixer(ctx: AudioContext): APUMixer {
  const pulse1 = ctx.createGain();
  const pulse2 = ctx.createGain();
  const triangle = ctx.createGain();
  const noise = ctx.createGain();
  const master = ctx.createGain();

  pulse1.gain.value = 0.25;
  pulse2.gain.value = 0.20;
  triangle.gain.value = 0.18;
  noise.gain.value = 0.14;
  master.gain.value = 0.70;

  pulse1.connect(master);
  pulse2.connect(master);
  triangle.connect(master);
  noise.connect(master);
  master.connect(ctx.destination);

  return { pulse1, pulse2, triangle, noise, master };
}
