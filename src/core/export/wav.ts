/** Encode interleaved stereo Float32 → WAV Blob (PCM 16 or 24-bit LE). */

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function floatTo16(s: number): number {
  const x = Math.max(-1, Math.min(1, s));
  return x < 0 ? Math.round(x * 0x8000) : Math.round(x * 0x7fff);
}

function floatTo24(s: number): number {
  const x = Math.max(-1, Math.min(1, s));
  return Math.round(x * 0x7fffff);
}

export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  bitDepth: 16 | 24 = 16,
): Blob {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = channels[c]![i] ?? 0;
      if (bitDepth === 16) {
        view.setInt16(offset, floatTo16(sample), true);
        offset += 2;
      } else {
        const v = floatTo24(sample);
        view.setUint8(offset, v & 0xff);
        view.setUint8(offset + 1, (v >> 8) & 0xff);
        view.setUint8(offset + 2, (v >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Decode PCM WAV (16/24-bit LE) → float channels + metadata. */
export function decodeWavChannels(arrayBuffer: ArrayBuffer): {
  channels: Float32Array[];
  sampleRate: number;
  bitDepth: number;
} {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 44) throw new Error('WAV too short');
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== 'RIFF' || wave !== 'WAVE') throw new Error('Not a RIFF/WAVE file');

  let offset = 12;
  let numChannels = 0;
  let sampleRate = 0;
  let bitDepth = 0;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      numChannels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitDepth = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataSize = size;
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!numChannels || !sampleRate || !bitDepth || dataOffset < 0) {
    throw new Error('WAV missing fmt/data');
  }
  if (bitDepth !== 16 && bitDepth !== 24) {
    throw new Error(`Unsupported bit depth ${bitDepth}`);
  }

  const bytesPerSample = bitDepth / 8;
  const frameBytes = bytesPerSample * numChannels;
  const nFrames = Math.floor(dataSize / frameBytes);
  const channels: Float32Array[] = Array.from({ length: numChannels }, () => new Float32Array(nFrames));
  let o = dataOffset;
  for (let i = 0; i < nFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      let s: number;
      if (bitDepth === 16) {
        s = view.getInt16(o, true) / 0x8000;
        o += 2;
      } else {
        const b0 = view.getUint8(o);
        const b1 = view.getUint8(o + 1);
        const b2 = view.getUint8(o + 2);
        o += 3;
        let v = b0 | (b1 << 8) | (b2 << 16);
        if (v & 0x800000) v |= ~0xffffff;
        s = v / 0x800000;
      }
      channels[c]![i] = s;
    }
  }
  return { channels, sampleRate, bitDepth };
}

/** Re-encode a WAV Blob to 16 or 24-bit PCM when the header differs (Sketch export choice). */
export async function ensureWavBitDepth(blob: Blob, bitDepth: 16 | 24): Promise<Blob> {
  const ab = await blob.arrayBuffer();
  if (ab.byteLength >= 36) {
    const view = new DataView(ab);
    const headerDepth = view.getUint16(34, true);
    if (headerDepth === bitDepth) return blob;
  }
  const decoded = decodeWavChannels(ab);
  return encodeWav(decoded.channels, decoded.sampleRate, bitDepth);
}
