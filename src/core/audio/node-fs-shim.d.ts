// Narrow ambient declaration for the one 'node:fs' function loadBreakLoop.ts
// calls at runtime (only ever reached when running in Node, never in the
// browser bundle). Deliberately not @types/node: this tsconfig has no
// `types` array, so installing @types/node would auto-include it and leak
// Node globals (Buffer, process, ...) into every browser-side file TS
// compiles. This file has no imports/exports, which is what makes TS treat
// the declaration below as a fresh ambient module rather than an
// augmentation of one it needs to already resolve.
declare module 'node:fs' {
  export function readFileSync(path: URL): Uint8Array;
}
