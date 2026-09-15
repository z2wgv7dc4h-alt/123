import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  server: {
    port: 5173,
    strictPort: true,
    host: host || true,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    // Phone-friendly: browser only talks to :5173; Vite forwards ACE bridge on PC localhost.
    proxy: {
      "/ace-bridge": {
        target: "http://127.0.0.1:8766",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ace-bridge/, ""),
      },
    },
  },
  build: {
    ...(process.env.TAURI_ENV_PLATFORM
      ? {
          target:
            process.env.TAURI_ENV_PLATFORM === "windows"
              ? "chrome105"
              : "safari13",
          minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
          sourcemap: !!process.env.TAURI_ENV_DEBUG,
        }
      : {}),
  },
  test: {
    environment: "node",
    include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
  },
});
