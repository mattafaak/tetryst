export interface DASSettings {
  dasDelay: number;
  arrRate: number;
  sdrRate: number;
}

export const DEFAULT_DAS_SETTINGS: DASSettings = {
  dasDelay: 300,
  arrRate: 50,
  sdrRate: 50,
};

const STORAGE_KEY = "tetryst_das";

export function clampDASSettings(s: DASSettings): DASSettings {
  return {
    dasDelay: Math.min(500, Math.max(0, s.dasDelay)),
    arrRate: Math.min(200, Math.max(0, s.arrRate)),
    sdrRate: Math.min(200, Math.max(0, s.sdrRate)),
  };
}

function isValidSettings(value: unknown): value is DASSettings {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.dasDelay === "number" &&
    typeof v.arrRate === "number" &&
    typeof v.sdrRate === "number"
  );
}

export function loadDASSettings(): DASSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DAS_SETTINGS };
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidSettings(parsed)) return { ...DEFAULT_DAS_SETTINGS };
    return clampDASSettings(parsed);
  } catch {
    return { ...DEFAULT_DAS_SETTINGS };
  }
}

export function saveDASSettings(settings: DASSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clampDASSettings(settings)));
}
