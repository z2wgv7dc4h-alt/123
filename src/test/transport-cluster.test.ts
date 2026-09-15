/**
 * UI-1 (superseded by UI-5): Generate · Vary sit in one contiguous cluster in
 * the top action bar with the same handlers. SSR-renders the real
 * TransportBar (node env, no DOM) and checks button order; HelpTip `?`
 * buttons are ignored.
 *
 * UI-5: Play and Stop moved off the top bar onto the waveform card as
 * compact icon controls (`btn-play-compact` / `btn-stop-compact`), same
 * `play`/`stop` store handlers as before. TransportBar is asserted to no
 * longer render them; Waveform's source is checked for the relocated wiring
 * (rendering the real Waveform needs a decoded audio buffer, out of scope
 * here — source-level checks match the pattern already used below for
 * TransportBar's handler wiring).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import transportSrc from '../ui/components/TransportBar.tsx?raw';
import waveformSrc from '../ui/components/Waveform.tsx?raw';
import { TransportBar } from '../ui/components/TransportBar';

// SSR reads zustand's *initial* state (server snapshot), so setState() is
// invisible to renderToStaticMarkup. Feed selectors live state + overrides.
const overrides = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../ui/hooks/useStudioStore', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../ui/hooks/useStudioStore')>();
  const hook = (sel: (s: unknown) => unknown) =>
    sel({ ...orig.useStudioStore.getState(), ...overrides.current });
  return { ...orig, useStudioStore: Object.assign(hook, orig.useStudioStore) };
});

const fakeResult = {
  jobId: 'ui1_cluster',
  seed: 1,
  bpmMeasured: 174,
  backendId: 'offline-stub',
  checkpointId: 'none',
  warnings: [],
  stems: [{ id: 'mix', url: 'blob:x', channels: 2, sampleRateHz: 48000, bitDepth: 16, durationSec: 44 }],
  structure: { bars: 32, sections: [{ name: 'drop', startBar: 0, lengthBars: 32 }] },
  manifest: { prompt: { energy: 0.75 }, structureVersion: 'hard-grid-v0' },
};

/** Transport button classes in DOM order, minus HelpTip buttons. */
function transportButtons(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<button[^>]*class="([^"]*)"/g)) {
    const cls = m[1]!;
    if (cls.includes('help-tip-btn')) continue;
    const key = ['btn-play', 'btn-stop', 'btn-generate', 'btn-vary-primary', 'btn-export'].find((k) =>
      cls.split(/\s+/).includes(k),
    );
    out.push(key ?? cls);
  }
  return out;
}

function clusterHtml(html: string): string {
  const start = html.indexOf('class="transport-cluster"');
  expect(start, 'transport-cluster group must exist').toBeGreaterThan(-1);
  // Everything up to the first control that is not part of the cluster.
  const exportAt = html.indexOf('btn-export', start);
  return html.slice(start, exportAt === -1 ? undefined : exportAt);
}

describe('UI-5 top bar: Generate/Vary only, Play/Stop moved to the waveform card', () => {
  afterEach(() => {
    overrides.current = {};
  });

  it('after listening: Generate, Vary are adjacent and in order; no Play/Stop in the top bar', () => {
    overrides.current = { result: fakeResult, flowStep: 'played', previewState: 'stopped' };
    const html = renderToStaticMarkup(createElement(TransportBar));
    const order = transportButtons(html);
    expect(order).not.toContain('btn-play');
    expect(order).not.toContain('btn-stop');

    const inCluster = transportButtons(clusterHtml(html));
    expect(inCluster).toEqual(['btn-generate', 'btn-vary-primary']);
  });

  it('before any result: Generate alone in the cluster (Vary gate unchanged)', () => {
    const html = renderToStaticMarkup(createElement(TransportBar));
    expect(transportButtons(clusterHtml(html))).toEqual(['btn-generate']);
    expect(html).not.toContain('btn-play');
    expect(html).not.toContain('btn-stop');
  });

  it('keeps the same store handlers on Generate/Vary', () => {
    expect(transportSrc).toMatch(/className=\{`btn primary btn-generate[\s\S]*?onClick=\{\(\) => void generate\(\)\}/);
    expect(transportSrc).toMatch(/className="btn accent btn-vary-primary"[\s\S]*?onClick=\{\(\) => void vary\(\)\}/);
    expect(transportSrc).toMatch(/const generate = useStudioStore\(\(s\) => s\.generate\)/);
    expect(transportSrc).toMatch(/const vary = useStudioStore\(\(s\) => s\.vary\)/);
    // Play/Stop no longer live here (moved to the waveform card).
    expect(transportSrc).not.toMatch(/const play = useStudioStore/);
    expect(transportSrc).not.toMatch(/const stop = useStudioStore/);
  });
});

describe('UI-5 waveform card: compact Play/Stop + time readout', () => {
  it('renders compact icon controls wired to the same play()/stop() store handlers', () => {
    expect(waveformSrc).toMatch(/className="waveform-transport"/);
    expect(waveformSrc).toMatch(/className="btn tiny ghost btn-play-compact"[\s\S]*?onClick=\{\(\) => void play\(\)\}/);
    expect(waveformSrc).toMatch(/className=\{`btn tiny ghost btn-stop-compact[\s\S]*?onClick=\{\(\) => stop\(\)\}/);
    expect(waveformSrc).toMatch(/const play = useStudioStore\(\(s\) => s\.play\)/);
    expect(waveformSrc).toMatch(/const stop = useStudioStore\(\(s\) => s\.stop\)/);
  });

  it('renders the time readout next to the compact controls', () => {
    expect(waveformSrc).toMatch(/waveform-transport[\s\S]*?transport-clock compact/);
    expect(waveformSrc).toMatch(/formatElapsedTotal\(progress \* durationSec, durationSec\)/);
  });
});
