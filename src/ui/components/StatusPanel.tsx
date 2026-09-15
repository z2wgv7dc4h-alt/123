import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';
import { dismissToastsByKind } from '../lib/toasts';
import type { RenderResult } from '@/core/types';
import { retailBackendLabel, retailStructureLabel } from '../lib/retailLabels';

export function StatusPanel() {
  const error = useStudioStore((s) => s.error);
  const warnings = useStudioStore((s) => s.warnings);
  const result = useStudioStore((s) => s.result);
  const busy = useStudioStore((s) => s.busy);
  const mixerDirty = useStudioStore((s) => s.mixerDirty);

  return (
    <section className="panel" aria-live="polite">
      <h2>Status <HelpTip text={HELP.statusPanel} ariaLabel="About status panel" /></h2>
      {busy && (
        <>
          <p className="hint">Creating your sketch…</p>
          <div className="gen-progress" role="progressbar" aria-label="Generating" aria-valuetext="Creating your sketch" aria-busy="true">
            <span className="gen-progress-bar" />
          </div>
        </>
      )}
      {error && (
        <div className="status-error" role="alert">
          <p className="error-title">Something went wrong</p>
          <p className="error">{error}</p>
          <p className="hint">
            Tip: Sketch product uses the CPU browser path. Studio needs a local GPU setup —
            open Studio for the upgrade story, or stay on Sketch and Generate.
          </p>
          <button
            type="button"
            className="btn tiny ghost"
            onClick={() => {
              useStudioStore.setState({ error: null });
              dismissToastsByKind('error');
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="status-warnings">
          <p className="warn">{warnings[0]}</p>
          {warnings.length > 1 && (
            <details className="status-details status-warnings-more">
              <summary>
                {warnings.length - 1} more note{warnings.length - 1 === 1 ? '' : 's'}
              </summary>
              {warnings.slice(1).map((w, i) => (
                <p key={i + 1} className="warn">
                  {w}
                </p>
              ))}
            </details>
          )}
        </div>
      )}
      {result ? (
        <>
          <p className="status-success">
            Ready — hit <strong>Play</strong>
            {result.waveformPeaks?.length ? ' · waveform lit' : ''}
            {mixerDirty ? ' · preview has your tweaks' : ''}.
          </p>
          <details className="status-details">
            <summary>Job details</summary>
            <JobMeta result={result} />
          </details>
        </>
      ) : null}
    </section>
  );
}

function JobMeta({ result }: { result: RenderResult }) {
  return (
    <ul className="meta-list">
      <li>Job · {result.jobId}</li>
      <li>
        Backend · {retailBackendLabel(result.backendId)}
      </li>
      <li>BPM measured · {result.bpmMeasured}</li>
      <li>Seed · {result.seed}</li>
      <li>Structure · {retailStructureLabel(result.manifest.structureVersion)}</li>
      <li>
        Product · {result.manifest.productTier === 'studio' && result.manifest.gpuUsed ? 'Studio' : 'Sketch'}
        {' · '}
        {result.manifest.bitDepth}-bit
        {result.manifest.gpuUsed ? '' : ' Sketch'} · {result.manifest.sampleRateHz} Hz
      </li>
      <li>Stems · {result.stems.map((s) => s.id).join(', ')}</li>
      <li>
        Sections · {result.structure?.sections.map((s) => `${s.name}@${s.startBar}`).join(' → ')}
      </li>
      <li>GPU used · {String(result.manifest.gpuUsed)}</li>
      <li>
        Path ·{' '}
        {result.manifest.gpuUsed
          ? 'Studio · local GPU path'
          : `Sketch · CPU (${result.manifest.productTier ?? 'sketch'}) — Studio GPU later`}
      </li>
      {result.manifest.styleReference?.used && (
        <li>
          Style ref · {result.manifest.styleReference.fileName ?? 'your file'}
          {result.manifest.styleReference.estimatedBpm != null
            ? ` · ~${result.manifest.styleReference.estimatedBpm} BPM`
            : ''}
          {' · '}
          {result.manifest.styleReference.acePathActive
            ? 'Studio GPU style path'
            : 'Browser-sketch vibe bias only (not Studio stems)'}
        </li>
      )}
    </ul>
  );
}
