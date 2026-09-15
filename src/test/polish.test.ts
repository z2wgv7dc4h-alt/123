import { afterEach, describe, expect, it } from 'vitest';
import { computeWaveformPeaks, bufferRms } from '../core/audio/waveformPeaks';
import { formatStudioError } from '../core/uiMessages';
import {
  __resetToastsForTests,
  dismissToast,
  dismissToastsByKind,
  getToasts,
  pushToast,
  subscribeToasts,
} from '../ui/lib/toasts';
import { offlineStubBackend } from '../core/backends';
import { DEFAULT_BPM } from '../core/types';

describe('polish: waveform peaks', () => {
  it('downsamples to N buckets and normalizes', () => {
    const mono = new Float32Array(1000);
    for (let i = 0; i < 100; i++) mono[i] = 0.5;
    for (let i = 500; i < 520; i++) mono[i] = -1;
    const peaks = computeWaveformPeaks(mono, 10);
    expect(peaks).toHaveLength(10);
    expect(Math.max(...peaks)).toBeCloseTo(1, 5);
    expect(peaks.some((p) => p > 0.9)).toBe(true);
    expect(peaks.some((p) => p < 0.2)).toBe(true);
  });

  it('empty buffer yields zeros', () => {
    const peaks = computeWaveformPeaks(new Float32Array(0), 8);
    expect(peaks).toHaveLength(8);
    expect(peaks.every((p) => p === 0)).toBe(true);
  });
});

describe('polish: error clarity', () => {
  it('maps ACE GPU errors to actionable local-GPU / browser-sketch copy', () => {
    const msg = formatStudioError(
      'ACE-Step 1.5 requires a local GPU sidecar (CUDA). This browser build has no PyTorch/CUDA runtime.',
    );
    expect(msg).toMatch(/5080|GPU/i);
    expect(msg).toMatch(/browser sketch|Sketch/i);
    expect(msg).not.toMatch(/OfflineStub/i);
    expect(msg.length).toBeGreaterThan(40);
  });

  it('maps muted-stem and generate-first cases', () => {
    expect(formatStudioError('All stems muted — unmute one to preview.')).toMatch(/unmute/i);
    expect(formatStudioError('Generate first, then export.')).toMatch(/Generate/i);
  });
});

describe('polish: OfflineStub punchier sketch', () => {
  it('render returns non-silent mix + waveformPeaks', async () => {
    const result = await offlineStubBackend.render({
      jobId: 'polish_stub',
      seed: 17400,
      bpm: DEFAULT_BPM,
      bpmTolerance: 2,
      durationBars: 16,
      sampleRateHz: 48000,
      bitDepth: 16,
      channels: 2,
      prompt: { descriptors: ['test'], energy: 0.8, darkness: 0.5, chaos: 0.3 },
      stemSchemaVersion: 'v0',
    });
    expect(result.waveformPeaks?.length).toBeGreaterThan(32);
    expect(Math.max(...(result.waveformPeaks ?? [0]))).toBeGreaterThan(0.5);
    const mix = result.stems.find((s) => s.id === 'mix');
    expect(mix?.blob?.size).toBeGreaterThan(1000);
    // Peak metric honesty (P0.1): OfflineStub reports sample-peak, never claims true-peak.
    expect(mix?.peakMetric).toBe('sample-peak');
    expect(mix?.samplePeakDbFS).toBeDefined();
    expect(Number.isFinite(mix!.samplePeakDbFS!)).toBe(true);
    expect(mix!.samplePeakDbFS!).toBeGreaterThan(-40);
    // Legacy dual-written field still present and equal to the honest one.
    expect(mix?.truePeakDbTP).toBe(mix?.samplePeakDbFS);
    // Kick / snare / bass stems exist
    for (const id of ['kick', 'snare', 'bass'] as const) {
      const stem = result.stems.find((s) => s.id === id);
      expect(stem?.blob?.size).toBeGreaterThan(500);
    }
  });

  it('bufferRms reports energy on a sine', () => {
    const n = 2048;
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = Math.sin((2 * Math.PI * i) / 32);
    expect(bufferRms(buf)).toBeGreaterThan(0.5);
  });
});


describe('polish: toast bus', () => {
  afterEach(() => {
    __resetToastsForTests();
  });

  it('caps stack at 3 and newest success wins', () => {
    pushToast('a', 'info', 0);
    pushToast('b', 'info', 0);
    pushToast('c', 'info', 0);
    pushToast('d', 'info', 0);
    expect(getToasts()).toHaveLength(3);
    expect(getToasts().map((x) => x.message)).toEqual(['b', 'c', 'd']);
    pushToast('s1', 'success', 0);
    pushToast('s2', 'success', 0);
    expect(getToasts().filter((x) => x.kind === 'success')).toHaveLength(1);
    expect(getToasts().find((x) => x.kind === 'success')!.message).toBe('s2');
  });

  it('pushToast / subscribe / dismiss keep one source of truth', () => {
    const seen: string[][] = [];
    const unsub = subscribeToasts((list) => seen.push(list.map((t) => t.message)));
    const id = pushToast('Sketch ready', 'success', 0);
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]!.kind).toBe('success');
    dismissToast(id);
    expect(getToasts()).toHaveLength(0);
    dismissToastsByKind('error'); // no-op
    pushToast('boom', 'error', 0);
    pushToast('warn', 'warn', 0);
    dismissToastsByKind('error');
    expect(getToasts().every((t) => t.kind !== 'error')).toBe(true);
    unsub();
    expect(seen.length).toBeGreaterThan(2);
  });

  it('caps visible stack to 3 and newest success wins', () => {
    pushToast('a', 'info', 0);
    pushToast('b', 'info', 0);
    pushToast('c', 'info', 0);
    pushToast('d', 'info', 0);
    expect(getToasts()).toHaveLength(3);
    expect(getToasts().map((t) => t.message)).toEqual(['b', 'c', 'd']);
    pushToast('ok1', 'success', 0);
    pushToast('ok2', 'success', 0);
    const successes = getToasts().filter((t) => t.kind === 'success');
    expect(successes).toHaveLength(1);
    expect(successes[0]!.message).toBe('ok2');
    expect(getToasts().length).toBeLessThanOrEqual(3);
  });
});
