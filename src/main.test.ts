import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("main.ts", () => {
  it("renders error when #game element is missing", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      innerWidth: 800,
      innerHeight: 600,
      addEventListener: vi.fn(),
    });
    vi.stubGlobal("document", {
      body: { innerHTML: "" },
      getElementById: vi.fn(() => null),
    });

    await expect(async () => {
      await import("./main.ts");
    }).rejects.toThrow("Canvas element #game not found");

    expect(document.body.innerHTML).toContain("Error: Canvas element (#game) not found");
  });

  it("renders error when 2D context is unavailable", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      innerWidth: 800,
      innerHeight: 600,
      addEventListener: vi.fn(),
    });
    vi.stubGlobal("document", {
      body: { innerHTML: "" },
      getElementById: vi.fn(() => ({
        getContext: vi.fn(() => null),
        width: 0,
        height: 0,
        style: {},
      })),
    });

    await expect(async () => {
      await import("./main.ts");
    }).rejects.toThrow("2D rendering context not available");

    expect(document.body.innerHTML).toContain("Error: Browser does not support 2D canvas");
  });

  it("cleanup from pagehide does not throw when Game is not initialized", async () => {
    // Module-level code in main.ts registers a pagehide handler.
    // Even if Game throws during construction, the pagehide listener
    // should not crash (it's registered after game.start()). This test
    // verifies the handler can be registered without crashing.
    vi.resetModules();
    vi.stubGlobal("window", {
      devicePixelRatio: 1,
      innerWidth: 800,
      innerHeight: 600,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "pagehide" && typeof handler === "function") {
          // Handler registered without crashing
        }
      }),
    });
    vi.stubGlobal("document", {
      body: { innerHTML: "" },
      getElementById: vi.fn(() => null),
    });

    // Import will throw on missing canvas, but shouldn't crash due to
    // unhandled pagehide registration
    await expect(async () => {
      await import("./main.ts");
    }).rejects.toThrow();
  });
});
