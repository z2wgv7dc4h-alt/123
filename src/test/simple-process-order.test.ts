/**
 * App process order — one layout (UI-2). Listen first: transport → waveform →
 * song map; everything else mounts only behind the single More toggle.
 * Soft-pass forbidden: an extra mounted before the More toggle = FAIL.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ELEMENTAL_STEM_IDS } from '../ui/hooks/useStudioStore';

const here = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(resolve(here, '../App.tsx'), 'utf8');
const wantSrc = readFileSync(resolve(here, '../ui/components/SimpleWant.tsx'), 'utf8');
const layersSrc = readFileSync(resolve(here, '../ui/components/LayersChips.tsx'), 'utf8');

describe('App process order (one layout)', () => {
  it('defines liveMixerOk from elemental stems kick|snare|hats|perc|bass', () => {
    expect(appSrc).toMatch(/liveMixerOk/);
    expect(appSrc).toMatch(/ELEMENTAL_STEM_IDS/);
    expect([...ELEMENTAL_STEM_IDS]).toEqual(['kick', 'snare', 'hats', 'perc', 'bass']);
  });

  it('transport, then waveform, then song map, then the More toggle', () => {
    const at = (s: string) => appSrc.indexOf(s);
    expect(at('<TransportBar')).toBeGreaterThan(-1);
    expect(at('<Waveform')).toBeGreaterThan(at('<TransportBar'));
    expect(at('<SectionTimeline')).toBeGreaterThan(at('<Waveform'));
    expect(at('more-toggle-row')).toBeGreaterThan(at('<SectionTimeline'));
  });

  it('style ref, layers, mixer and panels mount only behind More', () => {
    const moreStart = appSrc.indexOf('{moreOpen && (');
    expect(moreStart).toBeGreaterThan(appSrc.indexOf('more-toggle-row'));
    const beforeMore = appSrc.slice(0, moreStart);
    const insideMore = appSrc.slice(moreStart);
    for (const tag of [
      '<StyleDropZone',
      '<LayersChips',
      '<StemMixer',
      '<ParamPanel',
      '<SurpriseMeButton',
      '<FavoritesPanel',
      '<ProductTierPanel',
      '<HelpPanel',
      '<PowerExtras',
    ]) {
      expect(beforeMore, tag).not.toContain(tag);
      expect(insideMore, tag).toContain(tag);
    }
  });

  it('UI-6: style text + song shape sit above Generate, before the More toggle', () => {
    const at = (s: string) => appSrc.indexOf(s);
    expect(at('<SimpleWant')).toBeGreaterThan(-1);
    expect(at('<SongShapePicker')).toBeGreaterThan(at('<SimpleWant'));
    expect(at('<TransportBar')).toBeGreaterThan(at('<SongShapePicker'));
    expect(at('more-toggle-row')).toBeGreaterThan(at('<TransportBar'));
    // Intent mounts once each — no duplicate behind More
    expect([...appSrc.matchAll(/<SimpleWant \/>/g)]).toHaveLength(1);
    expect([...appSrc.matchAll(/<SongShapePicker \/>/g)]).toHaveLength(1);
  });

  it('gates waveform, song map, layers and compact mixer on result (+ liveMixerOk)', () => {
    expect(appSrc).toMatch(/\{result && <Waveform \/>\}/);
    expect(appSrc).toMatch(/\{result && <StemMixerCompact \/>\}/);
    expect(appSrc).toMatch(/\{result && liveMixerOk && <SectionTimeline \/>\}/);
    expect(appSrc).toMatch(/\{result && liveMixerOk && <LayersChips showSecondary \/>\}/);
    // One mount each — no ungated / duplicate second tree
    expect(appSrc).not.toMatch(/\n\s*<SectionTimeline \/>/);
    expect([...appSrc.matchAll(/<SectionTimeline \/>/g)]).toHaveLength(1);
    expect([...appSrc.matchAll(/<LayersChips/g)]).toHaveLength(1);
    expect([...appSrc.matchAll(/<TransportBar \/>/g)]).toHaveLength(1);
  });

  it('SimpleWant placeholder is exact vibe string with unicode ellipsis', () => {
    expect(wantSrc).toContain(
      'placeholder="Describe the vibe (e.g. rock DnB, bright drops…)"',
    );
  });

  it('LayersChips: Needs Studio only for ACE-only layers (guitar/solo/extraDrums run in Sketch); honesty hint; no-op when disabled', () => {
    expect(layersSrc).toMatch(/aceHasGpu/);
    expect(layersSrc).toMatch(/Needs Studio/);
    expect(layersSrc).toMatch(/Applies on next Generate · original textures only/);
    expect(layersSrc).toMatch(/if \(disabled\) return/);
    // User-facing: never claim ACE extract/repaint / lego on Sketch chips
    expect(layersSrc).not.toMatch(/(?:label|hint|title|aria)[^\n]*lego/i);
    // Guitar/solo/extraDrums are pure CPU synthesis (OfflineStubBackend) — must
    // NOT be blanket-gated behind aceHasGpu. Only the ACE-caption-only layer
    // (vocal-ish) stays Studio-gated.
    expect(layersSrc).toMatch(/CPU_CAPABLE/);
    expect(layersSrc).toMatch(/needsStudio = !CPU_CAPABLE\.has\(d\.key\) && !aceHasGpu/);
  });
});
