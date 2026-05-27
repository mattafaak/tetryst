export interface HighScore {
  score: number;
  level: number;
  lines: number;
  mode: string;
  date: string;
}

const VALID_MODES = ["Marathon", "Sprint", "Ultra"];
const STORAGE_KEY = (mode: string) => `tetryst_hs_${mode}`;

// Module-level cache: avoid per-frame localStorage reads in the menu overlay.
// Invalidated on every saveHighScore call.
const scoresCache = new Map<string, HighScore[] | null>();

/** Clear the module-level scores cache (for testing and game restarts). */
export function clearScoresCache(): void {
  scoresCache.clear();
}

// Generation counter incremented on every saveHighScore so consumers (e.g., the
// menu overlay cache) can detect stale data without comparing arrays.
let _generation = 0;

/** Returns the current generation counter. Consumers can cache UI state keyed
 *  on this value and invalidate when it changes. */
export function getScoresGeneration(): number {
  return _generation;
}

function isValidHighScoreArray(value: unknown): value is HighScore[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) =>
      entry !== null &&
      typeof entry === "object" &&
      typeof (entry as HighScore).score === "number" &&
      (entry as HighScore).score >= 0 &&
      typeof (entry as HighScore).level === "number" &&
      typeof (entry as HighScore).lines === "number" &&
      typeof (entry as HighScore).mode === "string" &&
      VALID_MODES.includes((entry as HighScore).mode) &&
      typeof (entry as HighScore).date === "string",
  );
}

export function loadHighScores(mode: string): HighScore[] {
  // Module-level cache avoids per-frame localStorage reads in hot paths like
  // the menu overlay. Invalidated on saveHighScore.
  if (scoresCache.has(mode)) {
    const cached = scoresCache.get(mode);
    return cached ? cached : [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY(mode));
    if (!raw) {
      scoresCache.set(mode, null);
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!isValidHighScoreArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY(mode));
      scoresCache.set(mode, null);
      return [];
    }
    scoresCache.set(mode, parsed);
    return parsed;
  } catch {
    scoresCache.set(mode, null);
    return [];
  }
}

// Per-mode top-N cache: avoids per-frame .slice() allocations in GameOver/Victory render.
// Key: `${mode}:${n}:${generation}`. Invalidated on saveHighScore via generation increment.
const topScoresCache = new Map<string, HighScore[]>();

/** Load the top N scores for a mode, using a cached slice to avoid per-frame allocations. */
export function loadTopScores(mode: string, n: number): HighScore[] {
  const key = `${mode}:${n}:${_generation}`;
  if (topScoresCache.has(key)) return topScoresCache.get(key)!;
  const sliced = loadHighScores(mode).slice(0, n);
  topScoresCache.set(key, sliced);
  return sliced;
}

export function saveHighScore(
  entry: Omit<HighScore, "date">,
): HighScore[] {
  const existing = loadHighScores(entry.mode);
  const newEntry: HighScore = { ...entry, date: new Date().toISOString() };
  const isSprint = entry.mode === "Sprint";
  const updated = [...existing, newEntry]
    .sort((a, b) => isSprint ? a.score - b.score : b.score - a.score)
    .slice(0, 10);
  try {
    localStorage.setItem(STORAGE_KEY(entry.mode), JSON.stringify(updated));
  } catch {
    // localStorage unavailable (e.g., tests without stub)
  }
  scoresCache.delete(entry.mode);
  _generation++;
  return updated;
}
