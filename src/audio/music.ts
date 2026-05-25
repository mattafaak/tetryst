// NES-style multi-voice chiptune sequencer.
// Lead (triangle), bass (triangle), percussion (noise).
// All scheduling via AudioContext.currentTime — no setTimeout drift.

import { getAudioContext } from "./audio-ctx.ts";

let isPlaying = false;
let activeOscs: OscillatorNode[] = [];
let activeGains: GainNode[] = [];
let activeSources: AudioBufferSourceNode[] = [];
let songTimeout: number | null = null;
let currentSongIndex = 0;

// Note frequencies (4th–6th octave, equal temperament)
const NOTES: Record<string, number> = {
  E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
  A4s: 466.16, B4: 493.88, C5: 523.25, D5: 587.33,
  E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
  B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51,
};

// Bass root mapping: melody note root → bass frequency (one octave down)
const BASS_ROOTS: Record<string, number> = {
  E: 82.41, G: 82.41, B: 82.41,   // E2 (dominant / mediant in A minor)
  A: 110.0, C: 110.0, F: 110.0,    // A2 (tonic / subdominant)
  D: 73.42,                          // D2 (subdominant)
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
const BPM = 140;
const BEAT_DURATION = 60 / BPM; // ~0.429s per beat

// Resolve a note name to a frequency, supporting bass transposition
function freqOf(note: string): number | null {
  return NOTES[note] ?? null;
}

// Derive bass frequency from a melody note's root letter
function bassFreqOf(note: string): number | null {
  if (note === "R") return null;
  const root = note[0];
  return BASS_ROOTS[root] ?? 110.0;
}

// Pre-scheduled note event
interface NoteEvent {
  startBeat: number;
  durBeats: number;
  note: string;
  bassFreq: number | null;
}

// Build an event list from a melody array, accumulating beat offsets
function buildSchedule(melody: Array<{ note: string; duration: number }>): NoteEvent[] {
  const events: NoteEvent[] = [];
  let beat = 0;
  for (const entry of melody) {
    events.push({
      startBeat: beat,
      note: entry.note,
      durBeats: entry.duration,
      bassFreq: bassFreqOf(entry.note),
    });
    beat += entry.duration;
  }
  return events;
}

// ── Voice synthesis ────────────────────────────────────────────────────

function playOscillator(
  freq: number,
  duration: number,
  startTime: number,
  type: OscillatorType,
  volume: number,
): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // ADSR envelope — short attack, natural decay, quick release
    const a = 0.004;
    const d = 0.04;
    const s = volume * 0.65;
    const r = 0.025;
    const end = startTime + duration;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + a);
    gain.gain.linearRampToValueAtTime(s, startTime + a + d);
    gain.gain.setValueAtTime(s, end - r);
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(end + 0.01);

    activeOscs.push(osc);
    activeGains.push(gain);
  } catch {
    // Audio context not available
  }
}

function playNoise(
  startTime: number,
  duration: number,
  volume: number,
  highpassFreq: number,
): void {
  try {
    const ctx = getAudioContext();
    const bufLen = Math.max(1, Math.ceil(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(highpassFreq, startTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(startTime);
    source.stop(startTime + duration + 0.01);

    activeSources.push(source);
    activeGains.push(gain);
  } catch {
    // Audio context not available
  }
}

// ── Scheduling ─────────────────────────────────────────────────────────

function scheduleSong(events: NoteEvent[], baseTime: number): void {
  const gap = 0.82; // sustain fraction (small gap between notes for articulation)

  for (const evt of events) {
    const t = baseTime + evt.startBeat * BEAT_DURATION;
    const dur = evt.durBeats * BEAT_DURATION * gap;

    if (evt.note === "R") continue;

    const leadFreq = freqOf(evt.note);
    if (leadFreq) {
      // Lead voice — triangle wave (warm, smooth)
      playOscillator(leadFreq, dur, t, "triangle", 0.10);
    }

    // Bass voice — triangle wave, held slightly longer than lead
    if (evt.bassFreq) {
      const bassDur = evt.durBeats * BEAT_DURATION * 0.95;
      playOscillator(evt.bassFreq, bassDur, t, "triangle", 0.06);
    }
  }

  // Percussion — hi-hat on off-beats (quaver off-beats: 1.5, 3.5, 5.5, ...)
  const totalBeats = events.length > 0
    ? events[events.length - 1].startBeat + events[events.length - 1].durBeats
    : 0;
  for (let b = 1.5; b < totalBeats; b += 2) {
    playNoise(baseTime + b * BEAT_DURATION, 0.035, 0.035, 5000);
  }
}

function playSongCycle(): void {
  if (!isPlaying) return;

  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const lookAhead = 0.08; // small buffer for reliable scheduling
  const song = SONGS[currentSongIndex];
  const events = buildSchedule(song);

  scheduleSong(events, now + lookAhead);

  // Schedule next song after this one finishes
  const totalBeats = events.reduce((max, e) => Math.max(max, e.startBeat + e.durBeats), 0);
  const songMs = (totalBeats * BEAT_DURATION + 0.1) * 1000;

  currentSongIndex = (currentSongIndex + 1) % SONGS.length;
  songTimeout = window.setTimeout(playSongCycle, songMs);
}

export function playMusic(): void {
  if (isPlaying) return;
  isPlaying = true;
  currentSongIndex = 0;
  playSongCycle();
}

function cleanup(): void {
  for (const n of activeOscs) try { n.stop(); } catch { /* already stopped */ }
  for (const n of activeSources) try { n.stop(); } catch { /* already stopped */ }
  for (const g of activeGains) try { g.disconnect(); } catch { /* already done */ }
  activeOscs = [];
  activeSources = [];
  activeGains = [];
  if (songTimeout !== null) {
    clearTimeout(songTimeout);
    songTimeout = null;
  }
}

export function stopMusic(): void {
  isPlaying = false;
  cleanup();
}
