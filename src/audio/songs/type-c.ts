import { type ChannelNote, type NoiseNote, type Song } from "../apu.ts";

// Frequencies for Type C — A minor, fast folk dance
const FR: Record<string, number> = {
  // Bass
  D2: 73.42, E2: 82.41, A2: 110.0, C3: 130.81,
  // Melody range
  E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
  A5: 880.00,
};

// Parallel thirds in A minor
const THIRD_BELOW: Record<string, number> = {
  A4: FR.F4, B4: FR.G4, C5: FR.A4, D5: FR.B4,
  E5: FR.C5, F5: FR.D5, G5: FR.E5, A5: FR.F5,
  E4: 261.63,  // C4 (below E4 — use 261.63 Hz)
  F4: FR.D5 / 2,  // D4 = 146.83 Hz
  G4: FR.E4,
};

// Troika — Russian folk dance (public domain), 2/4 time, BPM 160
// 32 beats (16 measures × 2 beats) per loop
const MELODY: Array<[string, number]> = [
  // Part A — ascending run, energetic
  ["A4", 0.5], ["C5", 0.5], ["E5", 0.5], ["C5", 0.5],   // M1
  ["A4", 0.5], ["B4", 0.5], ["C5", 0.5], ["D5", 0.5],   // M2
  ["E5", 0.5], ["E5", 0.5], ["E5", 0.5], ["D5", 0.5],   // M3: repeated E (gallop)
  ["C5", 1],   ["A4", 1],                                 // M4: resolution
  ["A4", 0.5], ["C5", 0.5], ["E5", 0.5], ["C5", 0.5],   // M5: repeat M1
  ["E5", 0.5], ["F5", 0.5], ["G5", 0.5], ["A5", 0.5],   // M6: higher run
  ["G5", 0.5], ["F5", 0.5], ["E5", 0.5], ["D5", 0.5],   // M7: descending
  ["E5", 2],                                              // M8: dominant hold

  // Part B — stepwise descent, driving
  ["E5", 0.5], ["D5", 0.5], ["C5", 0.5], ["B4", 0.5],   // M9: descending steps
  ["A4", 0.5], ["G4", 0.5], ["F4", 0.5], ["E4", 0.5],   // M10: low descent
  ["E5", 0.5], ["E5", 0.5], ["D5", 0.5], ["D5", 0.5],   // M11: repeated pairs
  ["C5", 0.5], ["C5", 0.5], ["B4", 0.5], ["A4", 0.5],   // M12: stepwise down
  ["A4", 0.5], ["C5", 0.5], ["E5", 0.5], ["G5", 0.5],   // M13: Am arpeggio up
  ["A5", 0.5], ["G5", 0.5], ["F5", 0.5], ["E5", 0.5],   // M14: descent from peak
  ["D5", 0.5], ["C5", 0.5], ["B4", 0.5], ["A4", 0.5],   // M15: final descent
  ["A4", 2],                                              // M16: tonic home
];

// Bass per measure — one note per 2-beat measure
const BASS_BY_MEASURE: string[] = [
  "A2", "D2", "E2", "C3",   // M1–4
  "A2", "A2", "E2", "E2",   // M5–8
  "E2", "A2", "E2", "A2",   // M9–12
  "A2", "A2", "D2", "A2",   // M13–16
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

  // Bass: one quarter-note on beat 0 of each 2-beat measure
  const triangle: ChannelNote[] = BASS_BY_MEASURE.map((note, i) => ({
    beat: i * 2,
    dur: 1,
    freq: FR[note] ?? 0,
  }));

  // Percussion: driving off-beat hi-hat every 0.5 beats starting at 0.5
  const noise: NoiseNote[] = [];
  for (let b = 0.5; b < 32; b += 1) {
    noise.push({ beat: b, dur: 0.04, vol: 0.22, hp: 7500 });
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

export const SONG_TYPE_C: Song = {
  title: "Type C",
  bpm: 160,
  pulse1,
  pulse2,
  triangle,
  noise,
  totalBeats,
};
