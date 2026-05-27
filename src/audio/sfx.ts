import { getAudioContext } from "./audio-ctx.ts";
import { SFX_DEFS, type SFXName } from "./sfx-defs.ts";
import { createPulseOsc } from "./apu.ts";

export type { SFXName };

export function playSFX(name: SFXName): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  for (const event of SFX_DEFS[name].events) {
    try {
      const t = now + event.delay;

      if (event.type === "noise") {
        const bufLen = Math.max(1, Math.ceil(ctx.sampleRate * event.duration));
        const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(event.volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + event.duration);
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(event.hp, t);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(t);
        source.stop(t + event.duration);
      } else {
        let osc: OscillatorNode;
        if (event.waveType === "pulse25") {
          osc = createPulseOsc(ctx, 0.25);
        } else if (event.waveType === "pulse50") {
          osc = createPulseOsc(ctx, 0.5);
        } else {
          osc = ctx.createOscillator();
          osc.type = event.waveType as OscillatorType;
        }

        osc.frequency.setValueAtTime(event.startFreq, t);
        if (event.endFreq !== undefined) {
          osc.frequency.linearRampToValueAtTime(event.endFreq, t + event.duration);
        }

        const gain = ctx.createGain();
        if (event.decay) {
          gain.gain.setValueAtTime(event.volume, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + event.duration);
        } else {
          gain.gain.setValueAtTime(event.volume, t);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.onended = () => { try { gain.disconnect(); } catch { /* done */ } };
        osc.start(t);
        osc.stop(t + event.duration);
      }
    } catch {
      // Audio not available — fail silently
    }
  }
}
