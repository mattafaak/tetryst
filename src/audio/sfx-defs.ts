// Pure TypeScript data — no Web Audio imports.
// Consumed by sfx.ts which instantiates Web Audio nodes at play time.

export type SFXName =
  | "move" | "rotate" | "lock" | "clear"
  | "tetris" | "tspin" | "hold" | "levelup" | "gameover" | "finesse";

export interface OscEvent {
  type: "osc";
  waveType: "pulse25" | "pulse50" | "triangle" | "sawtooth";
  startFreq: number;
  endFreq?: number;   // if set, apply linearRamp from startFreq to endFreq
  duration: number;   // seconds
  delay: number;      // seconds offset from trigger time
  volume: number;
  decay: boolean;     // if true, apply exponential decay to 0.001 at end
}

export interface NoiseEvent {
  type: "noise";
  duration: number;
  delay: number;
  volume: number;
  hp: number;         // highpass filter Hz
}

export type SFXEvent = OscEvent | NoiseEvent;

export interface SFXDef {
  events: SFXEvent[];
}

export const SFX_DEFS: Record<SFXName, SFXDef> = {
  // Short low blip — quiet, non-distracting
  move: {
    events: [
      { type: "osc", waveType: "pulse25", startFreq: 150, duration: 0.06, delay: 0, volume: 0.12, decay: false },
    ],
  },
  // Mid tone — slightly higher than move
  rotate: {
    events: [
      { type: "osc", waveType: "pulse25", startFreq: 280, duration: 0.08, delay: 0, volume: 0.15, decay: false },
    ],
  },
  // Low thud — weighty, decays naturally
  lock: {
    events: [
      { type: "osc", waveType: "triangle", startFreq: 90, duration: 0.12, delay: 0, volume: 0.20, decay: true },
    ],
  },
  // Rising sweep — satisfying clear sound
  clear: {
    events: [
      { type: "osc", waveType: "pulse50", startFreq: 180, endFreq: 720, duration: 0.22, delay: 0, volume: 0.20, decay: false },
    ],
  },
  // Chord [262, 330, 392, 523] Hz — celebratory
  tetris: {
    events: [
      { type: "osc", waveType: "triangle", startFreq: 262, duration: 0.40, delay: 0, volume: 0.15, decay: false },
      { type: "osc", waveType: "triangle", startFreq: 330, duration: 0.40, delay: 0, volume: 0.15, decay: false },
      { type: "osc", waveType: "triangle", startFreq: 392, duration: 0.40, delay: 0, volume: 0.15, decay: false },
      { type: "osc", waveType: "triangle", startFreq: 523, duration: 0.40, delay: 0, volume: 0.15, decay: false },
    ],
  },
  // Ascending pair 350→500 Hz — special T-spin recognition
  tspin: {
    events: [
      { type: "osc", waveType: "pulse25", startFreq: 350, duration: 0.15, delay: 0.000, volume: 0.20, decay: false },
      { type: "osc", waveType: "pulse25", startFreq: 500, duration: 0.15, delay: 0.075, volume: 0.20, decay: false },
    ],
  },
  // Quick mid blip — similar to move
  hold: {
    events: [
      { type: "osc", waveType: "pulse25", startFreq: 240, duration: 0.06, delay: 0, volume: 0.12, decay: false },
    ],
  },
  // Three-tone ascending fanfare
  levelup: {
    events: [
      { type: "osc", waveType: "pulse25", startFreq: 400, duration: 0.08, delay: 0.00, volume: 0.20, decay: false },
      { type: "osc", waveType: "pulse25", startFreq: 500, duration: 0.08, delay: 0.10, volume: 0.20, decay: false },
      { type: "osc", waveType: "pulse25", startFreq: 600, duration: 0.12, delay: 0.20, volume: 0.20, decay: false },
    ],
  },
  // Descending sweep 400→90 Hz — mournful
  gameover: {
    events: [
      { type: "osc", waveType: "pulse25", startFreq: 400, endFreq: 90, duration: 0.70, delay: 0, volume: 0.25, decay: false },
    ],
  },
  // Short descending blip — quiet notification of a suboptimal placement
  finesse: {
    events: [
      { type: "osc", waveType: "pulse25", startFreq: 180, endFreq: 110, duration: 0.07, delay: 0, volume: 0.09, decay: true },
    ],
  },
};
