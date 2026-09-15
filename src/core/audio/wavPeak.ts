/**
 * Peak scan of a PCM WAV ArrayBuffer — no Web Audio (works in vitest/node).
 * Used for #51 soft peak warn on Export.
 */
export function wavPcmPeakAbs(ab: ArrayBuffer): number {
  const view = new DataView(ab);
  if (view.byteLength < 44) return 0;
  const numChannels = view.getUint16(22, true);
  const bitDepth = view.getUint16(34, true);
  let offset = 12;
  let dataOffset = 44;
  let dataSize = view.byteLength - 44;
  while (offset + 8 <= view.byteLength) {
    const id =
      String.fromCharCode(view.getUint8(offset)) +
      String.fromCharCode(view.getUint8(offset + 1)) +
      String.fromCharCode(view.getUint8(offset + 2)) +
      String.fromCharCode(view.getUint8(offset + 3));
    const size = view.getUint32(offset + 4, true);
    if (id === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size;
  }
  const bytesPerSample = bitDepth / 8;
  if (bytesPerSample < 1 || numChannels < 1) return 0;
  const frameCount = Math.floor(dataSize / (numChannels * bytesPerSample));
  let peak = 0;
  let o = dataOffset;
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = 0;
      if (bitDepth === 16) {
        sample = Math.abs(view.getInt16(o, true) / 0x8000);
        o += 2;
      } else if (bitDepth === 24) {
        const b0 = view.getUint8(o);
        const b1 = view.getUint8(o + 1);
        const b2 = view.getUint8(o + 2);
        let v = b0 | (b1 << 8) | (b2 << 16);
        if (v & 0x800000) v |= ~0xffffff;
        sample = Math.abs(v / 0x800000);
        o += 3;
      } else {
        return peak;
      }
      if (sample > peak) peak = sample;
    }
  }
  return peak;
}

/** Soft-hot threshold for post-encode export warn (does not block). */
export const EXPORT_HOT_PEAK = 0.98;

/** Pre-glue / gain-heuristic threshold — soft-limit can keep encoded peak below EXPORT_HOT_PEAK. */
export const EXPORT_HOT_PEAK_PREGLUE = 0.9;
