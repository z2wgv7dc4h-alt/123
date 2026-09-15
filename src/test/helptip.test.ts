import { describe, expect, it } from 'vitest';
import { clampHelpTipCoords, normalizeHelpTipProps } from '../ui/components/HelpTip';
import { HELP, SIMPLE_HELP_KEYS, type HelpKey } from '../ui/lib/helpCopy';

describe('HelpTip normalizeHelpTipProps', () => {
  it('uses text as body when present', () => {
    const r = normalizeHelpTipProps({ text: 'Body A', label: 'Ignored as body', ariaLabel: 'About A' });
    expect(r.body).toBe('Body A');
    expect(r.aria).toBe('About A');
  });

  it('falls back label → body when text omitted (legacy call sites)', () => {
    const r = normalizeHelpTipProps({ label: 'Legacy body', ariaLabel: 'About legacy' });
    expect(r.body).toBe('Legacy body');
    expect(r.aria).toBe('About legacy');
  });

  it('aria = ariaLabel ?? (text ? label : More info)', () => {
    expect(normalizeHelpTipProps({ text: 'T', label: 'L' }).aria).toBe('L');
    expect(normalizeHelpTipProps({ text: 'T' }).aria).toBe('More info');
    expect(normalizeHelpTipProps({ label: 'Only label' }).aria).toBe('More info');
    expect(normalizeHelpTipProps({ text: 'T', label: 'L', ariaLabel: 'A' }).aria).toBe('A');
  });

  it('empty when neither text nor label', () => {
    expect(normalizeHelpTipProps({}).body).toBe('');
  });
});

/** Critic: every tip must use explicit What / When / What happens labels. */
function teachesWhatWhenHappens(text: string): boolean {
  const t = text.trim();
  if (t.length < 40) return false;
  return (
    /\bWhat:\s*\S/i.test(t) &&
    /\bWhen:\s*\S/i.test(t) &&
    /\bWhat happens:\s*\S/i.test(t)
  );
}

describe('HELP copy catalog', () => {
  it('covers P0 wire targets with non-empty plain English', () => {
    const keys = [
      'generate',
      'play',
      'stop',
      'exportZip',
      'styleRef',
      'ownerCheck',
      'vibeIntensity',
      'energyNudge',
      'darknessNudge',
      'flowChips',
      'simpleMode',
      'waveform',
      'sectionTimeline',
      'stems',
      'stemMute',
      'stemSolo',
      'stemGain',
      'remixPreview',
      'remixLive',
      'again',
      'vary',
      'surpriseMe',
      'energy',
      'darkness',
      'chaos',
      'seed',
      'styleText',
      'backendSelect',
      'loraPack',
      'powerPanel',
      'playDisabled',
      'exportDisabled',
      'rehear',
      'paramsDirtyCue',
      'paramsVsMixer',
      'clearStyleRef',
      'exportHeardSingle',
      'exportBitDepth',
      'waveformSeek',
      'sectionJump',
      'mixerUndo',
      'firstPlayCoach',
      'exportDone',
      'seedCopy',
      'stemSoloHotkeys',
      'holdBFlashback',
      'waveformLoop',
      'favoritesNudge',
      'againVaryHotkeys',
      'peakWarnExport',
      'arrangement',
      'badgeAce',
      'backendGpu',
      'productSketch',
      'productStudio',
      'badgeSketch16',
      'studioGated',
      'expandSection',
      'repeatSection',
      'dropX2',
    ] as const satisfies readonly HelpKey[];
    for (const k of keys) {
      expect(HELP[k].length, k).toBeGreaterThan(20);
      expect(HELP[k], k).not.toMatch(/YouTube rip|clone the artist/i);
    }
  });

  it('enforces What/When/What happens structure on every HELP tip', () => {
    for (const k of Object.keys(HELP) as HelpKey[]) {
      const text = HELP[k];
      expect(
        teachesWhatWhenHappens(text),
        `${k} must use What:/When:/What happens: — got: ${text}`,
      ).toBe(true);
    }
  });

  it('Simple-facing tips ≤160 chars and ban eng jargon', () => {
    const banned =
      /OfflineStub|StructureEngine|StructureMap|Tone\.?js|\/probe|CUDA|sidecar|hard-grid|hard grid|LoRA train|stub pack/i;
    for (const k of SIMPLE_HELP_KEYS) {
      expect(HELP[k].length, `${k} length ${HELP[k].length}`).toBeLessThanOrEqual(160);
      expect(HELP[k], k).not.toMatch(banned);
    }
  });

  it('arrangement drops hard-grid jargon', () => {
    expect(HELP.arrangement).not.toMatch(/hard-?grid/i);
  });

  it('badgeAce/backendGpu say local GPU without CUDA/probe/sidecar', () => {
    expect(HELP.badgeAce).not.toMatch(/CUDA|sidecar|\/probe/i);
    expect(HELP.backendGpu).not.toMatch(/CUDA|sidecar|\/probe/i);
    expect(HELP.badgeAce + HELP.backendGpu).toMatch(/GPU/i);
  });

  it('required teaching keys exist', () => {
    for (const k of [
      'paramsVsMixer',
      'clearStyleRef',
      'paramsDirtyCue',
      'playDisabled',
      'exportDisabled',
      'rehear',
      'exportHeardSingle',
    ] as const) {
      expect(HELP[k].length).toBeGreaterThan(40);
    }
  });
});

describe('HelpTip clampHelpTipCoords', () => {
  it('keeps bubble inside narrow 390 viewport', () => {
    const r = clampHelpTipCoords({
      anchor: { left: 5, top: 40, right: 25, bottom: 60, width: 20, height: 20 },
      width: 280,
      height: 80,
      vw: 390,
      vh: 800,
      pad: 8,
    });
    expect(r.left).toBeGreaterThanOrEqual(8);
    expect(r.left + 280).toBeLessThanOrEqual(390 - 8);
  });

  it('keeps bubble inside desktop 1280 near right edge', () => {
    const r = clampHelpTipCoords({
      anchor: { left: 1200, top: 40, right: 1220, bottom: 60, width: 20, height: 20 },
      width: 320,
      height: 90,
      vw: 1280,
      vh: 800,
      pad: 8,
    });
    expect(r.left).toBeGreaterThanOrEqual(8);
    expect(r.left + 320).toBeLessThanOrEqual(1280 - 8);
  });

  it('flips below when not enough space above', () => {
    const r = clampHelpTipCoords({
      anchor: { left: 200, top: 20, right: 220, bottom: 40, width: 20, height: 20 },
      width: 200,
      height: 120,
      vw: 1280,
      vh: 800,
      pad: 8,
    });
    expect(r.placement).toBe('bottom');
    expect(r.top).toBeGreaterThanOrEqual(40);
  });
});

describe('HELP stemMute When nit', () => {
  it('says Click Mute after Generate', () => {
    expect(HELP.stemMute).toMatch(/When:\s*Click Mute after Generate/i);
  });
});
