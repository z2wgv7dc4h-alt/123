# FCC GRUNT — north-star HelpTips + live Channel honesty

## Do
1. Find HelpTips that lie or miss What:/When:/What happens: on Transport/mixer/Expand/Vary (helptip.test.ts patterns).
2. Find live mute/solo/gain gaps still bypassing Tone.Channel / master bus (live-tweak-preview / live-mixer-preview).
3. Fix only concrete failing tests or add one tight test per gap. npm.cmd test -- --run + npx.cmd tsc --noEmit green.
4. Out: peak schema (paid), ACE, CSS redesign, Expand/Vary seed (already gated).

## Done
Tests green; no soft-pass.
