# UX must-fixes — cycle 6 (post visual polish land)

## Visual polish CSS — CONDITIONAL PASS

Landed well: `.app.simple` 960px, transport primary emphasis, stem-compact/regen/vary/remix-live, focus rings, footer, reduced-motion, IBM Plex, HelpPanel de-jargon.

### Still OPEN (next polish — soft-pass forbidden)

| File | Fix |
|------|-----|
| `app.css` `.style-drop-head h2` | Still `uppercase` + `0.9rem` lab look — set sentence case, ~1.15–1.25rem, weight 700 for “Your MP3 → this vibe” |
| `helpCopy.ts` | Simple bubbles still >160 chars (`styleRef`/`generate`/`exportZip`/`stems`/…) — apply Brainstormer trim ≤2 sentences |
| `helpCopy.ts` + `RegenAffordance.tsx` | Add/wire `paramsDirtyCue` |
| `helpCopy.ts` `arrangement` | Drop “hard-grid” |
| `badgeAce` / Power tips | Soften CUDA box wording for any tip visible near Simple |

### Screenshot QA checklist (when E2E green)

1280×800 + 390 width: Style Ref headline reads as product hero; transport Generate dominant; stem-compact not cramped; tip bubbles not clipped; focus ring on Generate + ?.

## Sign-off

**Visual chrome:** PASS with cycle-6 OPEN items above.  
**HelpTip teach length:** NOT signed off until trims land.
