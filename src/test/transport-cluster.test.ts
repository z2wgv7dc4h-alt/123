/**
 * UI-1: Play · Stop · Generate · Vary sit in one contiguous cluster with the
 * same handlers. SSR-renders the real TransportBar (node env, no DOM) and
 * checks button order; HelpTip `?` buttons are ignored.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import transportSrc from '../ui/components/TransportBar.tsx?raw';
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

describe('UI-1 transport cluster', () => {
  afterEach(() => {
    overrides.current = {};
  });

  it('after listening: Play, Stop, Generate, Vary are adjacent and in order', () => {
    overrides.current = { result: fakeResult, flowStep: 'played', previewState: 'stopped' };
    const html = renderToStaticMarkup(createElement(TransportBar));
    const order = transportButtons(html);
    const i = order.indexOf('btn-play');
    expect(order.slice(i, i + 4)).toEqual(['btn-play', 'btn-stop', 'btn-generate', 'btn-vary-primary']);

    const inCluster = transportButtons(clusterHtml(html));
    expect(inCluster).toEqual(['btn-play', 'btn-stop', 'btn-generate', 'btn-vary-primary']);
  });

  it('before any result: Play, Stop, Generate still adjacent (Vary gate unchanged)', () => {
    const html = renderToStaticMarkup(createElement(TransportBar));
    expect(transportButtons(clusterHtml(html))).toEqual(['btn-play', 'btn-stop', 'btn-generate']);
  });

  it('keeps the same store handlers on each cluster button', () => {
    expect(transportSrc).toMatch(/className=\{`btn btn-play[\s\S]*?onClick=\{\(\) => void play\(\)\}/);
    expect(transportSrc).toMatch(/className=\{`btn btn-stop[\s\S]*?onClick=\{\(\) => stop\(\)\}/);
    expect(transportSrc).toMatch(/className=\{`btn primary btn-generate[\s\S]*?onClick=\{\(\) => void generate\(\)\}/);
    expect(transportSrc).toMatch(/className="btn accent btn-vary-primary"[\s\S]*?onClick=\{\(\) => void vary\(\)\}/);
    expect(transportSrc).toMatch(/const play = useStudioStore\(\(s\) => s\.play\)/);
    expect(transportSrc).toMatch(/const stop = useStudioStore\(\(s\) => s\.stop\)/);
    expect(transportSrc).toMatch(/const generate = useStudioStore\(\(s\) => s\.generate\)/);
    expect(transportSrc).toMatch(/const vary = useStudioStore\(\(s\) => s\.vary\)/);
  });
});
