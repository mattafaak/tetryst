// Shared AudioContext singleton for both SFX and music
// Ensures browser autoplay policy is respected with a single context

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
      /* Autoplay policy — user gesture required; playback degrades gracefully */
    });
  }
  return audioCtx;
}
