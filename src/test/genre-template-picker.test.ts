/**
 * Style preset picker above Generate. Clicking a chip fills the style text and
 * knobs (plus song shape when the template has one) — it never generates.
 * SSR-renders the real SimpleWant (node env, no DOM) and exercises the store
 * setters applyPreset uses.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GENRE_TEMPLATES, templateParams } from '../ui/lib/genreTemplates';
import { SimpleWant } from '../ui/components/SimpleWant';
import { useStudioStore } from '../ui/hooks/useStudioStore';

describe('templateParams', () => {
  it('festival-anthem sets supersaw text, energy 0.9 and double-drop shape', () => {
    const p = templateParams('festival-anthem');
    expect(p).toBeTruthy();
    expect(p!.promptText).toContain('supersaw');
    expect(p!.energy).toBe(0.9);
    expect(p!.songShape).toBe('double-drop');
  });

  it('unknown id returns null', () => {
    expect(templateParams('nope')).toBeNull();
  });

  it('liquid-glow has no songShape key', () => {
    const p = templateParams('liquid-glow');
    expect(p).toBeTruthy();
    expect('songShape' in p!).toBe(false);
  });
});

describe('SimpleWant style preset picker', () => {
  it('renders one chip per template, Festival anthem included', () => {
    const html = renderToStaticMarkup(createElement(SimpleWant));
    expect(html).toContain('Festival anthem');
    expect(html).toContain('data-template-id="festival-anthem"');
    expect([...html.matchAll(/data-template-id=/g)]).toHaveLength(GENRE_TEMPLATES.length);
  });

  it('applies festival-anthem params via the store setters without generating', () => {
    const p = templateParams('festival-anthem')!;
    const s = useStudioStore.getState();
    s.setPromptText(p.promptText);
    s.setEnergy(p.energy);
    s.setDarkness(p.darkness);
    s.setChaos(p.chaos);
    if (p.songShape) s.setSongShape(p.songShape);

    const after = useStudioStore.getState();
    expect(after.promptText).toContain('supersaw');
    expect(after.energy).toBe(0.9);
    expect(after.songShape).toBe('double-drop');
    expect(after.busy).toBe(false);
  });
});
