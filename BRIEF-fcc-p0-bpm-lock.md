# FCC GRUNT — next product (queued): BPM hard-lock P0.2

## Only after paid P0.1 EXIT (avoid OfflineStub dual-write)
Files: OfflineStubBackend.ts BPM lock, StructureEngine if needed, tests for BPM==174.

## Do
1. Close the +/-2 BPM hole: OfflineStub always plans/renders at DEFAULT_BPM 174 (critic-audio P0.2).
2. Tests: hard assert plan/measured BPM == 174; remove soft 170-176 pass if present.
3. npm.cmd test -- --run + npx.cmd tsc --noEmit green.
4. No peak-metric schema work (paid). No PreviewPlayer live-bus.

## Done
P0.2 acceptance met; tests+tsc green.
