import type { ExportManifest, RenderResult, StemFile } from '../types';
import { ensureWavBitDepth } from './wav';
import { blobToUint8, buildZip, type ZipEntry } from './zip';
import { buildSketchNotes, type SketchNotesInput } from './sketchNotes';

export function downloadBlob(blob: Blob, filename: string) {
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadStemWav(stem: StemFile, prefix = 'dnb') {
  if (!stem.blob) throw new Error(`Stem ${stem.id} has no blob`);
  triggerDownload(stem.blob, `${prefix}_${stem.id}.wav`);
}

export function downloadManifest(manifest: ExportManifest, prefix = 'dnb') {
  const json = JSON.stringify(manifest, null, 2);
  triggerDownload(new Blob([json], { type: 'application/json' }), `${prefix}_manifest.json`);
}

export function downloadMidi(midiBlob: Blob, prefix = 'dnb') {
  triggerDownload(midiBlob, `${prefix}_structure.mid`);
}

export type ExportZipOpts = {
  asHeardMix?: Blob;
  /** Sketch export bit depth — re-encodes stem/heard WAVs; patches manifest.bitDepth. */
  bitDepth?: 16 | 24;
  /** #85 sketch_notes.txt — omit to auto-build from result + bitDepth/asHeard. */
  sketchNotes?: string | SketchNotesInput;
};

/**
 * Build the full ZIP entry list (pure, testable): mastered mix, raw float mix,
 * every stem, manifest, MIDI and sketch notes.
 */
export async function buildExportEntries(
  result: RenderResult,
  prefix?: string,
  opts?: ExportZipOpts,
): Promise<ZipEntry[]> {
  const p = prefix ?? `dnb_${result.seed}`;
  const bitDepth = opts?.bitDepth ?? 16;
  const entries: ZipEntry[] = [];
  const mixFile = `${p}_mix_mastered.wav`;
  const rawFile = `${p}_mix_raw.wav`;

  // Mastered mix is what Play hears (mix stem), re-encoded to the export depth.
  const mixStem = result.stems.find((s) => s.id === 'mix');
  if (mixStem?.blob) {
    const mastered = await ensureWavBitDepth(mixStem.blob, bitDepth);
    entries.push({ name: mixFile, data: await blobToUint8(mastered) });
  }
  // Raw ACE mix stays byte-for-byte (32-bit float as returned) for remastering.
  if (result.rawMixBlob) {
    entries.push({ name: rawFile, data: await blobToUint8(result.rawMixBlob) });
  }

  for (const stem of result.stems) {
    if (!stem.blob) continue;
    const wav = await ensureWavBitDepth(stem.blob, bitDepth);
    entries.push({ name: `${p}_${stem.id}.wav`, data: await blobToUint8(wav) });
  }

  if (opts?.asHeardMix) {
    const heard = await ensureWavBitDepth(opts.asHeardMix, bitDepth);
    entries.push({ name: `${p}_mix_as_heard.wav`, data: await blobToUint8(heard) });
  }

  const manifest: ExportManifest = {
    ...result.manifest,
    bitDepth,
    mixFiles: { mastered: mixFile, raw: rawFile },
  };
  const manifestJson = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  entries.push({ name: `${p}_manifest.json`, data: manifestJson });

  if (result.midiBlob) {
    entries.push({ name: `${p}_structure.mid`, data: await blobToUint8(result.midiBlob) });
  }

  // #85 sketch_notes.txt — always include (browser-sketch honesty; no artist names)
  {
    const notesText =
      typeof opts?.sketchNotes === 'string'
        ? opts.sketchNotes
        : buildSketchNotes(
            opts?.sketchNotes ?? {
              seed: result.seed,
              bpm: result.bpmMeasured || result.manifest.bpmMeasured || 174,
              bars: result.structure?.bars ?? 0,
              energy: result.manifest.prompt?.energy ?? 0,
              darkness: result.manifest.prompt?.darkness ?? 0,
              chaos: 0,
              bitDepth,
              mixAsHeard: Boolean(opts?.asHeardMix),
              promptText: result.manifest.prompt?.text,
            },
          );
    entries.push({
      name: 'sketch_notes.txt',
      data: new TextEncoder().encode(notesText),
    });
  }
  return entries;
}

/** Bundle stems + manifest + MIDI into one ZIP download. */
export async function exportZip(
  result: RenderResult,
  prefix?: string,
  opts?: ExportZipOpts,
): Promise<void> {
  const p = prefix ?? `dnb_${result.seed}`;
  const entries = await buildExportEntries(result, prefix, opts);
  if (!entries.length) throw new Error('Nothing to export');
  triggerDownload(buildZip(entries), `${p}_export.zip`);
}

/** Download all stems + manifest + MIDI as a single ZIP (preferred). */
export function exportAll(result: RenderResult, prefix?: string, bitDepth: 16 | 24 = 16) {
  void exportZip(result, prefix, { bitDepth }).catch((e) => {
    console.error('Zip export failed, falling back to individual downloads', e);
    const p = prefix ?? `dnb_${result.seed}`;
    void (async () => {
      for (const stem of result.stems) {
        if (!stem.blob) continue;
        const wav = await ensureWavBitDepth(stem.blob, bitDepth);
        triggerDownload(wav, `${p}_${stem.id}.wav`);
      }
      const manifest: ExportManifest = { ...result.manifest, bitDepth };
      downloadManifest(manifest, p);
      if (result.midiBlob) downloadMidi(result.midiBlob, p);
    })();
  });
}
