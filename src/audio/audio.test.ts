import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAudioContext } from "./audio-ctx.ts";
import { playSFX } from "./sfx.ts";
import { playMusic, stopMusic } from "./music.ts";

let mockGain: Record<string, unknown>;
let mockOsc: Record<string, unknown>;

function setupAudioCtx(state = "running") {
  mockGain = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  };
  mockOsc = {
    type: "",
    frequency: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(() => mockGain),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const mockSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  vi.stubGlobal("window", { setTimeout: vi.fn(), clearTimeout: vi.fn() });
  vi.stubGlobal("AudioContext", vi.fn(function () {
    return {
      currentTime: 0,
      state,
      destination: {},
      sampleRate: 44100,
      createOscillator: vi.fn(() => mockOsc),
      createGain: vi.fn(() => mockGain),
      createBuffer: vi.fn(() => ({ getChannelData: vi.fn(() => new Float32Array(441)) })),
      createBufferSource: vi.fn(() => mockSource),
      createBiquadFilter: vi.fn(() => ({
        type: "",
        frequency: { value: 0, setValueAtTime: vi.fn() },
        connect: vi.fn(),
      })),
      resume: vi.fn(() => Promise.resolve()),
    };
  }));
}

beforeEach(() => {
  setupAudioCtx();
});

afterEach(() => {
  stopMusic();
  vi.unstubAllGlobals();
});

describe("audio-ctx", () => {
  it("returns an AudioContext instance", () => {
    const ctx = getAudioContext();
    expect(ctx).toBeDefined();
    expect(ctx.state).toBe("running");
  });

  it("returns the same instance on repeated calls", () => {
    const a = getAudioContext();
    const b = getAudioContext();
    expect(a).toBe(b);
  });

  it("throws when AudioContext cannot be constructed", async () => {
    vi.resetModules();
    vi.stubGlobal("AudioContext", vi.fn(function () {
      throw new DOMException("AudioContext not supported");
    }));
    const { getAudioContext: getCtx } = await import("./audio-ctx.ts");
    expect(() => getCtx()).toThrow("AudioContext not available");
  });
});

describe("sfx", () => {
  it("playSFX can be called with all effect types without throwing", () => {
    const types = ["move", "rotate", "lock", "clear", "tetris", "tspin", "hold", "levelup", "gameover"] as const;
    for (const t of types) {
      expect(() => playSFX(t)).not.toThrow();
    }
  });

  it("playSFX degrades gracefully when AudioContext is unavailable", async () => {
    vi.resetModules();
    vi.stubGlobal("AudioContext", vi.fn(function () {
      throw new DOMException("AudioContext not supported");
    }));
    const { playSFX: sfx } = await import("./sfx.ts");
    const types = ["move", "rotate", "lock", "clear", "tetris", "tspin", "hold", "levelup", "gameover"] as const;
    for (const t of types) {
      expect(() => sfx(t)).not.toThrow();
    }
  });
});

describe("music", () => {
  it("playMusic and stopMusic can be called without throwing", () => {
    expect(() => playMusic()).not.toThrow();
    expect(() => stopMusic()).not.toThrow();
  });

  it("stopMusic is idempotent", () => {
    playMusic();
    stopMusic();
    expect(() => stopMusic()).not.toThrow();
  });

  it("playMusic is idempotent", () => {
    playMusic();
    playMusic();
    stopMusic();
  });

  it("playMusic/stopMusic cycle does not throw", () => {
    playMusic();
    stopMusic();
    expect(() => stopMusic()).not.toThrow();
    playMusic();
    stopMusic();
  });
});
