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

export default function App() {
  useTransportHotkeys();
  const productTier = useStudioStore((s) => s.productTier);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const moreOpen = useStudioStore((s) => s.moreOpen);
  const setMoreOpen = useStudioStore((s) => s.setMoreOpen);
  const result = useStudioStore((s) => s.result);
  const error = useStudioStore((s) => s.error);
  const initBackends = useStudioStore((s) => s.initBackends);

  useEffect(() => {
    void initBackends();
  }, [initBackends]);

  const studioLive = productTier === 'studio' && aceHasGpu;
  const liveMixerOk = !!(
    result &&
    result.stems.some((s) => (ELEMENTAL_STEM_IDS as readonly string[]).includes(s.id))
  );

  // One layout (UI-2). The `simple` class is only the existing CSS style hook.
  return (
    <div
      className={`app simple${productTier === 'studio' ? ' product-studio' : ' product-sketch'}${studioLive ? ' studio-live' : ''}`}
    >
      <a className="skip-link" href="#transport">
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
          <p className="tagline">Original drum &amp; bass · 174 BPM · files stay local</p>
        </div>
      </header>

      {/* ========== ONE LAYOUT (UI-6) ==========
          Intent first: style text + song shape sit above Generate.
          Listen: transport cluster, then waveform + song map.
          Everything else lives behind the single More toggle. */}
      <section className="intent-panel" aria-label="Intent" id="intent">
        <SimpleWant />
        <SongShapePicker />
      </section>

      <div className="listen-first-panel" id="generate-hero">
        <TransportBar />
        {result && <Waveform />}
        {result && liveMixerOk && <SectionTimeline />}
      </div>

      <ResumeDraftStrip />
      <PostExportStrip />
      <RegenAffordance />

      {result && (
        <p className="export-nudge hint" role="status">
          Like it? Use <strong>Export ZIP</strong> above — stems stay on this machine.
        </p>
      )}

      {error && !moreOpen && (
        <main className="grid simple-status">
          <StatusPanel />
        </main>
      )}

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

      {moreOpen && (
        <>
          <StyleDropZone />
          {result && <StemMixerCompact />}
          {result && liveMixerOk && <LayersChips showSecondary />}
          <ProductTierPanel />
          <HelpPanel />
          <main className="grid">
            <ParamPanel />
            <SurpriseMeButton />
            <FavoritesPanel />
            <StemMixer />
            <StatusPanel />
            <PowerExtras />
          </main>
        </>
      )}

      <footer className="footer">
        <span>Local · your files only</span>
      </footer>

      <Toasts />
    </div>
  );
}
