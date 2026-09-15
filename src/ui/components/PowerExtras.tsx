import { backendRegistry } from '@/core/registry';
import { listLoraPacks, loraNotes, useStudioStore } from '../hooks/useStudioStore';
import { loraPackManager } from '@/core/lora';
import { useMemo, useState } from 'react';
import { HELP } from '../lib/helpCopy';
import { retailCapLabel, retailCapState } from '../lib/retailLabels';
import { HelpTip } from './HelpTip';

const STUDIO_MODELS = [
  {
    id: 'acestep-v15-turbo',
    label: 'Studio turbo',
    hint: 'Fast GPU path — what Generate uses now',
    status: 'active' as const,
  },
  {
    id: 'acestep-v15-base',
    label: 'Studio base',
    hint: 'Higher quality, slower — not selected yet',
    status: 'available' as const,
  },
  {
    id: 'acestep-v15-xl-base',
    label: 'Studio XL',
    hint: 'Largest model — needs more VRAM; not installed here',
    status: 'later' as const,
  },
] as const;

export function PowerExtras() {
  const backendId = useStudioStore((s) => s.backendId);
  const setBackendId = useStudioStore((s) => s.setBackendId);
  const loraPackId = useStudioStore((s) => s.loraPackId);
  const setLoraPackId = useStudioStore((s) => s.setLoraPackId);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const exportBitDepth = useStudioStore((s) => s.exportBitDepth);
  const setExportBitDepth = useStudioStore((s) => s.setExportBitDepth);
  const [trainMsg, setTrainMsg] = useState<string | null>(null);
  const backends = backendRegistry.list();
  const packs = listLoraPacks();
  const active = useMemo(() => backends.find((b) => b.id === backendId) ?? backends[0], [backends, backendId]);
  const caps = active?.capabilities;

  return (
    <section className="panel section-accent-power">
      <h2>
        Advanced
        <HelpTip text={HELP.powerPanel} ariaLabel="About Advanced panel" />
      </h2>

      <p className="power-callout" role="note">
        <strong>Studio</strong> = ACE on your local GPU (RTX 5080) when the bridge is green.{' '}
        <strong>Sketch</strong> = CPU browser path. If Studio is offline, Generate fail-softs to
        Sketch — never fake GPU audio.
      </p>

      <label className="export-bit-depth">
        <span className="label-with-tip">
          <span className="label-with-tip-text">Export bit depth (Sketch)</span>
          <HelpTip text={HELP.exportBitDepth} ariaLabel="About export bit depth" />
        </span>
        <select
          value={exportBitDepth}
          onChange={(e) => setExportBitDepth(e.target.value === '24' ? 24 : 16)}
          title="Sketch WAV bit depth — 16 default, 24 optional; not Studio GPU"
        >
          <option value={16}>16-bit Sketch (default)</option>
          <option value={24}>24-bit Sketch</option>
        </select>
      </label>

      <div className="backend-badges" aria-label="Audio path badges">
        {backends.map((b) => (
          <span
            key={b.id}
            className={`chip ${b.capabilities.requiresGpu ? 'gpu' : 'cpu'}${b.id === backendId ? '' : ' off'}`}
          >
            {b.capabilities.requiresGpu
              ? aceHasGpu
                ? 'Studio GPU'
                : 'Studio (gated)'
              : 'Sketch CPU'}{' '}
            · {b.displayName}
            <HelpTip
              text={b.capabilities.requiresGpu ? HELP.backendGpu : HELP.backendCpu}
              ariaLabel={`About ${b.displayName} badge`}
            />
          </span>
        ))}
      </div>

      <label>
        <span className="label-with-tip">
          <span className="label-with-tip-text">Audio path</span>
          <HelpTip text={HELP.backendSelect} ariaLabel="About audio path" />
        </span>
        <select
          value={backendId}
          onChange={(e) => setBackendId(e.target.value)}
          title="Studio uses local ACE GPU when probe is green; Sketch is always available"
        >
          {backends.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}{' '}
              {b.capabilities.requiresGpu
                ? aceHasGpu
                  ? '(GPU · live)'
                  : '(GPU · offline)'
                : '(CPU · ready)'}
            </option>
          ))}
        </select>
      </label>

      {caps && (
        <div className="caps-list" aria-label="Audio path capabilities">
          <span className="chip">
            {retailCapLabel('fullSong')} · {retailCapState(caps.fullSong)}
          </span>
          <span className="chip">
            {retailCapLabel('legoStems')} · {retailCapState(caps.legoStems, true)}
          </span>
          <span className="chip">
            {retailCapLabel('extract')} · {retailCapState(caps.extract)}
          </span>
          <span className="chip">
            {retailCapLabel('repaint')} · {retailCapState(caps.repaint)}
          </span>
          <span className="chip">
            {retailCapLabel('loraLoad')} · {retailCapState(caps.loraLoad)}
          </span>
          <span className="chip">
            {retailCapLabel('maxDurationSec')} · {caps.maxDurationSec}s
          </span>
          <span className="chip">
            {retailCapLabel('sampleRatesHz')} · {caps.sampleRatesHz.join('/')} Hz
          </span>
          <HelpTip text={HELP.powerCaps} ariaLabel="About engine capabilities" />
        </div>
      )}

      <p className="hint label-with-tip" style={{ marginBottom: '0.45rem' }}>
        <span className="label-with-tip-text">
          Studio models live on your GPU PC (not downloaded in this tab). Active path: turbo.
        </span>
        <HelpTip text={HELP.aceModels} ariaLabel="About Studio models" />
      </p>
      <div className="model-slots">
        {STUDIO_MODELS.map((m) => (
          <div
            key={m.id}
            className={`model-slot${m.status === 'active' ? ' model-slot-active' : ''}`}
          >
            <strong>{m.label}</strong>
            <span className="meta" title={m.id}>
              {m.status === 'active'
                ? aceHasGpu
                  ? 'In use · GPU live'
                  : 'In use · GPU offline'
                : m.status === 'available'
                  ? 'Optional · not selected'
                  : 'Later · not installed'}
            </span>
            <span style={{ display: 'block', marginTop: '0.35rem' }}>{m.hint}</span>
            <HelpTip text={HELP.aceModels} ariaLabel={`About ${m.label}`} />
          </div>
        ))}
      </div>

      <label>
        <span className="label-with-tip">
          <span className="label-with-tip-text">Style pack</span>
          <HelpTip text={HELP.loraPack} ariaLabel="About style packs" />
        </span>
        <select
          value={loraPackId ?? ''}
          onChange={(e) => setLoraPackId(e.target.value || null)}
          title="Early style packs — full training when Studio GPU training exists"
        >
          <option value="">None</option>
          {packs.map((p) => (
            <option key={p.packId} value={p.packId}>
              {p.name} [{p.status}]
            </option>
          ))}
        </select>
      </label>

      <span className="label-with-tip" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <button
          type="button"
          className="btn ghost"
          disabled={!loraPackId}
          title="Training needs Studio GPU later — you’ll get a clear message until then"
          onClick={() => {
            if (!loraPackId) return;
            setTrainMsg(null);
            void loraPackManager.requestTrain(loraPackId).catch((e: Error) => setTrainMsg(e.message));
          }}
        >
          Request style-pack train (GPU)
        </button>
        <HelpTip text={HELP.loraPack} ariaLabel="About style-pack training" />
      </span>
      {trainMsg && (
        <p className="warn" role="status">
          Not available yet: {trainMsg}
        </p>
      )}
      {!trainMsg && (
        <p className="hint">
          Training needs Studio GPU later — you’ll get a clear message until then.
        </p>
      )}

      <details>
        <summary>Provenance details</summary>
        <pre className="notes">{loraNotes()}</pre>
      </details>
    </section>
  );
}
