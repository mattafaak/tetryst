// Shared AudioContext singleton for both SFX and music
// Ensures browser autoplay policy is respected with a single context

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      // AudioContext not available (sandboxed env, no browser support)
      // Callers handle null via their own try-catch or null checks
      throw new Error("AudioContext not available");
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
      /* Autoplay policy — user gesture required; playback degrades gracefully */
    });
  }
  return audioCtx;
}
