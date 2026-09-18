# UI-7 Skin pass — glass, hierarchy, fewer ?

**Status: Done** `b9a16be` (primary Generate, ghost Vary, glass More grouped into Export / Sound / Style reference / Mixer & stems / Advanced, one HelpTip per component). Part of the help cull landed in `8d2de74`.

File:
- src/styles/app.css
- transport / waveform / primary buttons
- help-tip components on the home screen

Change:
Visual pass only after UI-5 and UI-6.
- CSS variables: bg, glass, accent, text. One accent, not rainbow map + neon pills
- backdrop-filter glass on shell, wave card, More sheet only
- lucide-react icons for Play / Pause / Stop (add lucide-react if missing)
- Generate = primary solid; Vary = ghost
- Strip help ? from the home screen. One Help inside More
- Optional: shadcn button/slider/sheet ONLY if we have no equivalent. No Glin, no extra visualizer, no motion on every chip
- motion allowed on Generate pending state only

Do not:
- Reorder the page (that is UI-6)
- ACE, captions, thinking, SFT
- Full suite or audio

Done when:
- Home is scannable: intent, Generate, wave+player
- tsc clean
- existing transport / single-layout tests still pass

Verify:
- npx tsc --noEmit
- npx vitest run src/test/transport-cluster.test.ts src/test/single-layout.test.ts
