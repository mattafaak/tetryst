import { type ChannelNote, type NoiseNote, type Song } from "../apu.ts";

// Frequencies for Type B — G major, waltz character
const FR: Record<string, number> = {
  // Bass range
  A2: 110.00, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00,
  // Mid range (melody + harmony)
  E4: 329.63, Fs4: 369.99, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, Fs5: 739.99,
  G5: 783.99, A5: 880.00,
};

// Parallel-thirds harmony in G major
const THIRD_BELOW: Record<string, number> = {
  G4: FR.E4, A4: FR.Fs4, B4: FR.G4,
  C5: FR.A4, D5: FR.B4, E5: FR.C5, F5: FR.D5, Fs5: FR.D5,
  G5: FR.E5, A5: FR.Fs5,
};

// Petzold Menuet in G (BWV Anh. 114) — public domain, 3/4 waltz, BPM 108
// 16 measures × 3 beats = 48 beats per loop
const MELODY: Array<[string, number]> = [
  // Part I — A section (measures 1–8)
  ["G4", 1], ["C5", 1], ["D5", 0.5], ["E5", 0.5],   // M1: tonic run up
  ["F5", 0.5], ["G5", 0.5], ["A5", 2],               // M2: subdom, peak
  ["G5", 1], ["D5", 1], ["E5", 0.5], ["F5", 0.5],   // M3: descent/rise
  ["G5", 3],                                          // M4: sustained G
  ["G5", 1], ["C5", 1], ["D5", 0.5], ["E5", 0.5],   // M5: repeat M1
  ["F5", 0.5], ["G5", 0.5], ["A5", 1.5], ["G5", 0.5], // M6: variant
  ["G5", 1], ["F5", 1], ["E5", 1],                  // M7: descending line
  ["D5", 3],                                          // M8: dominant rest

  // Part II — B section (measures 9–16)
  ["B4", 0.5], ["C5", 0.5], ["D5", 1], ["E5", 1],   // M9: ascending 4ths
  ["Fs5", 2], ["G5", 1],                             // M10: F#5 → G5
  ["E5", 1], ["D5", 1], ["C5", 1],                  // M11: stepwise descent
  ["D5", 3],                                          // M12: dominant hold
  ["G4", 1], ["B4", 1], ["G4", 1],                  // M13: tonic arpeggio
  ["A4", 1], ["C5", 1], ["A4", 1],                  // M14: subdom arpeggio
  ["D5", 2], ["C5", 1],                             // M15: dom→tonic motion
  ["G4", 3],                                          // M16: final tonic
];

// Per-measure bass root (beat 0 of each 3-beat measure)
// Indices 0–15 → measures 1–16
const BASS_BY_MEASURE: string[] = [
  "G3", "C3", "G3", "G3",   // M1–4: G, C, G, G
  "G3", "C3", "E3", "D3",   // M5–8: G, C, Em, D
  "G3", "D3", "C3", "D3",   // M9–12: G, D, C, D
  "G3", "D3", "G3", "G3",   // M13–16: G, D, G, G
];

function buildChannels(): {
  pulse1: ChannelNote[];
  pulse2: ChannelNote[];
  triangle: ChannelNote[];
  noise: NoiseNote[];
  totalBeats: number;
} {
  const pulse1: ChannelNote[] = [];
  const pulse2: ChannelNote[] = [];

  let beat = 0;
  for (const [note, dur] of MELODY) {
    const freq = FR[note] ?? 0;
    const harmFreq = THIRD_BELOW[note] ?? 0;
    pulse1.push({ beat, dur, freq });
    if (harmFreq > 0) pulse2.push({ beat, dur, freq: harmFreq });
    beat += dur;
  }

  // Bass: one quarter-note per measure at beat 0, sustained 1.5 beats (waltz feel)
  const triangle: ChannelNote[] = BASS_BY_MEASURE.map((note, i) => ({
    beat: i * 3,
    dur: 1.5,
    freq: FR[note] ?? 0,
  }));

  // Waltz percussion: hi-hat on beats 2 and 3 of each measure
  const noise: NoiseNote[] = [];
  for (let m = 0; m < 16; m++) {
    const base = m * 3;
    noise.push({ beat: base + 1, dur: 0.04, vol: 0.20, hp: 7000 });
    noise.push({ beat: base + 2, dur: 0.04, vol: 0.15, hp: 7000 });
  }

  let totalBeats = 0;
  for (const n of [...pulse1, ...pulse2, ...triangle]) {
    totalBeats = Math.max(totalBeats, n.beat + n.dur);
  }
  for (const n of noise) {
    totalBeats = Math.max(totalBeats, n.beat + n.dur);
  }

  return { pulse1, pulse2, triangle, noise, totalBeats };
}

const { pulse1, pulse2, triangle, noise, totalBeats } = buildChannels();

export const SONG_TYPE_B: Song = {
  title: "Type B",
  bpm: 108,
  pulse1,
  pulse2,
  triangle,
  noise,
  totalBeats,
};
