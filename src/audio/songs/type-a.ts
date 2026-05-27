import { type ChannelNote, type NoiseNote, type Song } from "../apu.ts";

// All frequencies used in Type A — A natural/harmonic minor
const FR: Record<string, number> = {
  D2: 73.42, E2: 82.41, A2: 110.0,
  E4: 329.63, F4: 349.23, G4: 392.00,
  Gs4: 415.30, Ab4: 415.30, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
  G5: 783.99, Gs5: 830.61, Ab5: 830.61, A5: 880.0, B5: 987.77,
};

// Parallel-thirds harmony a diatonic 3rd below in A minor
const THIRD_BELOW: Record<string, number> = {
  E5: FR.C5, D5: FR.B4, C5: FR.A4, B4: FR.G4,
  A4: FR.F4, Gs4: FR.E4, Ab4: FR.E4,
  F5: FR.D5, G5: FR.E5, Gs5: FR.E5, Ab5: FR.E5,
  A5: FR.F5, B5: FR.Gs5,
};

// Bass root from melody-note first letter (applied on downbeats only)
function bassFor(note: string): number | null {
  const map: Record<string, number> = {
    E: FR.E2, G: FR.E2, B: FR.E2,
    A: FR.A2, C: FR.A2, F: FR.A2,
    D: FR.D2,
  };
  return map[note[0]] ?? null;
}

// Korobeiniki — 176 notes at BPM 144, A minor (same data as music.ts MELODY)
const MELODY: Array<[string, number]> = [
  ["E5", 1], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1], ["C5", 0.5], ["B4", 0.5],
  ["A4", 1], ["A4", 0.5], ["C5", 0.5],
  ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1.5], ["C5", 0.5],
  ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1],
  ["A4", 0.5], ["A4", 0.5], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1.5], ["F5", 0.5],
  ["A5", 1], ["G5", 0.5], ["F5", 0.5],
  ["E5", 1.5], ["C5", 0.5],
  ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1],
  ["A4", 1],
  // Second A section
  ["E5", 1], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1], ["C5", 0.5], ["B4", 0.5],
  ["A4", 1], ["A4", 0.5], ["C5", 0.5],
  ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1.5], ["C5", 0.5],
  ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1],
  ["A4", 0.5], ["A4", 0.5], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1.5], ["F5", 0.5],
  ["A5", 1], ["G5", 0.5], ["F5", 0.5],
  ["E5", 1.5], ["C5", 0.5],
  ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1],
  ["A4", 1],
  // B section — slow, held notes
  ["E5", 2], ["C5", 2],
  ["D5", 2], ["B4", 2],
  ["C5", 2], ["A4", 2],
  ["Ab4", 2], ["B4", 1],
  ["E5", 2], ["C5", 2],
  ["D5", 2], ["B4", 2],
  ["C5", 1], ["E5", 1],
  ["A5", 2], ["Ab5", 2],
  // Third A section
  ["E5", 1], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1], ["C5", 0.5], ["B4", 0.5],
  ["A4", 1], ["A4", 0.5], ["C5", 0.5],
  ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1.5], ["C5", 0.5],
  ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1],
  ["A4", 0.5], ["A4", 0.5], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1.5], ["F5", 0.5],
  ["A5", 1], ["G5", 0.5], ["F5", 0.5],
  ["E5", 1.5], ["C5", 0.5],
  ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1],
  ["A4", 1],
  // Fourth A section
  ["E5", 1], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1], ["C5", 0.5], ["B4", 0.5],
  ["A4", 1], ["A4", 0.5], ["C5", 0.5],
  ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1.5], ["C5", 0.5],
  ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1],
  ["A4", 0.5], ["A4", 0.5], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1.5], ["F5", 0.5],
  ["A5", 1], ["G5", 0.5], ["F5", 0.5],
  ["E5", 1.5], ["C5", 0.5],
  ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1], ["B4", 0.5], ["C5", 0.5],
  ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1],
  ["A4", 1],
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
  const triangle: ChannelNote[] = [];

  let beat = 0;
  let currentBass: number | null = null;

  for (const [note, dur] of MELODY) {
    const freq = FR[note] ?? 0;
    const harmFreq = THIRD_BELOW[note] ?? 0;
    const onDownbeat = Math.abs(beat - Math.round(beat)) < 0.001;

    if (onDownbeat) {
      const bf = bassFor(note);
      if (bf !== null) currentBass = bf;
    }

    pulse1.push({ beat, dur, freq });
    if (harmFreq > 0) {
      pulse2.push({ beat, dur, freq: harmFreq });
    }
    if (currentBass !== null) {
      triangle.push({ beat, dur, freq: currentBass });
    }

    beat += dur;
  }

  // Hi-hat on off-beats (1.5, 3.5, 5.5 …) for the full song duration
  const songEnd = beat;
  const noise: NoiseNote[] = [];
  for (let b = 1.5; b < songEnd; b += 2) {
    noise.push({ beat: b, dur: 0.04, vol: 0.25, hp: 6000 });
  }

  // totalBeats = max(note.beat + note.dur) across all channels
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

export const SONG_TYPE_A: Song = {
  title: "Type A",
  bpm: 144,
  pulse1,
  pulse2,
  triangle,
  noise,
  totalBeats,
};
