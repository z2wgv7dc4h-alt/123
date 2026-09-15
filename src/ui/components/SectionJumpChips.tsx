import { useStudioStore } from '../hooks/useStudioStore';
import { sectionLoopRatios } from '../lib/barPosition';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

const MAX_CHIPS = 5;

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

  const chips = sections.slice(0, MAX_CHIPS);

  return (
    <div className="section-jump" role="group" aria-label="Jump to section">
      <span className="section-jump-label label-with-tip">
        <span className="label-with-tip-text">Jump</span>
        <HelpTip text={HELP.sectionJump} ariaLabel="About section jump" />
        <HelpTip text={HELP.sectionLoop} ariaLabel="About section loop" />
      </span>
      <div className="section-jump-chips">
        {chips.map((s) => {
          const ratio = Math.min(1, Math.max(0, s.startBar / bars));
          const label = s.name.charAt(0).toUpperCase() + s.name.slice(1);
          return (
            <button
              key={`${s.name}-${s.startBar}`}
              type="button"
              className={`btn tiny ghost section-jump-chip seg-${s.name}`}
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
        <HelpTip text={HELP.sectionJumpLoopChip} ariaLabel="About Jump-row Loop chip" />
        <HelpTip text={HELP.loopSectionHotkey} ariaLabel="About L hotkey" />
      </div>
    </div>
  );
}
