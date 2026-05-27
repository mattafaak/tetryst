import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/tetryst/" : "/",
  build: { target: "es2023" },
  plugins: command === "build" ? [viteSingleFile()] : [],
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.fuzz.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.fuzz.test.ts", "src/test-utils/**"],
    },
  },
}));
