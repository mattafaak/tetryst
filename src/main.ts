import "./style.css";
import { Game } from "./game/loop.ts";

const el = document.getElementById("game");
if (!el) {
  document.body.innerHTML = '<p style="color:red;padding:2em;">Error: Canvas element (#game) not found.</p>';
  throw new Error("Canvas element #game not found");
}
const canvas: HTMLCanvasElement = el as HTMLCanvasElement;

const ctx = canvas.getContext("2d");
if (!ctx) {
  document.body.innerHTML = '<p style="color:red;padding:2em;">Error: Browser does not support 2D canvas.</p>';
  throw new Error("2D rendering context not available");
}

// resize handler — single source (Game.start also recalculates cellSize on resize)
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

window.addEventListener("resize", resize);
resize();

const game = new Game(ctx);
game.start();

// Cleanup on page unload
window.addEventListener("pagehide", () => game.stop());
