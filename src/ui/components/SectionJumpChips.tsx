import { useStudioStore } from '../hooks/useStudioStore';
import { sectionLoopRatios, sectionStartRatio } from '../lib/barPosition';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

/**
 * Generate labels for section jump chips, with duplicate names numbered.
 * E.g., ["intro", "build", "drop", "breakdown", "build", "drop", "outro"]
 * → ["Intro", "Build 1", "Drop 1", "Breakdown", "Build 2", "Drop 2", "Outro"]
 */
export function jumpChipLabels(sections: { name: string }[]): string[] {
  const nameCounts = new Map<string, number>();
  const nameIndices = new Map<string, number>();

  // Count occurrences of each name
  for (const s of sections) {
    nameCounts.set(s.name, (nameCounts.get(s.name) ?? 0) + 1);
  }

  // Generate labels
  return sections.map((s) => {
    const currentIndex = (nameIndices.get(s.name) ?? 0) + 1;
    nameIndices.set(s.name, currentIndex);

    const base = s.name.charAt(0).toUpperCase() + s.name.slice(1);
    const count = nameCounts.get(s.name) ?? 0;
    return count > 1 ? `${base} ${currentIndex}` : base;
  });
}

/**
 * #41 Section jump chips under waveform (Simple-visible, off primary row).
 * Chip → seek to section start; if already playing, seek continues playback.
 * #59 Double-click → loop that section (does not steal single-click seek / wave drag).
 */
export function SectionJumpChips() {
  const result = useStudioStore((s) => s.result);
  const seekPreview = useStudioStore((s) => s.seekPreview);
  const setLoopRegion = useStudioStore((s) => s.setLoopRegion);
  const loopCurrentSection = useStudioStore((s) => s.loopCurrentSection);
  const loopRegion = useStudioStore((s) => s.loopRegion);
  const sections = result?.structure?.sections;
  const bars = result?.structure?.bars ?? 0;

  if (!sections?.length || bars <= 0) return null;

  const labels = jumpChipLabels(sections);

  return (
    <div className="section-jump" role="group" aria-label="Jump to section">
      <span className="section-jump-label label-with-tip">
        <span className="label-with-tip-text">Jump</span>
        <HelpTip text={HELP.sectionJump} ariaLabel="About section jump" />
      </span>
      <div className="section-jump-chips">
        {sections.map((s, idx) => {
          const ratio = sectionStartRatio(s.startBar, bars);
          const label = labels[idx];
          return (
            <button
              key={`${s.name}-${s.startBar}`}
              type="button"
              className="btn tiny ghost section-jump-chip"
              title={`${label} · bar ${s.startBar} · double-click to loop`}
              aria-label={`Jump to ${label}`}
              onClick={() => seekPreview(ratio)}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const loop = sectionLoopRatios(s.startBar, s.lengthBars, bars);
                if (loop) setLoopRegion(loop.start, loop.end);
              }}
            >
              {label}
            </button>
          );
        })}
        {/* #87 Loop mini-chip — jump-row only */}
        <button
          type="button"
          className={`btn tiny ghost section-jump-loop-chip${loopRegion ? ' on' : ''}`}
          title="Loop current section (L)"
          aria-label="Loop current section"
          onClick={() => loopCurrentSection()}
        >
          Loop
        </button>
      </div>
    </div>
  );
}
