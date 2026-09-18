import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { previewPlayer } from '@/core/audio';
import { useStudioStore } from '../hooks/useStudioStore';
import { pushToast } from '../lib/toasts';
import { barsToDurationSec, formatDurationMmSs, sectionClickRatio } from '../lib/barPosition';
import { DEFAULT_BPM, GENRES } from '@/core/types';
import { retailStructureLabel } from '../lib/retailLabels';
import { totalBarsOf } from '../lib/structureEdit';
import { isStudioTake, REDO_PRESETS, REDO_STRENGTH_DEFAULT, REDO_STRENGTH_MAX, REDO_STRENGTH_MIN } from '../lib/takeEdit';
import { INSERT_SECTION_NAMES } from '../lib/arrangeTake';
import type { GenreId, SectionName } from '@/core/types';
import { BAR_GRID_MIN_CONFIDENCE } from '@/core/audio/downbeatGrid';

const SECTION_CLASS: Record<string, string> = {
  intro: 'seg-intro',
  build: 'seg-build',
  drop: 'seg-drop',
  break: 'seg-break',
  breakdown: 'seg-breakdown',
  outro: 'seg-outro',
};

const SECTION_HINT: Record<string, string> = {
  intro: 'Open · establish groove',
  build: 'Tension · rise into drop',
  drop: 'Peak energy · full groove',
  break: 'Breathe · strip drums',
  breakdown: 'Strip it back · rebuild',
  outro: 'Wind down · exit',
};

function sampleEnergyBars(
  curve: { bar: number; level: number }[] | undefined,
  totalBars: number,
  count = 48,
): number[] {
  if (!curve?.length || totalBars <= 0) return [];
  const sorted = [...curve].sort((a, b) => a.bar - b.bar);
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const barPos = (i / (count - 1)) * Math.max(1, totalBars - 1);
    let lo = sorted[0]!;
    let hi = sorted[sorted.length - 1]!;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (sorted[j]!.bar <= barPos && sorted[j + 1]!.bar >= barPos) {
        lo = sorted[j]!;
        hi = sorted[j + 1]!;
        break;
      }
    }
    const span = Math.max(1e-6, hi.bar - lo.bar);
    const t = Math.min(1, Math.max(0, (barPos - lo.bar) / span));
    bars.push(lo.level + (hi.level - lo.level) * t);
  }
  return bars;
}

function sectionLabel(name: string, startBar: number, lengthBars: number): string {
  const end = startBar + lengthBars - 1;
  const hint = SECTION_HINT[name] ?? 'Section';
  return `${name} · bars ${startBar}–${end} (${lengthBars} bars) · ${hint}`;
}

export function SectionTimeline() {
  const result = useStudioStore((s) => s.result);
  const busy = useStudioStore((s) => s.busy);
  const expandSectionAt = useStudioStore((s) => s.expandSectionAt);
  const repeatSectionAt = useStudioStore((s) => s.repeatSectionAt);
  const setSectionLengthAt = useStudioStore((s) => s.setSectionLengthAt);
  const generateAgain = useStudioStore((s) => s.generateAgain);
  const paramsDirty = useStudioStore((s) => s.paramsDirty);
  const editedSections = useStudioStore((s) => s.editedSections);
  const seekPreview = useStudioStore((s) => s.seekPreview);
  const previewState = useStudioStore((s) => s.previewState);
  const redoSection = useStudioStore((s) => s.redoSection);
  const arrangeSection = useStudioStore((s) => s.arrangeSection);
  const undoTakeEdit = useStudioStore((s) => s.undoTakeEdit);
  const polishDrops = useStudioStore((s) => s.polishDrops);
  const switchTempoHere = useStudioStore((s) => s.switchTempoHere);
  const [switchGenre, setSwitchGenre] = useState<GenreId>('dubstep');
  const [switchBpm, setSwitchBpm] = useState(140);
  const [switchBars, setSwitchBars] = useState(16);
  const takeHistory = useStudioStore((s) => s.takeHistory);

  const studioTake = isStudioTake(result);

  const renderedBars = result?.structure?.bars ?? 0;
  const sections = editedSections ?? result?.structure?.sections;
  const bars = sections?.length ? totalBarsOf(sections) : renderedBars;
  const energyBars = useMemo(
    () => sampleEnergyBars(result?.structure?.energyCurve, bars),
    [result?.structure?.energyCurve, bars],
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ index: number; startX: number; startLen: number; studio: boolean } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [resizePreview, setResizePreview] = useState<{ index: number; lengthBars: number } | null>(null);
  const resizePreviewRef = useRef<{ index: number; lengthBars: number } | null>(null);
  const [playheadRatio, setPlayheadRatio] = useState(0);
  // UI-7: Expand / Repeat / ×2 apply only to the selected section.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [redoPresetId, setRedoPresetId] = useState('auto');
  const [redoWords, setRedoWords] = useState('');
  const [redoStrength, setRedoStrength] = useState(REDO_STRENGTH_DEFAULT);
  const [insertBars, setInsertBars] = useState(8);
  const [insertName, setInsertName] = useState<SectionName>('break');
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(null);
  }, [result?.jobId]);

  // Shared playhead (same previewPlayer clock as TransportBar/Waveform) so the
  // song map shows where playback is right now, not just where a click seeks to.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPlayheadRatio(previewPlayer.getProgress());
      raf = requestAnimationFrame(tick);
    };
    if (previewState === 'playing') {
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    setPlayheadRatio(previewPlayer.getProgress());
    return undefined;
  }, [previewState]);

  const onEdgePointerDown = useCallback(
    (index: number, e: React.PointerEvent) => {
      if (!sections?.length || busy) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        index,
        startX: e.clientX,
        startLen: sections[index]!.lengthBars,
        studio: studioTake,
      };
      setDragging(index);
    },
    [sections, busy, studioTake],
  );

  const onEdgePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      const track = trackRef.current;
      if (!d || !track || !sections?.length) return;
      const total = sections.reduce((n, s) => n + s.lengthBars, 0) || 1;
      const pxPerBar = track.clientWidth / total;
      if (pxPerBar < 1) return;
      const deltaBars = Math.round((e.clientX - d.startX) / pxPerBar / 4) * 4;
      const nextLen = Math.max(4, d.startLen + deltaBars);
      if (d.studio) {
        // Studio: preview the length, splice once on release (one repaint).
        const preview = nextLen !== d.startLen ? { index: d.index, lengthBars: nextLen } : null;
        resizePreviewRef.current = preview;
        setResizePreview(preview);
      } else if (nextLen !== sections[d.index]!.lengthBars) {
        setSectionLengthAt(d.index, nextLen);
      }
    },
    [sections, setSectionLengthAt],
  );

  const onEdgePointerUp = useCallback(() => {
    const d = dragRef.current;
    if (d) {
      const live = useStudioStore.getState();
      if (d.studio) {
        const target = resizePreviewRef.current;
        if (target && target.index === d.index && target.lengthBars !== d.startLen) {
          void live.arrangeSection({
            kind: 'resize',
            sectionIndex: d.index,
            lengthBars: target.lengthBars,
          });
        }
        resizePreviewRef.current = null;
        setResizePreview(null);
      } else {
        const now = live.editedSections ?? live.result?.structure?.sections;
        const nextLen = now?.[d.index]?.lengthBars;
        if (nextLen != null && nextLen !== d.startLen) {
          const bars = live.bars || now?.reduce((n, s) => n + s.lengthBars, 0) || 0;
          const bpm = live.result?.bpmMeasured ?? live.bpm ?? DEFAULT_BPM;
          const approx = formatDurationMmSs(barsToDurationSec(bars, bpm));
          pushToast(`Arrangement ~${approx} on next Generate`, 'info', 3400);
        }
      }
    }
    dragRef.current = null;
    setDragging(null);
  }, []);

  if (!sections?.length) {
    return (
      <div className={`timeline empty ${busy ? 'busy' : ''}`} aria-live="polite">
        <div className="empty-state timeline-empty">
          <p className="empty-state-title">{busy ? 'Generating sketch…' : 'Section map'}</p>
          <p className="hint">
            {busy
              ? 'Building stems on the song layout at your genre tempo — hang tight'
              : 'Appears after Generate · drag edges or Expand a part you like'}
          </p>
          {busy && (
            <div className="gen-progress" role="progressbar" aria-label="Generating" aria-valuetext="Creating your sketch" aria-busy="true">
              <span className="gen-progress-bar" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="timeline timeline-interactive" role="list" aria-label={`Arrangement ${bars} bars`}>
      <div className="timeline-head">
        <span className="label-with-tip-text">Arrangement map</span>
        {studioTake && (
          <>
            <span className="pill tiny" title="Each edit makes a new version of this take">
              Take v{takeHistory.length + 1}
            </span>
            {takeHistory.length > 0 && (
              <button type="button" className="btn tiny ghost" disabled={busy} onClick={() => void undoTakeEdit()}>
                Undo edit
              </button>
            )}
            <button
              type="button"
              className="btn tiny ghost"
              disabled={
                busy ||
                (result?.structure?.sections.filter((s) => s.name === 'drop').length ?? 0) === 0
              }
              title="Repaint every drop (best-of-2) and keep the top-scored take"
              onClick={() => void polishDrops()}
            >
              Polish drops
            </button>
            {selectedIndex != null && (
              <span className="tempo-switch-controls" role="group" aria-label="Switch tempo here">
                <select
                  value={switchGenre}
                  disabled={busy}
                  aria-label="Block genre"
                  onChange={(e) => setSwitchGenre(e.target.value as GenreId)}
                >
                  {(Object.keys(GENRES) as GenreId[]).map((id) => (
                    <option key={id} value={id}>
                      {GENRES[id].label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={70}
                  max={200}
                  value={switchBpm}
                  disabled={busy}
                  aria-label="Block BPM"
                  onChange={(e) => setSwitchBpm(Number(e.target.value))}
                />
                <input
                  type="number"
                  min={4}
                  max={64}
                  step={4}
                  value={switchBars}
                  disabled={busy}
                  aria-label="Block bars"
                  onChange={(e) => setSwitchBars(Number(e.target.value))}
                />
                <button
                  type="button"
                  className="btn tiny"
                  disabled={busy}
                  title="Render this section after the selected one at a new tempo and hard-cut it in"
                  onClick={() =>
                    void switchTempoHere(selectedIndex, {
                      genre: switchGenre,
                      bpm: switchBpm,
                      bars: switchBars,
                      role: 'drop',
                    })
                  }
                >
                  Switch tempo here
                </button>
              </span>
            )}
          </>
        )}
        {editedSections && (
          <span className="pill tiny" title="Section lengths edited — Generate again to hear">
            {renderedBars > 0 && bars !== renderedBars
              ? `Playing ${renderedBars} · next ${bars}`
              : 'Edited'}
          </span>
        )}
      </div>
      <p className="hint timeline-drag-hint">
        {studioTake
          ? 'Select a section · Redo regenerates it · drag a section to reorder · Duplicate / Delete / Insert blank N bars · the rest stays'
          : 'Select a section for Expand / Repeat / ×2 · or drag its right edge · then Generate again · arrangement editing (E-1) is Studio only'}
      </p>
      <div
        className="timeline-track"
        ref={trackRef}
        onPointerMove={onEdgePointerMove}
        onPointerUp={onEdgePointerUp}
        onPointerCancel={onEdgePointerUp}
      >
        {sections.map((s, index) => {
          const displayLen =
            resizePreview && resizePreview.index === index ? resizePreview.lengthBars : s.lengthBars;
          const label = sectionLabel(s.name, s.startBar, displayLen);
          return (
            <div
              key={`${s.name}-${s.startBar}-${index}`}
              className={`timeline-seg ${SECTION_CLASS[s.name] ?? 'seg-other'}${dragging === index ? ' dragging' : ''}${selectedIndex === index ? ' selected' : ''}${dropTarget === index ? ' drop-target' : ''}`}
              style={{ flex: displayLen }}
              role="listitem"
              tabIndex={0}
              title={label}
              aria-label={label}
              data-selected={selectedIndex === index}
              draggable={studioTake && !busy}
              onDragStart={(e) => {
                if (!studioTake || busy) return;
                e.dataTransfer.setData('text/plain', String(index));
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!studioTake || busy) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(index);
              }}
              onDragLeave={() => setDropTarget((t) => (t === index ? null : t))}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                if (!studioTake || busy) return;
                const from = Number(e.dataTransfer.getData('text/plain'));
                if (!Number.isInteger(from) || from === index) return;
                void arrangeSection({ kind: 'move', sectionIndex: from, toIndex: index });
              }}
              onFocus={() => setSelectedIndex(index)}
              onClick={(e) => {
                setSelectedIndex(index);
                if (!result?.structure?.sections?.[index]) return;
                const section = result.structure.sections[index];
                const totalBars = result.structure.bars;
                const clickPosition = e.currentTarget.getBoundingClientRect();
                const ratioInSection = (e.clientX - clickPosition.left) / clickPosition.width;
                const targetRatio = sectionClickRatio(
                  section.startBar,
                  section.lengthBars,
                  totalBars,
                  ratioInSection,
                );
                seekPreview(targetRatio);
              }}
            >
              <span className="timeline-seg-name">{s.name}</span>
              <small className="timeline-seg-bars">
                {displayLen}b · {s.startBar}–{s.startBar + displayLen - 1}
              </small>
              <span className="timeline-seg-tip" aria-hidden="true">
                {SECTION_HINT[s.name] ?? 'Section'}
              </span>
              {selectedIndex === index && (
                <div className="timeline-seg-actions" onClick={(e) => e.stopPropagation()}>
                  {studioTake ? (
                    <>
                      <select
                        className="redo-preset"
                        aria-label="Redo as"
                        value={redoPresetId}
                        disabled={busy}
                        onChange={(e) => setRedoPresetId(e.target.value)}
                      >
                        {REDO_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                      <input
                        className="redo-words"
                        type="text"
                        placeholder="own words (optional)"
                        aria-label="Redo words"
                        value={redoWords}
                        disabled={busy}
                        onChange={(e) => setRedoWords(e.target.value)}
                      />
                      <label className="redo-strength" title="How much ACE may change this part">
                        <span className="redo-strength-label">Change amount</span>
                        <input
                          type="range"
                          min={REDO_STRENGTH_MIN}
                          max={REDO_STRENGTH_MAX}
                          step={0.1}
                          value={redoStrength}
                          disabled={busy}
                          aria-label="Change amount"
                          onChange={(e) => setRedoStrength(Number(e.target.value))}
                        />
                        <span className="redo-strength-value">{redoStrength.toFixed(1)}</span>
                      </label>
                      <button
                        type="button"
                        className="btn tiny ghost"
                        disabled={busy}
                        title="Regenerate only this section on the take (ACE repaint)"
                        onClick={() => {
                          const preset = REDO_PRESETS.find((p) => p.id === redoPresetId)?.style ?? {};
                          const words = redoWords.trim();
                          void redoSection(index, {
                            ...preset,
                            strength: redoStrength,
                            ...(words ? { words } : {}),
                          });
                        }}
                      >
                        Redo
                      </button>
                      {[8, 16].map((n) => {
                        return (
                          <button
                            key={n}
                            type="button"
                            className="btn tiny ghost"
                            disabled={busy}
                            title={`Extend anywhere: copy this section's last ${Math.min(n, s.lengthBars)} bars after it, then repaint the seams`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void arrangeSection({ kind: 'extendAnywhere', sectionIndex: index, deltaBars: n });
                            }}
                          >
                            +{n}
                          </button>
                        );
                      })}
                      <span className="arrange-e1" role="group" aria-label="Arrangement edit">
                        <button
                          type="button"
                          className="btn tiny ghost"
                          disabled={busy}
                          title="Copy this section right after itself, then repaint the seams"
                          onClick={(e) => {
                            e.stopPropagation();
                            void arrangeSection({ kind: 'duplicate', sectionIndex: index });
                          }}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="btn tiny ghost"
                          disabled={busy || sections.length <= 1}
                          title="Cut this section out, then repaint the join"
                          onClick={(e) => {
                            e.stopPropagation();
                            void arrangeSection({ kind: 'delete', sectionIndex: index });
                          }}
                        >
                          Delete
                        </button>
                        <select
                          className="arrange-insert-bars"
                          aria-label="Insert blank bars"
                          value={insertBars}
                          disabled={busy}
                          onChange={(e) => setInsertBars(Number(e.target.value))}
                        >
                          {[4, 8, 16].map((n) => (
                            <option key={n} value={n}>{n} bars</option>
                          ))}
                        </select>
                        <select
                          className="arrange-insert-name"
                          aria-label="Insert section role"
                          value={insertName}
                          disabled={busy}
                          onChange={(e) => setInsertName(e.target.value as SectionName)}
                        >
                          {INSERT_SECTION_NAMES.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn tiny ghost"
                          disabled={busy}
                          title="Insert blank bars before this section, then repaint the whole gap + 1 bar each side"
                          onClick={(e) => {
                            e.stopPropagation();
                            void arrangeSection({
                              kind: 'insert',
                              atStartBar: s.startBar,
                              bars: insertBars,
                              name: insertName,
                            });
                          }}
                        >
                          Insert blank
                        </button>
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn tiny ghost"
                        disabled={busy}
                        title="Expand +8 bars — arrangement applies on next Generate"
                        onClick={() => expandSectionAt(index, 8)}
                      >
                        Expand
                      </button>
                      <button
                        type="button"
                        className="btn tiny ghost"
                        disabled={busy}
                        title="Duplicate this section after itself — arrangement applies on next Generate"
                        onClick={() => repeatSectionAt(index)}
                      >
                        Repeat
                      </button>
                      {s.name === 'drop' && (
                        <button
                          type="button"
                          className="btn tiny ghost timeline-drop-x2"
                          disabled={busy || bars + s.lengthBars > 128}
                          title="Double this drop — arrangement applies on next Generate"
                          onClick={() => expandSectionAt(index, s.lengthBars)}
                        >
                          ×2
                        </button>
                      )}
                      <span className="arrange-e1 arrange-e1-disabled" role="group" aria-label="Arrangement edit (Studio only)">
                        <button type="button" className="btn tiny ghost" disabled title="Studio only — E-1 edits the take in place">
                          Duplicate
                        </button>
                        <button type="button" className="btn tiny ghost" disabled title="Studio only — E-1 edits the take in place">
                          Delete
                        </button>
                        <button type="button" className="btn tiny ghost" disabled title="Studio only — E-1 edits the take in place">
                          Insert blank
                        </button>
                      </span>
                    </>
                  )}
                </div>
              )}
              <button
                type="button"
                className="timeline-seg-edge"
                aria-label={`Drag to resize ${s.name}`}
                title="Drag to stretch"
                onPointerDown={(e) => onEdgePointerDown(index, e)}
              />
            </div>
          );
        })}
        {renderedBars > 0 && bars === renderedBars && (
          <div
            className={`timeline-playhead${previewState === 'playing' ? ' playing' : ''}`}
            style={{ left: `${Math.min(100, Math.max(0, playheadRatio * 100))}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      {energyBars.length > 0 && (
        <div
          className="energy-strip"
          role="img"
          aria-label="Structure energy curve across bars"
          title="Energy curve from song layout"
        >
          {energyBars.map((level, i) => (
            <span
              key={i}
              className="energy-bar"
              style={{ height: `${Math.max(8, Math.round(level * 100))}%` }}
              title={`Energy ~${Math.round(level * 100)}%`}
            />
          ))}
        </div>
      )}
      <div className="timeline-meta">
        {result!.bpmMeasured} BPM · seed {result!.seed} · {bars} bars ·{' '}
        {result!.barGrid && result!.barGrid.confidence >= BAR_GRID_MIN_CONFIDENCE
          ? ` bar 1 at ${result!.barGrid.offsetSec.toFixed(2)}s ·`
          : ''}
        {retailStructureLabel(result!.manifest.structureVersion)}
        {paramsDirty && (
          <>
            {' · '}
            <button type="button" className="btn tiny accent" disabled={busy} onClick={() => void generateAgain()}>
              Generate with edits
            </button>
          </>
        )}
      </div>
    </div>
  );
}
