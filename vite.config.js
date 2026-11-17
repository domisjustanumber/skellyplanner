// Vite setup, following the house configs in ../freemocap/freemocap-ui and ../skellycam/skellycam-ui (ES-module
// workers, keep the terminal history) without their frameworks. Dev server on Vite's default port, 5173.
import { defineConfig } from "vite";

export default defineConfig({
  worker: { format: "es" },
  clearScreen: false
});
