# UI-5 Compact player on the waveform

File: TransportBar / waveform card / app.css / transport-cluster.test.ts

Change:
- Play and Stop leave the top action bar.
- They sit on the MIX WAVEFORM card as small icon controls (play/pause + stop)
  plus the time readout. Same store handlers as now (play never renders).
- Top bar keeps only Generate and Vary as large buttons.
- Export is not a hero button; leave it if moving it is messy, or put a quiet
  control on the wave card. Do not invent more IA in this ticket.

Do not:
- Bring Simple/Power back
- Start UI-3 duplicates, captions, ACE, thinking flag, energy clamp
- Restyle the whole app or add libraries
- Run render-sample or prove-gpu

Done when:
- Generate/Vary are the only large actions up top
- Waveform card has compact Play/Stop
- transport-cluster.test updated for the new homes
- npx tsc --noEmit
- npx vitest run src/test/transport-cluster.test.ts

Verify: those two commands only.
