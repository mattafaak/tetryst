import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/tetryst/" : "/",
  build: { target: "es2023" },
  plugins: command === "build" ? [viteSingleFile()] : [],
  test: {
    include: ["src/**/*.test.ts"],
  },
}));
