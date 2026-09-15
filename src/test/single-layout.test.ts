/**
 * UI-2: one layout. No Simple/Power toggle, no component branching on a
 * layout mode, no numbered step labels, and saved state that still carries
 * `mode` is ignored (the HMR restore never reads it).
 */
import { describe, expect, it } from 'vitest';
import appSrc from '../App.tsx?raw';
import storeSrc from '../ui/hooks/useStudioStore.ts?raw';
import uiMessagesSrc from '../core/uiMessages.ts?raw';

const uiSources = import.meta.glob<string>('../ui/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('UI-2 single layout', () => {
  it('App has no Simple/Power toggle or layout branch', () => {
    expect(appSrc).not.toMatch(/isSimple|setMode|s\.mode\b|layout-toggle|mode-power-btn/);
    expect(appSrc).not.toMatch(/>\s*(Simple|Power)\s*</);
    expect(appSrc).not.toMatch(/SIMPLE process path|POWER layout/);
  });

  it('no UI file reads a layout mode', () => {
    expect(Object.keys(uiSources).length).toBeGreaterThan(10);
    for (const [path, src] of Object.entries(uiSources)) {
      expect(src, path).not.toMatch(/s\.mode\b|isSimple|AppMode|setMode/);
    }
  });

  it('no numbered step labels (1 · Generate / 2 · Play / 3 · Export …)', () => {
    const step = /\b[0-3] · (Generate|Play|Export|Style Ref)/;
    for (const [path, src] of Object.entries({ ...uiSources, 'core/uiMessages.ts': uiMessagesSrc })) {
      expect(src, path).not.toMatch(step);
    }
  });

  it('no numbered wizard bubbles (UI-6: step-num)', () => {
    for (const [path, src] of Object.entries(uiSources)) {
      expect(src, path).not.toMatch(/step-num/);
    }
  });

  it('saved state carrying `mode` is ignored on restore', () => {
    expect(storeSrc).not.toMatch(/saved\.mode/);
    expect(storeSrc).not.toMatch(/\bmode: s\.mode\b/);
  });
});
