# UX must-fixes — HelpTips must teach

Audit rule: every `?` answers **What is this? → What happens? → What should I do?** in ≤2 short sentences. No eng jargon on Simple-facing tips. SoT remains `src/ui/lib/helpCopy.ts`.

## Grade legend

- **Teach** = keep / minor polish
- **Rewrite** = does not teach well enough
- **Power-ok** = jargon allowed only in Power/More tips
- **Remove/hide** = tip not useful for noobs

---

## P0 — Rewrite now (`helpCopy.ts`)

| Key | Grade | Why weak | Replacement (exact) |
|-----|-------|----------|---------------------|
| `darknessNudge` | Rewrite | Incomplete; no action | `Darker = heavier bass mood from your file. Try up if the sketch feels too bright; down if it’s too muddy.` |
| `energyNudge` | Rewrite | Thin | `Controls how hard the drop hits after your vibe is applied. Raise for more drive; leave mid if unsure.` |
| `statusPanel` | Rewrite | Vague | `Shows whether you’re ready to Play, Export, or fix an error. After Generate, hit Play; after Play, Export when you like it.` |
| `arrangement` | Rewrite | “Hard-grid” jargon | `These knobs change how the next sketch feels. Move a slider, then use Regenerate (or Again) to hear it — mute/solo do not need Regenerate.` |
| `bpmPower` | Rewrite | Eng | `Tempo stays near 174 (classic drum & bass). Only change this if you know you want 170–176.` |
| `hashPill` | Hide Simple / Rewrite Power | Meta ID | Power: `Session tag for which file is attached — private, not uploaded.` Simple: don’t show ? on hash (hash already hidden). |
| `favorites` | Rewrite | “(UI may still be landing.)” | `Saves this sketch’s settings in this browser so you can run it again later. Nothing uploads.` |
| `backendGpu` | Rewrite | `/probe` jargon | `Higher-quality local GPU engine. Needs a GPU service running on your machine. Until it’s on, stay on the browser sketch.` |
| `aceModels` | Rewrite | Host dump | `Big sound models live on your GPU machine, not in this browser tab. Download them there when you set up the local GPU path.` |
| `loraPack` | Rewrite | Stub/train jargon | `Optional style packs for Power Mode. Early packs are placeholders until local GPU training exists.` |
| `powerMode` | Rewrite | “LoRA gates” | `Advanced tools: sound engines, full track mixer, section map, and seed. Simple Mode keeps Generate → Play → Export easy.` |
| `badgeAce` | Soften | CUDA/sidecar heavy | `Later: richer sound via a local gaming-GPU setup. Right now Generate uses the browser sketch.` |
| `styleRef` | Polish | OK but long | Keep meaning; prefer: `Optional. Drop a song you own for vibe inspiration. We never copy the file. Skip this and Generate still works.` |
| `stemMute` / `stemSolo` / `stemGain` | Tighten | Triple repeat | Mute: `Silences this part in Play only. Export still keeps the dry track; if you remixed, ZIP also adds mix_as_heard.` Solo/Gain: parallel short forms. Or point all three to `HELP.glossaryStem` + one action line. |
| `bpmLock` | Polish | “tempo-clones” | `Song stays about 174 BPM. Your upload may show another BPM on the card — we don’t force the song to match it.` |
| `sectionTimeline` / `timeline` | Merge + teach | Duplicate keys | One key: `Shows intro → build → drop after Generate — how the song is paced. Appear after you create a sketch.` |

## P0 — HelpPanel must teach (not dump)

**File:** `HelpPanel.tsx` — still teaches poorly (StructureEngine, OfflineStub, Tone, StructureMap, sidecar).

Replace body with paraphrase of HELP.generate/play/exportZip/styleRef/simpleMode (see `ux-must-fixes-polish-docs-sync.md`). Add one line: `Tap any ? for plain-English help.`

## P1 — Missing teachable ? (wire if absent)

| Control | Suggested key | Teaching angle |
|---------|---------------|----------------|
| Flow chips idle | `flowChips` (exists) | Already OK — ensure wired once |
| RegenAffordance label | new `paramsDirtyCue` | `You changed knobs — Regenerate to hear them. Mute/solo do not need this.` |
| Favorites empty | inline | Already in panel — keep noob |
| Coach empty | optional | Don’t duplicate HelpPanel |

Add to helpCopy:

```ts
paramsDirtyCue:
  'You changed arrangement knobs. Hit Regenerate (same layout seed) or Vary (new layout) to hear them. Mute/solo update Play without Regenerate.',
```

Wire on `RegenAffordance` label HelpTip.

## P1 — Teaching pattern for Builder

When editing HELP strings:
1. Lead with user goal (“Hear…”, “Download…”, “Optional…”)
2. One consequence (“Play updates live”, “ZIP adds mix_as_heard”)
3. One next step if useful (“Then hit Play”)
4. Ban on Simple tips: OfflineStub, StructureEngine, StructureMap, Tone.js, /probe, CUDA sidecar, LoRA train, “stub packs” without plain words

## P2 — Docs living sync

After rewrites: refresh `docs/ux-helptip-copy.md` from HELP.* (UX already mirrored once; re-run). Update `docs/GLOSSARY.md` if present to match `GLOSSARY_BLURBS`.

## Acceptance

- [ ] Every Simple-facing ? teaches what/happens/next
- [ ] HelpPanel has zero eng stack names
- [ ] No tip says “UI may still be landing”
- [ ] Power tips may name GPU path in plain English only
- [ ] vitest/help copy snapshots updated if any

## Builder order

1. Apply P0 string table in `helpCopy.ts`
2. Rewrite HelpPanel
3. Add `paramsDirtyCue` on RegenAffordance
4. Sync docs/ux-helptip-copy.md
5. UX re-audit tip usefulness (spot-check Generate/Style/Mute/Regen/Surprise)
