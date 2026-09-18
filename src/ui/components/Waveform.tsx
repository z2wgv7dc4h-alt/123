import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { previewPlayer } from '@/core/audio';
import { useStudioStore, canPlayPreview } from '../hooks/useStudioStore';
import {
  formatBarBeatSection,
  formatMmSs,
  formatElapsedTotal,
  formatBarSectionClockLine,
  resolvePlaybackDuration,
  dropWashRatios,
  sectionAtBar,
  barBeatFromProgress,
} from '../lib/barPosition';
import { HELP } from '../lib/helpCopy';
import { SectionJumpChips } from './SectionJumpChips';

const PEAK_BINS = 240;
/** Best-of-N take labels: Take A, B, C, D… */
const TAKE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/** Decode mix stem blob/url → peak envelope (AudioContext decode only — no Tone synth). */
async function decodePeaks(
  urlOrBlob: string | Blob,
  bins: number,
): Promise<Float32Array> {
  const url = typeof urlOrBlob === 'string' ? urlOrBlob : URL.createObjectURL(urlOrBlob);
  const revoke = typeof urlOrBlob !== 'string';
  try {
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const buf = await ctx.decodeAudioData(ab.slice(0));
    const ch0 = buf.getChannelData(0);
    const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
    const peaks = new Float32Array(bins);
    const block = Math.max(1, Math.floor(ch0.length / bins));
    for (let i = 0; i < bins; i++) {
      const start = i * block;
      const end = Math.min(ch0.length, start + block);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const L = Math.abs(ch0[j]!);
        const R = ch1 ? Math.abs(ch1[j]!) : L;
        peak = Math.max(peak, L, R);
      }
      peaks[i] = peak;
    }
    // Soft normalize for quiet sketches
    let max = 0;
    for (let i = 0; i < peaks.length; i++) max = Math.max(max, peaks[i]!);
    if (max > 1e-8) {
      const g = 1 / max;
      for (let i = 0; i < peaks.length; i++) peaks[i]! *= g;
    }
    return peaks;
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}

function paint(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  progress: number,
  loop: { start: number; end: number } | null = null,
  dropWash: { start: number; end: number } | null = null,
  zoomCenter: number | null = null,
  zoomFactor = 1,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 640;
  const cssH = canvas.clientHeight || 72;
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#0a0510';
  g.fillRect(0, 0, w, h);

  const mid = h / 2;
  const z = zoomFactor > 1 && zoomCenter != null ? zoomFactor : 1;
  const zc = zoomCenter ?? progress;
  const half = 0.5 / z;
  const viewStart = z > 1 ? Math.min(1 - 2 * half, Math.max(0, zc - half)) : 0;
  const viewEnd = z > 1 ? viewStart + 2 * half : 1;
  const viewSpan = Math.max(1e-6, viewEnd - viewStart);

  for (let i = 0; i < peaks.length; i++) {
    const r0 = i / peaks.length;
    const r1 = (i + 1) / peaks.length;
    if (r1 < viewStart || r0 > viewEnd) continue;
    const x0 = ((Math.max(r0, viewStart) - viewStart) / viewSpan) * w;
    const x1 = ((Math.min(r1, viewEnd) - viewStart) / viewSpan) * w;
    const amp = peaks[i]! * (h * 0.42);
    const played = r0 <= progress;
    g.fillStyle = played ? 'rgba(0, 229, 255, 0.92)' : 'rgba(255, 46, 232, 0.5)';
    g.fillRect(x0, mid - amp, Math.max(1, x1 - x0 - 1), amp * 2);
  }

  const toX = (r: number) => ((r - viewStart) / viewSpan) * w;

  // #65 soft Drop wash (visual only)
  if (dropWash && dropWash.end > dropWash.start) {
    const dx0 = toX(dropWash.start);
    const dx1 = toX(dropWash.end);
    g.fillStyle = 'rgba(255, 46, 232, 0.14)';
    g.fillRect(dx0, 0, Math.max(1, dx1 - dx0), h);
  }

  if (loop && loop.end > loop.start) {
    const x0 = toX(loop.start);
    const x1 = toX(loop.end);
    g.fillStyle = 'rgba(255, 159, 61, 0.18)';
    g.fillRect(x0, 0, Math.max(1, x1 - x0), h);
    g.strokeStyle = 'rgba(255, 159, 61, 0.85)';
    g.lineWidth = Math.max(1, dpr);
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x0, h);
    g.moveTo(x1, 0);
    g.lineTo(x1, h);
    g.stroke();
  }

  if (progress > 0 && progress < 1) {
    const px = toX(progress);
    g.save();
    g.shadowColor = 'rgba(0, 229, 255, 0.9)';
    g.shadowBlur = 6;
    g.strokeStyle = 'rgba(245, 250, 255, 0.95)';
    g.lineWidth = Math.max(1.5, dpr);
    g.beginPath();
    g.moveTo(px, 0);
    g.lineTo(px, h);
    g.stroke();
    g.restore();
  }
}

function ratioFromPointer(e: { clientX: number }, el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

/**
 * Mix-stem waveform under transport. Peaks from decoded WAV blob only —
 * never a Tone oscillator / synth engine.
 * #40: pointer scrub seeks PreviewPlayer playhead.
 */
export function Waveform() {
  const result = useStudioStore((s) => s.result);
  const previewState = useStudioStore((s) => s.previewState);
  const mixerDirty = useStudioStore((s) => s.mixerDirty);
  const seekPreview = useStudioStore((s) => s.seekPreview);
  const play = useStudioStore((s) => s.play);
  const stop = useStudioStore((s) => s.stop);
  const setLoopRegion = useStudioStore((s) => s.setLoopRegion);
  const clearLoopRegion = useStudioStore((s) => s.clearLoopRegion);
  const loopRegion = useStudioStore((s) => s.loopRegion);
  const waveformZoom = useStudioStore((s) => s.waveformZoom);
  const setWaveformZoom = useStudioStore((s) => s.setWaveformZoom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const edgeDragRef = useRef<'start' | 'end' | null>(null);
  const zoomCenterRef = useRef(0.5);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const nudgeBar = useStudioStore((s) => s.nudgeBar);
  const busy = useStudioStore((s) => s.busy);
  const pickCandidate = useStudioStore((s) => s.pickCandidate);
  const activeCandidate = useStudioStore((s) => s.activeCandidate);
  const jobId = result?.jobId;

  const viewWindow = () => {
    if (!waveformZoom) return { start: 0, end: 1 };
    const half = 0.25; // 2× → half-span 0.25
    const c = zoomCenterRef.current;
    const start = Math.min(1 - 2 * half, Math.max(0, c - half));
    return { start, end: start + 2 * half };
  };

  const globalRatioFromPointer = (e: { clientX: number }, el: HTMLElement): number => {
    const local = ratioFromPointer(e, el);
    const { start, end } = viewWindow();
    return Math.min(1, Math.max(0, start + local * (end - start)));
  };

  const localFromGlobal = (r: number): number => {
    const { start, end } = viewWindow();
    const span = Math.max(1e-6, end - start);
    return (r - start) / span;
  };

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);
    setProgress(0);
    const mix = result?.stems.find((s) => s.id === 'mix');
    // Instant sketch from OfflineStub peak buckets while blob decode runs
    if (result?.waveformPeaks?.length) {
      setPeaks(Float32Array.from(result.waveformPeaks));
    }
    if (!mix?.blob && !mix?.url) return;
    setLoading(true);
    void (async () => {
      try {
        const p = await decodePeaks(mix.blob ?? mix.url, PEAK_BINS);
        if (!cancelled) setPeaks(p);
      } catch {
        /* keep waveformPeaks fallback if present */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, result]);

  // Live playhead from PreviewPlayer.getProgress (Tone + native)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!scrubbingRef.current) {
        setProgress(previewPlayer.getProgress());
      }
      raf = requestAnimationFrame(tick);
    };
    if (previewState === 'playing' || scrubbing) {
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    setProgress(previewPlayer.getProgress());
    return undefined;
  }, [previewState, scrubbing, jobId]);

  // Keep zoom centered on playhead while zoomed
  useEffect(() => {
    if (waveformZoom) zoomCenterRef.current = progress;
  }, [progress, waveformZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const wash = dropWashRatios(result?.structure?.sections, result?.structure?.bars ?? 0);
    const zc = waveformZoom ? zoomCenterRef.current : null;
    const zf = waveformZoom ? 2 : 1;
    paint(canvas, peaks, progress, loopRegion, wash, zc, zf);
    const onResize = () => paint(canvas, peaks, progress, loopRegion, wash, zc, zf);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [peaks, progress, loopRegion, waveformZoom, result]);

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!result) return;
    if (edgeDragRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = globalRatioFromPointer(e, e.currentTarget);
    dragOriginRef.current = r;
    dragMovedRef.current = false;
    scrubbingRef.current = true;
    setScrubbing(true);
    setProgress(r);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (edgeDragRef.current && loopRegion) {
      const r = globalRatioFromPointer(e, e.currentTarget);
      if (edgeDragRef.current === 'start') {
        setLoopRegion(Math.min(r, loopRegion.end - 0.02), loopRegion.end, { seek: false });
      } else {
        setLoopRegion(loopRegion.start, Math.max(r, loopRegion.start + 0.02), { seek: false });
      }
      return;
    }
    if (!scrubbingRef.current || dragOriginRef.current == null) return;
    const r = globalRatioFromPointer(e, e.currentTarget);
    if (Math.abs(r - dragOriginRef.current) > 0.02) dragMovedRef.current = true;
    setProgress(r);
  };

  const endScrub = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (edgeDragRef.current) {
      edgeDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      return;
    }
    if (!scrubbingRef.current) return;
    const origin = dragOriginRef.current;
    const end = globalRatioFromPointer(e, e.currentTarget);
    scrubbingRef.current = false;
    setScrubbing(false);
    dragOriginRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (origin == null) return;
    if (dragMovedRef.current && Math.abs(end - origin) >= 0.02) {
      // #48 drag-select loop region
      setLoopRegion(origin, end);
      setProgress(Math.min(origin, end));
    } else {
      // click / tiny move → seek (#40)
      seekPreview(end);
      setProgress(end);
    }
    dragMovedRef.current = false;
  };

  const onEdgePointerDown = (which: 'start' | 'end') => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    edgeDragRef.current = which;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    }
  };

  const bars = result?.structure?.bars ?? 0;
  const sections = result?.structure?.sections;
  const mixDur = result?.stems.find((s) => s.id === 'mix')?.durationSec ?? 0;
  const liveDur = previewPlayer.getDurationSec();
  const playback = resolvePlaybackDuration({
    mixDurationSec: mixDur,
    liveDurationSec: liveDur > 0 ? liveDur : null,
    bars,
    bpm: result?.bpmMeasured ?? 174,
  });
  const durationSec = playback.durationSec;
  // Critic ONE Play truth: ready|stopped only (shared with Space hotkey).
  const canPlay = canPlayPreview(result, previewState);

  // P0.7: cold load — no empty “Peaks appear…” / second Generate
  if (!result) return null;

  return (
    <div
      className={`waveform ${loading && !peaks ? 'loading' : ''} ${previewState === 'playing' ? 'playing' : ''} ${previewState === 'ready' || previewState === 'stopped' ? 'ready' : ''} ${scrubbing ? 'scrubbing' : ''} ${loopRegion ? 'looping' : ''} ${waveformZoom ? 'zoomed' : ''}`}
      role="img"
      aria-label="Mix waveform — drag to seek"
    >
      <div className="waveform-head">
        <span className="waveform-label">Mix waveform</span>
        <span className="waveform-meta">
          {result.bpmMeasured} BPM · click seek · drag loop · Z zoom · Esc clears
        </span>
      </div>
      {/* UI-5: compact Play/Stop + time readout — same store handlers as the old top-bar buttons */}
      <div className="waveform-transport" role="group" aria-label="Play, Stop">
        <span className="transport-btn-wrap">
          <button
            type="button"
            className="btn tiny ghost btn-play-compact"
            disabled={!canPlay}
            aria-label={previewState === 'playing' ? 'Playing' : 'Play'}
            aria-keyshortcuts="Space"
            title={canPlay ? 'Play mix preview — replay OK after end (Space)' : HELP.playDisabled}
            aria-describedby={!canPlay ? 'help-play-disabled' : undefined}
            onClick={() => void play()}
          >
            {previewState === 'playing' ? (
              <Pause size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
          </button>
          {!canPlay ? (
            <span id="help-play-disabled" className="sr-only">
              {HELP.playDisabled}
            </span>
          ) : null}
        </span>
        <span className="transport-btn-wrap">
          <button
            type="button"
            className={`btn tiny ghost btn-stop-compact ${previewState === 'playing' ? 'on' : ''}`}
            disabled={previewState !== 'playing'}
            aria-label="Stop"
            title="Stop mix preview (Space)"
            onClick={() => stop()}
          >
            <Square size={16} aria-hidden="true" />
          </button>
        </span>
        {durationSec > 0 ? (
          <span className="transport-clock compact" role="status" aria-live="off" title={HELP.transportClock}>
            <span className="transport-clock-elapsed">
              {formatElapsedTotal(progress * durationSec, durationSec)}
            </span>
            {playback.mismatch && playback.mismatchNote ? (
              <span className="transport-clock-mismatch" title={HELP.durationMismatch}>
                {playback.mismatchNote}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      {result.candidates && result.candidates.length > 1 ? (
        <div className="waveform-takes" role="group" aria-label="Generated takes">
          <span className="hint">Take</span>
          {result.candidates.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`btn tiny ghost${activeCandidate === i ? ' on' : ''}`}
              disabled={busy}
              aria-pressed={activeCandidate === i}
              title={`Hear take ${TAKE_LETTERS[i] ?? i + 1} — no re-render`}
              onClick={() => void pickCandidate(i)}
            >
              {TAKE_LETTERS[i] ?? String(i + 1)}
            </button>
          ))}
        </div>
      ) : null}
      {mixerDirty && (
        <p className="waveform-dirty-note" role="note">
          Waveform is the original render — listen for mute/solo/gain tweaks
        </p>
      )}
      <div
        ref={wrapRef}
        className="waveform-canvas-wrap"
        onPointerMove={(e) => {
          if (scrubbingRef.current || edgeDragRef.current) return;
          setHoverRatio(globalRatioFromPointer(e, e.currentTarget));
        }}
        onPointerLeave={() => setHoverRatio(null)}
      >
        <span className="waveform-scrub-ghost" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="waveform-canvas"
          height={72}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
        />
        {/* #76 draggable loop edge handles */}
        {loopRegion ? (
          <>
            <button
              type="button"
              className="loop-edge-handle start"
              style={{ left: `${localFromGlobal(loopRegion.start) * 100}%` }}
              aria-label="Loop start"
              title="Drag to trim loop start"
              onPointerDown={onEdgePointerDown('start')}
            />
            <button
              type="button"
              className="loop-edge-handle end"
              style={{ left: `${localFromGlobal(loopRegion.end) * 100}%` }}
              aria-label="Loop end"
              title="Drag to trim loop end"
              onPointerDown={onEdgePointerDown('end')}
            />
          </>
        ) : null}
        {hoverRatio != null && durationSec > 0 ? (
          <span className="waveform-hover-time" aria-hidden="true">
            {formatMmSs(hoverRatio, durationSec)}
          </span>
        ) : null}
      </div>
      {/* #82 zoom chip */}
      <div className="waveform-zoom-row" role="group" aria-label="Waveform zoom">
        <button
          type="button"
          className={`btn tiny ghost${waveformZoom ? ' on' : ''}`}
          title="Zoom 2× around playhead (Z)"
          aria-pressed={waveformZoom}
          onClick={() => {
            if (!waveformZoom) zoomCenterRef.current = progress;
            setWaveformZoom(!waveformZoom);
          }}
        >
          {waveformZoom ? 'Zoom 2× · Esc' : 'Zoom 2×'}
        </button>
      </div>
      {!peaks && <span className="waveform-placeholder">Decoding mix peaks…</span>}
      {/* #52 bar:beat+section · #53 ±1 bar — waveform-adjacent only */}
      <div className="waveform-bar-row" role="group" aria-label="Bar position">
        <span className="waveform-bar-readout label-with-tip">
          <span className="label-with-tip-text waveform-clock" aria-live="off">
            {durationSec > 0 ? (
              <>
                <span className="waveform-clock-bar">
                  {formatBarSectionClockLine(progress, bars, sections, durationSec)}
                </span>
                {playback.mismatch && playback.mismatchNote ? (
                  <span className="waveform-clock-mismatch" title={HELP.durationMismatch}>
                    {playback.mismatchNote}
                  </span>
                ) : null}
              </>
            ) : bars > 0 ? (
              formatBarBeatSection(progress, bars, sections)
            ) : (
              '—'
            )}
          </span>
        </span>
        <span className="waveform-bar-nudge">
          <button
            type="button"
            className="btn tiny ghost"
            title="Back one bar (,)"
            aria-label="Back one bar"
            onClick={() => nudgeBar(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="btn tiny ghost"
            title="Forward one bar (.)"
            aria-label="Forward one bar"
            onClick={() => nudgeBar(1)}
          >
            ›
          </button>
          {hoverRatio != null && durationSec > 0 ? (
            <span className="waveform-hover-time-inline" title={HELP.waveformHoverTime}>
              {formatMmSs(hoverRatio, durationSec)}
            </span>
          ) : null}
        </span>
      </div>
      {/* #64 Clear loop — waveform only */}
      {loopRegion ? (
        <div className="waveform-clear-loop" role="group" aria-label="Loop controls">
          <button
            type="button"
            className="btn tiny ghost"
            onClick={() => clearLoopRegion()}
            title="Clear loop (Esc)"
          >
            Clear loop
          </button>
        </div>
      ) : null}
      {/* #69 section-enter aria */}
      <span className="sr-only" aria-live="polite">
        {bars > 0
          ? (() => {
              const { bar } = barBeatFromProgress(progress, bars);
              const name = sectionAtBar(bar, sections);
              return name ? `Entered ${name}` : '';
            })()
          : ''}
      </span>
      <SectionJumpChips />
    </div>
  );
}
