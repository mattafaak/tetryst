import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/tetryst/" : "/",
  plugins: command === "build" ? [viteSingleFile()] : [],
  test: {
    include: ["src/**/*.test.ts"],
  },
}));
