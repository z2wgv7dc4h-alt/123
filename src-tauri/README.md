# src-tauri — optional Tauri 2 desktop shell

Greenfield Tauri 2 + existing React (MIT) Vite app. Not ACE-Step-DAW (AGPL).

## Honesty

- Desktop shell optional; browser Sketch on the box stays primary.
- No live ACE/CUDA in base installer; sidecar stays lazy/fail-soft.
- ACCEPTANCE Tauri stays unchecked until real desktop smoke.
- Same Generate/Play/tweak/export (mix_as_heard) journey via webview UI.
- P1 after boot: FS export paths; Sketch 16|24-bit WAV (encodeWav already 24-capable).


## Prerequisites

1. Rust toolchain (rustup)
2. Platform libs: https://v2.tauri.app/start/prerequisites/
3. Root node_modules (@tauri-apps/cli already a devDependency)

## When deps + display available

From repo root:

- cd src-tauri && cargo fetch && cd ..
- npx tauri dev   (script: tauri:dev)
- npx tauri build (script: tauri:build)

Browser path unchanged: vite / typecheck / vitest.

Scaffold mirrors official Tauri 2 Vite manual layout. CLI init was blocked on this box; files match create-tauri-app _base_ v2 (no greet demo).

## Box status (2026-09-06 PT)

- Scaffold present; CLI in root package.json.
- cargo fetch ok; rustup 1.98 compiles until glib/webkit link.
- Box lacks pkg-config/webkit2gtk/gtk3 + display; no window smoke here.
- ACCEPTANCE Tauri stays unchecked until desktop smoke on a host with WebKitGTK 4.1 (or Win/macOS WebView) then npx tauri dev.
- Verify Generate/Play/tweak/export-heard + Sketch vs Studio chrome. No ACE live.
- P1 after boot: FS export paths; Sketch 16|24-bit (encodeWav already 24-capable).
