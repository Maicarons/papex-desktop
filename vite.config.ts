import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tauri expects a fixed port; the dev server is proxied by the Rust shell.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    hmr: { protocol: "ws", host: "localhost", port: 1421 },
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // Produce an importable test config via Vitest's config merging.
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/security/**", "src/lib/api/**"],
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
    },
    exclude: ["e2e/**", "src-tauri/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  // Tauri uses a custom protocol; we keep assets relative.
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
