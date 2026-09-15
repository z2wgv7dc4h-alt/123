# mix_as_heard

Matches HELP.exportZip, HELP.stems, GLOSSARY_BLURBS.mixAsHeard.

## Rule

- Dry ZIP: original separate-track WAVs + manifest + MIDI — always.
- When remixed (any mute/solo/non-zero gain): Export also adds *_mix_as_heard.wav using the same DSP path as Play.
- Clean mixer: no mix_as_heard entry (see src/test/mix-as-heard.test.ts).

## User wording

Download for your music software: dry tracks; if you tweaked mute/solo/gain, ZIP also includes mix_as_heard matching Play.

Long-form detail lives in [../GLOSSARY.md](../GLOSSARY.md#mix_as_heard); HelpTips stay ≤160 chars when Builder trims.
