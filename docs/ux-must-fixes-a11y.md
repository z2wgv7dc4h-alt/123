# UX must-fixes — a11y / keyboard / focus

## P0.1 Hotkeys vs HelpTip
`useTransportHotkeys.ts`: ignore Space/G/E when focus in `button, a, summary, [role=button], .help-tip-wrap`.

## P0.2 HelpTip sticky
Click sets sticky open; blur closes only if !sticky; Escape clears + refocuses ?.

## P0.3 focus-visible on range + mode + stem M/S (var(--focus)).

Full detail previously scoped for Builder — ship with listen-modify batch.
