/**
 * P0.2–P0.3: Simple process order — Expand/Layers after Hear only when liveMixerOk.
 * Soft-pass forbidden: cold-load LayersChips before Transport = FAIL.
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

describe('Simple process order (P0.2–P0.3)', () => {
  it('defines liveMixerOk from elemental stems kick|snare|hats|perc|bass', () => {
    expect(appSrc).toMatch(/liveMixerOk/);
    expect(appSrc).toMatch(/ELEMENTAL_STEM_IDS/);
    expect([...ELEMENTAL_STEM_IDS]).toEqual(['kick', 'snare', 'hats', 'perc', 'bass']);
  });

  it('Simple path: no LayersChips before TransportBar', () => {
    const simpleStart = appSrc.indexOf('{/* ========== SIMPLE process path');
    const powerStart = appSrc.indexOf('{/* ========== POWER layout');
    expect(simpleStart).toBeGreaterThan(-1);
    expect(powerStart).toBeGreaterThan(simpleStart);
    const simple = appSrc.slice(simpleStart, powerStart);
    const transportIdx = simple.indexOf('<TransportBar');
    expect(transportIdx).toBeGreaterThan(-1);
    const beforeTransport = simple.slice(0, transportIdx);
    expect(beforeTransport).not.toMatch(/<LayersChips/);
    expect(beforeTransport).not.toMatch(/simple-step-heat/);
  });

  it('gates Expand + Layers after Hear with result && liveMixerOk', () => {
    expect(appSrc).toMatch(/\{result && <Waveform \/>\}/);
    expect(appSrc).toMatch(/\{result && <StemMixerCompact \/>\}/);
    expect(appSrc).toMatch(/\{result && liveMixerOk && <SectionTimeline \/>\}/);
    expect(appSrc).toMatch(/\{result && liveMixerOk && <LayersChips \/>\}/);
  });

  it('moreOpen secondary LayersChips gated on result + liveMixerOk', () => {
    expect(appSrc).toMatch(
      /\{result && liveMixerOk && <LayersChips showSecondary \/>\}/,
    );
  });

  it('Power Expand/Layers gated result && liveMixerOk (no cold Expand)', () => {
    // Critic nit: Power must not mount SectionTimeline / Layers ungated
    expect(appSrc).not.toMatch(/\n\s*<SectionTimeline \/>/);
    expect(appSrc).not.toMatch(/\{result && <LayersChips showSecondary \/>\}/);
    const gated = [...appSrc.matchAll(/\{result && liveMixerOk && <SectionTimeline \/>\}/g)];
    expect(gated.length).toBeGreaterThanOrEqual(2); // Simple + Power
    const gatedLayers = [...appSrc.matchAll(/\{result && liveMixerOk && <LayersChips showSecondary \/>\}/g)];
    expect(gatedLayers.length).toBeGreaterThanOrEqual(2); // moreOpen + Power
  });

  it('SimpleWant placeholder is exact vibe string with unicode ellipsis', () => {
    expect(wantSrc).toContain(
      'placeholder="Describe the vibe (e.g. rock DnB, bright drops…)"',
    );
  });

  it('LayersChips: Needs Studio when !aceHasGpu; honesty hint; no-op when disabled', () => {
    expect(layersSrc).toMatch(/aceHasGpu/);
    expect(layersSrc).toMatch(/Needs Studio/);
    expect(layersSrc).toMatch(/Applies on next Generate · original textures only/);
    expect(layersSrc).toMatch(/if \(disabled\) return/);
    // User-facing: never claim ACE extract/repaint / lego on Sketch chips
    expect(layersSrc).not.toMatch(/(?:label|hint|title|aria)[^\n]*lego/i);
    expect(layersSrc).toMatch(/needsStudio = !aceHasGpu/);
  });
});
