/**
 * Fixture scaffolding: always-on synthetic QA + optional license-clean drops.
 * Empty license-clean/ → skipIf (honest), never soft-pass / invent greens.
 * Does not touch product UI or audio engine.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  analyzeMonoBuffer,
  fingerprintHash,
  isAllowedStyleAudioFile,
  mapVibeToParams,
  vibeFromMono,
} from '../core/styleRef';
import { buildStyleReferenceProvenance } from '../core/export/manifest';
import { offlineStubBackend } from '../core/backends';
import { DEFAULT_BPM } from '../core/types';

const FIXTURES_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');
const SYNTHETIC_WAV = join(FIXTURES_ROOT, 'synthetic', 'qa_style_ref_synthetic.wav');
const LICENSE_CLEAN_DIR = join(FIXTURES_ROOT, 'license-clean');

const AUDIO_EXT = new Set(['.wav', '.mp3']);

function fakeFile(name: string, type = ''): File {
  return { name, type, size: 4 } as File;
}

/** Minimal PCM WAV decode (16/24-bit, mono/stereo) for Node tests — no Web Audio. */
function decodePcmWav(buf: Buffer): { sampleRateHz: number; channels: Float32Array[]; mono: Float32Array } {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let offset = 12;
  let sampleRateHz = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (id === 'fmt ') {
      const audioFormat = buf.readUInt16LE(chunkStart);
      if (audioFormat !== 1) throw new Error(`unsupported WAV format ${audioFormat} (PCM only)`);
      numChannels = buf.readUInt16LE(chunkStart + 2);
      sampleRateHz = buf.readUInt32LE(chunkStart + 4);
      bitsPerSample = buf.readUInt16LE(chunkStart + 14);
    } else if (id === 'data') {
      dataOffset = chunkStart;
      dataSize = size;
      break;
    }
    offset = chunkStart + size + (size % 2);
  }
  if (dataOffset < 0 || !sampleRateHz || !numChannels || !bitsPerSample) {
    throw new Error('incomplete WAV header');
  }
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (numChannels * bytesPerSample));
  const channels: Float32Array[] = Array.from({ length: numChannels }, () => new Float32Array(frameCount));
  let p = dataOffset;
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = 0;
      if (bitsPerSample === 16) {
        sample = buf.readInt16LE(p) / 0x8000;
        p += 2;
      } else if (bitsPerSample === 24) {
        const b0 = buf[p]!;
        const b1 = buf[p + 1]!;
        const b2 = buf[p + 2]!;
        let v = b0 | (b1 << 8) | (b2 << 16);
        if (v & 0x800000) v |= ~0xffffff;
        sample = v / 0x800000;
        p += 3;
      } else {
        throw new Error(`unsupported bit depth ${bitsPerSample}`);
      }
      channels[c]![i] = sample;
    }
  }
  const mono =
    numChannels === 1
      ? channels[0]!.slice()
      : (() => {
          const out = new Float32Array(frameCount);
          for (let i = 0; i < frameCount; i++) {
            let s = 0;
            for (let c = 0; c < numChannels; c++) s += channels[c]![i] ?? 0;
            out[i] = s / numChannels;
          }
          return out;
        })();
  return { sampleRateHz, channels, mono };
}

function discoverLicenseCleanAudio(): string[] {
  let names: string[] = [];
  try {
    names = readdirSync(LICENSE_CLEAN_DIR);
  } catch {
    return [];
  }
  return names
    .filter((n) => AUDIO_EXT.has(extname(n).toLowerCase()))
    .map((n) => join(LICENSE_CLEAN_DIR, n))
    .filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

const licenseCleanFiles = discoverLicenseCleanAudio();
const licenseCleanEmpty = licenseCleanFiles.length === 0;
const LICENSE_CLEAN_SKIP_REASON =
  'no license-clean WAV/MP3 dropped yet — optional block skipped (never soft-pass)';

describe('synthetic QA fixture (always on)', () => {
  it('qa_style_ref_synthetic.wav is readable and decodes', () => {
    const raw = readFileSync(SYNTHETIC_WAV);
    expect(raw.length).toBeGreaterThan(1000);
    expect(raw.toString('ascii', 0, 4)).toBe('RIFF');
    const { sampleRateHz, mono } = decodePcmWav(raw);
    expect(sampleRateHz).toBeGreaterThan(8000);
    expect(mono.length).toBeGreaterThan(sampleRateHz); // >1s
  });

  it('analyze + vibeFromMono + fingerprint are stable (no invented BPM ownership)', () => {
    const raw = readFileSync(SYNTHETIC_WAV);
    const { sampleRateHz, mono } = decodePcmWav(raw);
    const fileName = 'qa_style_ref_synthetic.wav';
    const fpSrc = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);

    const analysis = analyzeMonoBuffer(mono, sampleRateHz, 1);
    expect(analysis.durationSec).toBeGreaterThan(1);
    expect(analysis.energy).toBeGreaterThan(0);
    expect(analysis.peak).toBeGreaterThan(0);
    expect(analysis.sampleRateHz).toBe(sampleRateHz);

    const vibeA = vibeFromMono(mono, sampleRateHz, { fileName, fingerprintSource: fpSrc });
    const vibeB = vibeFromMono(mono, sampleRateHz, { fileName, fingerprintSource: fpSrc });
    expect(vibeA).toEqual(vibeB);
    expect(vibeA.fileName).toBe(fileName);
    expect(vibeA.fingerprintHash).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprintHash(fpSrc, fileName)).toBe(vibeA.fingerprintHash);

    const mapped = mapVibeToParams(vibeA, { energy: 0.5, darkness: 0.4, chaos: 0.2 }, 0.8);
    expect(mapped).not.toHaveProperty('bpm');
    expect(Object.keys(mapped).sort()).toEqual(['barsBias', 'chaos', 'darkness', 'energy']);
    expect(DEFAULT_BPM).toBe(174);
  });

  it('OfflineStub + synthetic vibe: structure keeps 174 BPM; provenance userOwned, no ACE claim', async () => {
    const raw = readFileSync(SYNTHETIC_WAV);
    const { sampleRateHz, mono } = decodePcmWav(raw);
    const fileName = 'qa_style_ref_synthetic.wav';
    const fpSrc = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    const vibe = vibeFromMono(mono, sampleRateHz, { fileName, fingerprintSource: fpSrc });
    const mapped = mapVibeToParams(vibe, { energy: 0.5, darkness: 0.4, chaos: 0.2 }, 0.7);

    const prov = buildStyleReferenceProvenance(
      {
        jobId: 'synth_fixture',
        seed: 174,
        bpm: DEFAULT_BPM,
        bpmTolerance: 2,
        durationBars: 16,
        sampleRateHz: 48000,
        bitDepth: 16,
        channels: 2,
        prompt: { descriptors: ['fixture'], energy: mapped.energy, darkness: mapped.darkness },
        stemSchemaVersion: 'v0',
        styleReference: {
          intensity: 0.7,
          estimatedBpm: vibe.estimatedBpm,
          energy: vibe.energy,
          fileName: vibe.fileName,
          ownerAttested: true,
          hash: vibe.fingerprintHash,
        },
      },
      { acePathActive: false, backendId: 'offline-stub' },
    );
    expect(prov?.used).toBe(true);
    expect(prov?.userOwned).toBe(true);
    expect(prov?.acePathActive).toBe(false);
    expect(prov?.source).toBe('user-upload');
    expect(prov?.note.toLowerCase()).not.toMatch(/stems came from ace|ace produced these stems/);

    const result = await offlineStubBackend.render({
      jobId: 'synth_fixture_render',
      seed: 174,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 16,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: {
        descriptors: ['fixture'],
        energy: mapped.energy,
        darkness: mapped.darkness,
        chaos: mapped.chaos,
      },
      stemSchemaVersion: 'v0',
      styleReference: {
        intensity: 0.7,
        estimatedBpm: vibe.estimatedBpm,
        energy: vibe.energy,
        fileName: vibe.fileName,
        ownerAttested: true,
        hash: vibe.fingerprintHash,
      },
    });
    expect(result.bpmMeasured).toBe(174);
    expect(result.manifest.styleReference?.userOwned).toBe(true);
    expect(result.manifest.styleReference?.acePathActive).toBe(false);
    expect(result.manifest.styleReference?.hash).toBe(vibe.fingerprintHash);
    expect(result.backendId).toBe('offline-stub');
  });
});

describe.skipIf(licenseCleanEmpty)(
  `license-clean user fixtures (${LICENSE_CLEAN_SKIP_REASON})`,
  () => {
    it('discovers at least one WAV/MP3 under fixtures/license-clean', () => {
      expect(licenseCleanFiles.length).toBeGreaterThan(0);
    });

    for (const path of licenseCleanFiles) {
      const name = basename(path);
      const ext = extname(name).toLowerCase();

      it(`${name}: allowlist accept`, () => {
        const mime =
          ext === '.mp3' ? 'audio/mpeg' : ext === '.wav' ? 'audio/wav' : '';
        expect(isAllowedStyleAudioFile(fakeFile(name, mime))).toBe(true);
      });

      it(`${name}: readable + analyze (wav) / fingerprint (any) + provenance honesty`, async () => {
        const raw = readFileSync(path);
        expect(raw.length).toBeGreaterThan(100);
        const fpSrc = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
        const hash = fingerprintHash(fpSrc, name);
        expect(hash).toMatch(/^[0-9a-f]{8}$/);

        let estimatedBpm: number | null = null;
        let energy = 0.5;

        if (ext === '.wav') {
          const { sampleRateHz, mono } = decodePcmWav(raw);
          const analysis = analyzeMonoBuffer(mono, sampleRateHz, 1);
          expect(analysis.durationSec).toBeGreaterThan(0);
          expect(analysis.energy).toBeGreaterThanOrEqual(0);
          const vibe = vibeFromMono(mono, sampleRateHz, {
            fileName: name,
            fingerprintSource: fpSrc,
          });
          expect(vibe.fingerprintHash).toBe(hash);
          expect(vibe.fileName).toBe(name);
          const mapped = mapVibeToParams(vibe, { energy: 0.5, darkness: 0.4, chaos: 0.2 }, 0.8);
          expect(mapped).not.toHaveProperty('bpm');
          estimatedBpm = vibe.estimatedBpm;
          energy = vibe.energy;
        }

        const prov = buildStyleReferenceProvenance(
          {
            jobId: `lc_${name}`,
            seed: 1,
            bpm: DEFAULT_BPM,
            bpmTolerance: 2,
            durationBars: 16,
            sampleRateHz: 48000,
            bitDepth: 16,
            channels: 2,
            prompt: { descriptors: ['license-clean'], energy, darkness: 0.4 },
            stemSchemaVersion: 'v0',
            styleReference: {
              intensity: 0.8,
              estimatedBpm,
              energy,
              fileName: name,
              ownerAttested: true,
              hash,
            },
          },
          { acePathActive: false, backendId: 'offline-stub' },
        );
        expect(prov?.used).toBe(true);
        expect(prov?.userOwned).toBe(true);
        expect(prov?.acePathActive).toBe(false);
        expect(prov?.fileName).toBe(name);
        expect(prov?.ownerAttested).toBe(true);
        expect(prov?.hash).toBe(hash);
        expect(prov?.note.toLowerCase()).toMatch(/offline.?stub|not ace/);
      });
    }
  },
);

// When the folder is empty, surface one skipped test with an explicit reason (not a green).
if (licenseCleanEmpty) {
  it.skip(LICENSE_CLEAN_SKIP_REASON, () => {
    // Intentionally skipped — drop user-owned WAV/MP3 to enable the block above.
  });
}
