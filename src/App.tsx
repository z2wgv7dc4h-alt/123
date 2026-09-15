import { useEffect } from 'react';
import { TransportBar } from './ui/components/TransportBar';
import { RegenAffordance } from './ui/components/RegenAffordance';
import { ParamPanel } from './ui/components/ParamPanel';
import { StemMixer, StemMixerCompact } from './ui/components/StemMixer';
import { StatusPanel } from './ui/components/StatusPanel';
import { PowerExtras } from './ui/components/PowerExtras';
import { SurpriseMeButton } from './ui/components/SurpriseMeButton';
import { FavoritesPanel } from './ui/components/FavoritesPanel';
import { SectionTimeline } from './ui/components/SectionTimeline';
import { Waveform } from './ui/components/Waveform';
import { Toasts } from './ui/components/Toasts';
import { HelpPanel } from './ui/components/HelpPanel';
import { StyleDropZone } from './ui/components/StyleDropZone';
import { FlowStatusChips } from './ui/components/FlowStatusChips';
import { HelpTip } from './ui/components/HelpTip';
import { ProductTierPanel } from './ui/components/ProductTierPanel';
import { ResumeDraftStrip } from './ui/components/ResumeDraftStrip';
import { PostExportStrip } from './ui/components/PostExportStrip';
import { SongShapePicker } from './ui/components/SongShapePicker';
import { SimpleWant } from './ui/components/SimpleWant';
import { LayersChips } from './ui/components/LayersChips';
import { HELP } from './ui/lib/helpCopy';
import { ELEMENTAL_STEM_IDS, useStudioStore } from './ui/hooks/useStudioStore';
import { useTransportHotkeys } from './ui/hooks/useTransportHotkeys';
import { retailBackendLabel } from './ui/lib/retailLabels';

export default function App() {
  useTransportHotkeys();
  const mode = useStudioStore((s) => s.mode);
  const setMode = useStudioStore((s) => s.setMode);
  const productTier = useStudioStore((s) => s.productTier);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const backendId = useStudioStore((s) => s.backendId);
  const moreOpen = useStudioStore((s) => s.moreOpen);
  const setMoreOpen = useStudioStore((s) => s.setMoreOpen);
  const exportBitDepth = useStudioStore((s) => s.exportBitDepth);
  const result = useStudioStore((s) => s.result);
  const error = useStudioStore((s) => s.error);
  const vibe = useStudioStore((s) => s.vibe);
  const initBackends = useStudioStore((s) => s.initBackends);

  useEffect(() => {
    void initBackends();
  }, [initBackends]);

  const showPower = mode === 'power' || moreOpen;
  const isSimple = mode === 'simple';
  const studioLive = productTier === 'studio' && aceHasGpu;
  const onSketchAudio = !studioLive;
  const liveMixerOk = !!(
    result &&
    result.stems.some((s) => (ELEMENTAL_STEM_IDS as readonly string[]).includes(s.id))
  );

  return (
    <div
      className={`app${isSimple ? ' simple' : ' power'}${productTier === 'studio' ? ' product-studio' : ' product-sketch'}${studioLive ? ' studio-live' : ''}`}
    >
      <a className="skip-link" href="#want">
        Skip to what you want
      </a>
      <a className="skip-link skip-link-2" href="#transport">
        Skip to Generate
      </a>

      <header className="header">
        <div className="header-brand">
          <div className="honesty-chip-row" aria-label="Audio path">
            <span className={`honesty-chip${studioLive ? ' live' : ' sketch'}`}>
              <span className="honesty-chip-dot" aria-hidden />
              {studioLive ? 'Studio · GPU' : 'Sketch · CPU'}
              <HelpTip
                text={studioLive ? HELP.badgeAce : HELP.badgeCpu174}
                ariaLabel="About audio path"
              />
            </span>
          </div>
          <h1>{studioLive ? 'DnB Studio' : 'DnB Sketch'}</h1>
          <p className="tagline">
            {isSimple
              ? 'Original drum & bass · 174 BPM · files stay local'
              : onSketchAudio
                ? 'Sketch (CPU) · Studio GPU when sidecar is live · ~174 BPM'
                : 'Studio · ACE on RTX 5080 · original rock-DnB'}
          </p>
        </div>
        <div className="header-toggles">
          <div className="mode-toggle layout-toggle" role="group" aria-label="Layout">
            <button
              type="button"
              className={mode === 'simple' ? 'btn tiny on' : 'btn tiny'}
              aria-pressed={mode === 'simple'}
              onClick={() => {
                setMode('simple');
                setMoreOpen(false);
              }}
            >
              Simple
            </button>
            <button
              type="button"
              className={`mode-power-btn ${mode === 'power' ? 'btn tiny on' : 'btn tiny'}`}
              aria-pressed={mode === 'power'}
              onClick={() => {
                setMode('power');
                setMoreOpen(true);
              }}
            >
              Power
            </button>
            <HelpTip text={HELP.simpleMode} ariaLabel="About Simple vs Power" />
          </div>
        </div>
      </header>

      {/* Power-only chrome */}
      {!isSimple && <ProductTierPanel />}
      {!isSimple && (
        <p className="flow-hint" role="status">
          {`Power · ${productTier}${studioLive ? ' · GPU live' : ' · Sketch audio'} · ${retailBackendLabel(backendId)}`}
        </p>
      )}
      {!isSimple && <HelpPanel />}

      {/* ========== SIMPLE process path ==========
          Listen-first: Generate/Play + waveform + section map + mute stay
          pinned at top (persistent, not buried mid-scroll). Style/shape/layer
          tweaks live below — they only take effect on the next Generate. */}
      {isSimple && (
        <>
          <div className="listen-first-panel" id="generate-hero">
            <TransportBar />
            {result && <Waveform />}
            {result && liveMixerOk && <SectionTimeline />}
            {result && <StemMixerCompact />}
          </div>

          <ResumeDraftStrip />
          <PostExportStrip />
          <RegenAffordance />

          {result && (
            <p className="tweak-divider hint" role="status">
              Tweak the vibe or shape below, then Generate again.
            </p>
          )}
          <SimpleWant />
          <StyleDropZone />
          <SongShapePicker />
          {result && liveMixerOk && <LayersChips />}

          {result && (
            <p className="export-nudge hint" role="status">
              Like it? Use <strong>Export ZIP</strong> above — stems stay on this machine.
            </p>
          )}
        </>
      )}

      {/* ========== POWER layout ========== */}
      {!isSimple && (
        <>
          <StyleDropZone />
          {vibe && (
            <p className="vibe-inspire-banner" role="status">
              Using your file as vibe — still an original track at 174 BPM
            </p>
          )}
          <FlowStatusChips />
          <SongShapePicker />
          <TransportBar />
          <ResumeDraftStrip />
          <PostExportStrip />
          <RegenAffordance />
          {result && <Waveform />}
          {result && liveMixerOk && <SectionTimeline />}
          {result && liveMixerOk && <LayersChips showSecondary />}
        </>
      )}

      {isSimple && (
        <div className="more-toggle-row">
          <button
            type="button"
            className={`btn ghost ${moreOpen ? 'on' : ''}`}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            {moreOpen ? 'Hide extras' : 'More'}
          </button>
        </div>
      )}

      {isSimple && moreOpen && (
        <>
          {result && liveMixerOk && <LayersChips showSecondary />}
          <ProductTierPanel />
          <HelpPanel />
        </>
      )}

      {showPower && (
        <main className="grid">
          <ParamPanel />
          <SurpriseMeButton />
          <FavoritesPanel />
          <StemMixer />
          <StatusPanel />
          {(mode === 'power' || moreOpen) && <PowerExtras />}
        </main>
      )}

      {isSimple && error && (
        <main className="grid simple-status">
          <StatusPanel />
        </main>
      )}

      <footer className="footer">
        <span>
          {isSimple
            ? 'Local · your files only'
            : studioLive
              ? `Local Studio GPU · ${exportBitDepth}-bit · your files stay here`
              : `Local Sketch · ${exportBitDepth}-bit · your files stay here`}
        </span>
      </footer>

      <Toasts />
    </div>
  );
}
