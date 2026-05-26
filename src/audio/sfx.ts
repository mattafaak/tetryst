type SFXName =
  | "move"
  | "rotate"
  | "lock"
  | "clear"
  | "tetris"
  | "tspin"
  | "hold"
  | "levelup"
  | "gameover";

import { getAudioContext } from "./audio-ctx.ts";

function playTone(
  frequency: number,
  duration: number,
  startTime: number,
  type: OscillatorType = "sine",
  volume: number = 0.3,
  decay: boolean = true
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);

    if (decay) {
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    } else {
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.setValueAtTime(volume, startTime + duration);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.onended = () => { try { gain.disconnect(); } catch { /* already done */ } };

    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {
    // Audio not available — fail silently
  }
}

function playSweep(
  startFreq: number,
  endFreq: number,
  duration: number,
  startTime: number,
  type: OscillatorType = "sawtooth",
  volume: number = 0.3
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.linearRampToValueAtTime(endFreq, startTime + duration);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.onended = () => { try { gain.disconnect(); } catch { /* already done */ } };

    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch {
    // Audio not available — fail silently
  }
}

function playChord(
  frequencies: number[],
  duration: number,
  startTime: number,
  type: OscillatorType = "sine",
  volume: number = 0.2
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    for (const freq of frequencies) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.onended = () => { try { gain.disconnect(); } catch { /* already done */ } };

      osc.start(startTime);
      osc.stop(startTime + duration);
    }
  } catch {
    // Audio not available — fail silently
  }
}

export function playSFX(name: SFXName): void {
  const ctx = getAudioContext();
  if (!ctx) return; // Audio unavailable — degrade gracefully
  const now = ctx.currentTime;

  switch (name) {
    case "move":
      playTone(200, 0.06, now, "triangle", 0.12);
      break;
    case "rotate":
      playTone(300, 0.08, now, "sine", 0.15);
      break;
    case "lock":
      playTone(100, 0.12, now, "triangle", 0.2);
      break;
    case "clear":
      playSweep(200, 800, 0.25, now, "triangle", 0.15);
      break;
    case "tetris":
      playChord([262, 330, 392, 523], 0.4, now, "triangle", 0.15);
      break;
    case "tspin":
      playTone(400, 0.15, now, "triangle", 0.2);
      break;
    case "hold":
      playTone(250, 0.06, now, "triangle", 0.12);
      break;
    case "levelup":
      // Three ascending tones — all scheduled via AudioContext time
      playTone(400, 0.08, now, "triangle", 0.15);
      playTone(500, 0.08, now + 0.1, "triangle", 0.15);
      playTone(600, 0.12, now + 0.2, "triangle", 0.2);
      break;
    case "gameover":
      playSweep(400, 100, 0.7, now, "triangle", 0.25);
      break;
  }
}
