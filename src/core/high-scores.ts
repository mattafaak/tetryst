export interface HighScore {
  score: number;
  level: number;
  lines: number;
  mode: string;
  date: string;
}

const STORAGE_KEY = (mode: string) => `tetryst_hs_${mode}`;

export function loadHighScores(mode: string): HighScore[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(mode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HighScore[];
  } catch {
    return [];
  }
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
  return updated;
}
