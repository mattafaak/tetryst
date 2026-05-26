import { describe, it, expect } from "vitest";
import { buildSchedule, freqOf, bassFreqOf, BPM, BEAT_DURATION, MELODY_DATA } from "./music.ts";

describe("freqOf", () => {
  it("returns frequency for known note", () => {
    expect(freqOf("A4")).toBe(440.0);
    expect(freqOf("C5")).toBe(523.25);
    expect(freqOf("E5")).toBe(659.25);
  });

  it("returns null for unknown note", () => {
    expect(freqOf("Z9")).toBeNull();
    expect(freqOf("")).toBeNull();
  });
});

describe("bassFreqOf", () => {
  it("returns bass frequency for known root", () => {
    expect(bassFreqOf("A4")).toBe(110.0);
    expect(bassFreqOf("E5")).toBe(82.41);
  });

  it("returns null for rest note", () => {
    expect(bassFreqOf("R")).toBeNull();
  });

  it("falls back to 110 for unknown root", () => {
    expect(bassFreqOf("X5")).toBe(110.0);
  });
});

describe("buildSchedule", () => {
  it("returns empty array for empty melody", () => {
    expect(buildSchedule([])).toEqual([]);
  });

  it("produces correct beat offsets and durations", () => {
    const melody = [
      { note: "A4", duration: 1 },
      { note: "B4", duration: 0.5 },
      { note: "C5", duration: 1.5 },
    ];
    const events = buildSchedule(melody);
    expect(events).toHaveLength(3);
    expect(events[0].startBeat).toBe(0);
    expect(events[0].durBeats).toBe(1);
    expect(events[0].note).toBe("A4");
    expect(events[1].startBeat).toBe(1);
    expect(events[1].durBeats).toBe(0.5);
    expect(events[1].note).toBe("B4");
    expect(events[2].startBeat).toBe(1.5);
    expect(events[2].durBeats).toBe(1.5);
    expect(events[2].note).toBe("C5");
  });

  it("bass carries forward on off-beats", () => {
    const melody = [
      { note: "A4", duration: 1 },
      { note: "B4", duration: 0.5 },
      { note: "C5", duration: 0.5 },
    ];
    const events = buildSchedule(melody);
    // Beat 0 (downbeat): bass set from A4 root
    expect(events[0].bassFreq).toBe(110.0);
    // Beat 1 (downbeat): bass set from B4 root
    expect(events[1].bassFreq).toBe(82.41);
    // Beat 1.5 (off-beat): bass carries forward from beat 1
    expect(events[2].startBeat).toBe(1.5);
    expect(events[2].bassFreq).toBe(82.41);
  });

  it("last event endBeat does not exceed total duration", () => {
    const events = buildSchedule(MELODY_DATA);
    const totalBeats = events.reduce((max, e) => Math.max(max, e.startBeat + e.durBeats), 0);
    expect(events[events.length - 1].startBeat + events[events.length - 1].durBeats).toBeLessThanOrEqual(totalBeats);
  });

  it("first event starts at beat 0", () => {
    const events = buildSchedule(MELODY_DATA);
    expect(events[0].startBeat).toBe(0);
  });
});

describe("melody constants", () => {
  it("MELODY_DATA has 176 entries", () => {
    expect(MELODY_DATA).toHaveLength(176);
  });

  it("BPM is 144 and BEAT_DURATION is correct", () => {
    expect(BPM).toBe(144);
    expect(BEAT_DURATION).toBeCloseTo(60 / 144, 6);
  });

  it("total melody duration is ≤ 176 beats", () => {
    const total = MELODY_DATA.reduce((sum, e) => sum + e.duration, 0);
    expect(total).toBeLessThanOrEqual(176);
  });
});
