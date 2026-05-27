// Shared AudioContext singleton for both SFX and music
// Ensures browser autoplay policy is respected with a single context

let audioCtx: AudioContext | null = null;

/** Reset the singleton so the next call to getAudioContext creates a new one.
 *  Used in tests to ensure a fresh AudioContext per test case. */
export function resetAudioContext(): void {
  audioCtx = null;
}

export function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      // AudioContext not available (sandboxed env, no browser support)
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
      /* Autoplay policy — user gesture required; playback degrades gracefully */
    });
  }
  return audioCtx;
}
