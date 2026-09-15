# UI-6 Intent above Generate

File:
- src/App.tsx (or the main shell UI-2 left)
- whatever still mounts style text, song shape, vibe/style-ref
- tests that assert More-only for those controls (simple-process-order / single-layout)

Change:
Home column order, top to bottom:
1. Intent: backend chip, style text, song shape
2. Go: Generate + Vary (large)
3. Hear: waveform + compact Play/Stop (UI-5 — if UI-5 not done, do not invent a third transport)
4. Shape: arrangement map; Expand/×2 only on the SELECTED section
5. More: export, mixer, layers, favorites, surprise, style-ref dropzone, advanced

Style text and song shape leave More and sit above Generate.
Style-ref file drop can stay in More.

Do not:
- Bring Simple/Power back
- ACE / captions / thinking / steps / SFT
- Full suite, render-sample, prove-gpu
- Skin/glass (UI-7)
- Generate audio

Done when:
- Style text + song shape are visible without opening More
- Generate sits under that intent, not above a buried brief
- No numbered 1·2·3 wizard labels

Verify:
- npx tsc --noEmit
- npx vitest run src/test/single-layout.test.ts src/test/simple-process-order.test.ts
