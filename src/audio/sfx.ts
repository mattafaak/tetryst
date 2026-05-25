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
  type: OscillatorType = "sine",
  volume: number = 0.3,
  decay: boolean = true
): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    if (decay) {
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration
      );
    } else {
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime + duration);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — fail silently
  }
}

function playSweep(
  startFreq: number,
  endFreq: number,
  duration: number,
  type: OscillatorType = "sawtooth",
  volume: number = 0.3
): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(
      endFreq,
      ctx.currentTime + duration
    );

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — fail silently
  }
}

function playChord(
  frequencies: number[],
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.2
): void {
  try {
    const ctx = getAudioContext();
    for (const freq of frequencies) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    }
  } catch {
    // Audio not available — fail silently
  }
}

export function playSFX(name: SFXName): void {
  switch (name) {
    case "move":
      playTone(200, 0.08, "square", 0.15);
      break;
    case "rotate":
      playTone(300, 0.1, "sine", 0.2);
      break;
    case "lock":
      playTone(100, 0.15, "sine", 0.3);
      break;
    case "clear":
      playSweep(200, 800, 0.3, "sawtooth", 0.2);
      break;
    case "tetris":
      playChord([262, 330, 392, 523], 0.5, "sine", 0.2);
      break;
    case "tspin":
      playTone(400, 0.2, "triangle", 0.25);
      break;
    case "hold":
      playTone(250, 0.08, "square", 0.15);
      break;
    case "levelup":
      playTone(400, 0.1, "sine", 0.2);
      setTimeout(() => playTone(500, 0.1, "sine", 0.2), 100);
      setTimeout(() => playTone(600, 0.15, "sine", 0.25), 200);
      break;
    case "gameover":
      playSweep(400, 100, 0.8, "sine", 0.3);
      break;
  }
}
