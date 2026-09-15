# FCC GRUNT — P1.1 ZIP CRC integrity test (product honesty)

From PAID-VERIFY-P1 / PAID-P1-NEXT. Soft-pass forbidden. No HelpTips work.

## Do
1. Read `src/core/export/zip.ts` + `src/test/zip.test.ts` (writer CRC already exists; gap is the test).
2. Add test(s) in `src/test/zip.test.ts` (or zip-crc.test.ts): buildZip with 2+ known entries; assert local+central CRC fields match expected CRC-32 of payload bytes (do not only check PK magic).
3. Do NOT change zip.ts unless a real writer bug is proven.
4. npm.cmd test -- --run src/test/zip.test.ts then full npm.cmd test -- --run + npx.cmd tsc --noEmit. Write _cos-runs/FCC-ZIP-CRC-RESULT.md.

## Files ONLY
zip.test.ts (and optional new zip-crc.test.ts). Out: helpCopy, PreviewPlayer, OfflineStub, StructureEngine.
