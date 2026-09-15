import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';
import { DEFAULT_BIT_DEPTH } from '@/core/types';

/**
 * Retail honesty strip — Sketch (what you have) vs Studio (GPU later).
 * Soft-pass forbidden: never claim Studio audio without aceHasGpu.
 */
export function ProductTierPanel() {
  const productTier = useStudioStore((s) => s.productTier);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const setProductTier = useStudioStore((s) => s.setProductTier);
  const studioLive = productTier === 'studio' && aceHasGpu;
  const studioBrowsing = productTier === 'studio' && !aceHasGpu;

  return (
    <section
      className={`product-tier-panel compact${studioBrowsing ? ' gated' : ''}${studioLive ? ' live' : ''}`}
      aria-label="Product path Sketch versus Studio"
    >
      <div className="product-tier-toggle" role="group" aria-label="Product path">
        <button
          type="button"
          className={productTier === 'sketch' ? 'btn tiny on' : 'btn tiny'}
          aria-pressed={productTier === 'sketch'}
          onClick={() => setProductTier('sketch')}
        >
          Sketch
        </button>
        <HelpTip text={HELP.productSketch} ariaLabel="About Sketch product" />
        <button
          type="button"
          className={`mode-studio-btn ${productTier === 'studio' ? 'btn tiny on' : 'btn tiny'}`}
          aria-pressed={productTier === 'studio'}
          onClick={() => setProductTier('studio')}
        >
          Studio
        </button>
        <HelpTip text={HELP.productStudio} ariaLabel="About Studio product" />
      </div>

      {productTier === 'sketch' && aceHasGpu && (
        <p className="product-tier-copy" role="status">
          GPU live — still Sketch.{' '}
          <button type="button" className="btn tiny" onClick={() => setProductTier('studio')}>
            Use Studio ACE
          </button>
        </p>
      )}

      {productTier === 'sketch' && (
        <p className="product-tier-copy" role="status">
          <strong>Sketch</strong> — works now · {DEFAULT_BIT_DEPTH}-bit · local
          <HelpTip text={HELP.badgeSketch16} ariaLabel="About 16-bit Sketch" />
        </p>
      )}

      {studioBrowsing && (
        <div className="product-tier-gated" role="status">
          <p className="product-tier-copy">
            <strong>Studio</strong> — GPU path not live yet · Generate still makes Sketch
            <HelpTip text={HELP.studioGated} ariaLabel="Why Studio is gated" />
          </p>
          <button type="button" className="btn tiny ghost" onClick={() => setProductTier('sketch')}>
            Back to Sketch
          </button>
        </div>
      )}

      {studioLive && (
        <p className="product-tier-copy" role="status">
          <strong>Studio</strong> — local GPU path active. Higher-quality local GPU render enabled.
        </p>
      )}
    </section>
  );
}
