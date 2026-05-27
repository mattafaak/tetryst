import { getAudioContext } from "./audio-ctx.ts";
import { createAPUMixer, type APUMixer, type Song } from "./apu.ts";
import { Sequencer } from "./sequencer.ts";
import { SONG_TYPE_A } from "./songs/type-a.ts";
import { SONG_TYPE_B } from "./songs/type-b.ts";
import { SONG_TYPE_C } from "./songs/type-c.ts";

const SONGS: Song[] = [SONG_TYPE_A, SONG_TYPE_B, SONG_TYPE_C];

let mixer: APUMixer | null = null;
let seq: Sequencer | null = null;
let isPlaying = false;
let currentSongIndex: 0 | 1 | 2 = 0;
let tempoMultiplier = 1.0;

/** Select song index (0 = Type A, 1 = Type B, 2 = Type C) */
export function setSong(index: 0 | 1 | 2): void {
  currentSongIndex = index;
}

/** Tempo multiplier: 1.0 = base BPM, 1.3 = 30% faster */
export function setTempoMultiplier(factor: number): void {
  tempoMultiplier = factor;
  if (seq) seq.setTempoMultiplier(factor);
}

export function playMusic(): void {
  if (isPlaying) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (!mixer) mixer = createAPUMixer(ctx);
    if (!seq) seq = new Sequencer(mixer);
    seq.setTempoMultiplier(tempoMultiplier);
    isPlaying = true;
    seq.start(SONGS[currentSongIndex], ctx);
  } catch {
    isPlaying = false;
  }
}

export function stopMusic(): void {
  isPlaying = false;
  if (seq) {
    seq.stop();
    seq = null;
    mixer = null;
  }
}
