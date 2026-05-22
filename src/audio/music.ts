// Built-in sequencer: plays the Tetris theme (Korobeiniki) and other classic melodies
// using Web Audio API oscillators. No external MIDI files needed.

import { getAudioContext } from "./audio-ctx.ts";

let isPlaying = false;
let currentTimeout: number | null = null;
let currentSong = 0;

// Note frequencies (4th octave)
const NOTES: Record<string, number> = {
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  A4s: 466.16,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  C6: 1046.5,
  D6: 1174.66,
  E6: 1318.51,
};

// Korobeiniki (Tetris Theme A) — simplified melody
const MELODY_THEME_A: Array<{ note: string; duration: number }> = [
  // Part 1
  { note: "E5", duration: 1 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 1 },
  { note: "C5", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "A4", duration: 1 },
  { note: "A4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "E5", duration: 1 },
  { note: "D5", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "B4", duration: 1 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 1 },
  { note: "E5", duration: 1 },
  { note: "C5", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "A4", duration: 1 },
  { note: "R", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "F5", duration: 1 },
  { note: "A5", duration: 1 },
  { note: "G5", duration: 0.5 },
  { note: "F5", duration: 0.5 },
  { note: "E5", duration: 1 },
  { note: "C5", duration: 0.5 },
  { note: "E5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "B4", duration: 1 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 1 },
  { note: "E5", duration: 1 },
  { note: "C5", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "A4", duration: 1 },
  { note: "R", duration: 0.5 },
  // Part 2
  { note: "E5", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "G4", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "E5", duration: 0.5 },
  { note: "G5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "E5", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "R", duration: 0.5 },
];

const MELODY_THEME_A_ALT: Array<{ note: string; duration: number }> = [
  { note: "E5", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "G4", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "E5", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "G4", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "E5", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "D5", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "C5", duration: 0.5 },
  { note: "A4", duration: 0.5 },
  { note: "B4", duration: 0.5 },
  { note: "G4", duration: 0.5 },
];

const SONGS = [MELODY_THEME_A, MELODY_THEME_A_ALT];

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "square",
  volume: number = 0.1
): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

let noteIndex = 0;

function playNextNote(): void {
  if (!isPlaying) return;

  const song = SONGS[currentSong];
  const entry = song[noteIndex];
  const beatDuration = 0.4; // seconds per quarter beat (~150 BPM, close to original 144)

  if (entry.note !== "R") {
    const freq = NOTES[entry.note];
    if (freq) {
      playTone(freq, entry.duration * beatDuration * 0.8, "square", 0.08);
    }
  }

  noteIndex++;
  if (noteIndex >= song.length) {
    currentSong = (currentSong + 1) % SONGS.length;
    noteIndex = 0;
  }

  const nextDelay = entry.duration * beatDuration * 1000;
  currentTimeout = window.setTimeout(playNextNote, nextDelay);
}

export function initAudio(): void {
  getAudioContext();
}

export function playMusic(): void {
  if (isPlaying) return;
  isPlaying = true;
  noteIndex = 0;
  currentSong = 0;
  playNextNote();
}

export function stopMusic(): void {
  isPlaying = false;
  if (currentTimeout !== null) {
    clearTimeout(currentTimeout);
    currentTimeout = null;
  }
  noteIndex = 0;
}

export function toggleMusic(): boolean {
  if (isPlaying) {
    stopMusic();
  } else {
    playMusic();
  }
  return isPlaying;
}

export function isMusicPlaying(): boolean {
  return isPlaying;
}
