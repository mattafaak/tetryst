import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadDASSettings,
  saveDASSettings,
  clampDASSettings,
  DEFAULT_DAS_SETTINGS,
} from "./das-settings.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

let storage: ReturnType<typeof mockStorage>;

beforeEach(() => {
  storage = mockStorage();
  vi.stubGlobal("localStorage", storage);
});

describe("loadDASSettings — defaults", () => {
  it("returns defaults when key is absent", () => {
    expect(loadDASSettings()).toEqual(DEFAULT_DAS_SETTINGS);
  });
  it("default dasDelay is 300", () => {
    expect(DEFAULT_DAS_SETTINGS.dasDelay).toBe(300);
  });
  it("default arrRate is 50", () => {
    expect(DEFAULT_DAS_SETTINGS.arrRate).toBe(50);
  });
  it("default sdrRate is 50", () => {
    expect(DEFAULT_DAS_SETTINGS.sdrRate).toBe(50);
  });
});

describe("saveDASSettings / loadDASSettings — round-trip", () => {
  it("round-trips valid values", () => {
    const settings = { dasDelay: 133, arrRate: 0, sdrRate: 25 };
    saveDASSettings(settings);
    expect(loadDASSettings()).toEqual(settings);
  });
  it("stores valid JSON in localStorage", () => {
    saveDASSettings({ dasDelay: 200, arrRate: 10, sdrRate: 10 });
    const raw = storage.getItem("tetryst_das");
    expect(raw).not.toBeNull();
    expect(() => JSON.parse(raw!)).not.toThrow();
  });
});

describe("loadDASSettings — clamping on load", () => {
  it("clamps dasDelay > 500 to 500", () => {
    storage.setItem("tetryst_das", JSON.stringify({ dasDelay: 999, arrRate: 50, sdrRate: 50 }));
    expect(loadDASSettings().dasDelay).toBe(500);
  });
  it("clamps arrRate < 0 to 0", () => {
    storage.setItem("tetryst_das", JSON.stringify({ dasDelay: 300, arrRate: -10, sdrRate: 50 }));
    expect(loadDASSettings().arrRate).toBe(0);
  });
  it("clamps sdrRate > 200 to 200", () => {
    storage.setItem("tetryst_das", JSON.stringify({ dasDelay: 300, arrRate: 50, sdrRate: 300 }));
    expect(loadDASSettings().sdrRate).toBe(200);
  });
});

describe("loadDASSettings — invalid JSON / malformed data returns defaults", () => {
  it("returns defaults for malformed JSON", () => {
    storage.setItem("tetryst_das", "not-json");
    expect(loadDASSettings()).toEqual(DEFAULT_DAS_SETTINGS);
  });
  it("returns defaults for null-valued JSON", () => {
    storage.setItem("tetryst_das", "null");
    expect(loadDASSettings()).toEqual(DEFAULT_DAS_SETTINGS);
  });
  it("returns defaults for empty object (missing fields)", () => {
    storage.setItem("tetryst_das", "{}");
    expect(loadDASSettings()).toEqual(DEFAULT_DAS_SETTINGS);
  });
  it("returns defaults when fields are non-numeric", () => {
    storage.setItem("tetryst_das", JSON.stringify({ dasDelay: "fast", arrRate: null, sdrRate: 50 }));
    expect(loadDASSettings()).toEqual(DEFAULT_DAS_SETTINGS);
  });
});

describe("clampDASSettings", () => {
  it("clamps out-of-range values", () => {
    expect(clampDASSettings({ dasDelay: 600, arrRate: -5, sdrRate: 300 })).toEqual({
      dasDelay: 500,
      arrRate: 0,
      sdrRate: 200,
    });
  });
  it("leaves in-range values unchanged", () => {
    const s = { dasDelay: 133, arrRate: 0, sdrRate: 50 };
    expect(clampDASSettings(s)).toEqual(s);
  });
  it("clamps to lower bound 0 for all fields", () => {
    expect(clampDASSettings({ dasDelay: -100, arrRate: -1, sdrRate: -50 })).toEqual({
      dasDelay: 0,
      arrRate: 0,
      sdrRate: 0,
    });
  });
});
