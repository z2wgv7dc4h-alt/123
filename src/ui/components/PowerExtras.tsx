import { backendRegistry } from '@/core/registry';
import { getAceSidecarBase } from '@/core/backends';
import type { Coherence, ExportManifest, MasterTarget, SamplerMethod } from '@/core/types';
import { loraNotes, useStudioStore } from '../hooks/useStudioStore';
import { useEffect, useMemo, useState } from 'react';
import { HELP } from '../lib/helpCopy';
import { retailCapLabel, retailCapState } from '../lib/retailLabels';
import { HelpTip } from './HelpTip';

type LoraOption = {
  id: string;
  label?: string;
  path: string;
  baseModel?: string | null;
};

// Which one is "in use" comes from the GPU server's probe (aceCheckpoint),
// never from this list. Order = quality preference.
const STUDIO_MODELS = [
  {
    id: 'acestep-v15-xl-turbo',
    label: 'Studio XL turbo',
    hint: '4B, best quality — default',
  },
  {
    id: 'acestep-v15-sft',
    label: 'Studio SFT',
    hint: 'High detail — optional',
  },
  {
    id: 'acestep-v15-base',
    label: 'Studio base',
    hint: 'High quality, 64 steps — optional',
  },
  {
    id: 'acestep-v15-turbo',
    label: 'Studio turbo',
    hint: 'Fast, 8 steps — only when you pick it',
  },
] as const;

export function PowerExtras() {
  const backendId = useStudioStore((s) => s.backendId);
  const setBackendId = useStudioStore((s) => s.setBackendId);
  const loraPath = useStudioStore((s) => s.loraPath);
  const setLoraPath = useStudioStore((s) => s.setLoraPath);
  const loraScale = useStudioStore((s) => s.loraScale);
  const setLoraScale = useStudioStore((s) => s.setLoraScale);
  const aceHasGpu = useStudioStore((s) => s.aceHasGpu);
  const aceCheckpoint = useStudioStore((s) => s.aceCheckpoint);
  const exportBitDepth = useStudioStore((s) => s.exportBitDepth);
  const setExportBitDepth = useStudioStore((s) => s.setExportBitDepth);
  const masterOn = useStudioStore((s) => s.masterOn);
  const setMasterOn = useStudioStore((s) => s.setMasterOn);
  const masterTarget = useStudioStore((s) => s.masterTarget);
  const setMasterTarget = useStudioStore((s) => s.setMasterTarget);
  const recreateFromManifest = useStudioStore((s) => s.recreateFromManifest);
  const [recreateMsg, setRecreateMsg] = useState<string | null>(null);

  const onRecreateFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as ExportManifest;
      if (!parsed || typeof parsed !== 'object' || !('seed' in parsed) || !parsed.prompt) {
        throw new Error('Not a DnB Studio manifest.json');
      }
      setRecreateMsg(null);
      await recreateFromManifest(parsed);
    } catch (e) {
      setRecreateMsg(e instanceof Error ? e.message : String(e));
    }
  };
  const coherence = useStudioStore((s) => s.coherence);
  const setCoherence = useStudioStore((s) => s.setCoherence);
  const sampler = useStudioStore((s) => s.sampler);
  const setSampler = useStudioStore((s) => s.setSampler);
  const realBreakOn = useStudioStore((s) => s.layers.realBreak);
  const realBreakGainDb = useStudioStore((s) => s.realBreakGainDb);
  const setRealBreakGainDb = useStudioStore((s) => s.setRealBreakGainDb);
  const result = useStudioStore((s) => s.result);
  const finishTake = useStudioStore((s) => s.finishTake);
  const [loras, setLoras] = useState<LoraOption[]>([]);
  const [loraNote, setLoraNote] = useState<string | null>(null);
  const backends = backendRegistry.list();
  const active = useMemo(() => backends.find((b) => b.id === backendId) ?? backends[0], [backends, backendId]);
  const caps = active?.capabilities;

  // List real adapter dirs from the bridge (ACE_LORA_DIR); fail soft when down.
  useEffect(() => {
    let cancelled = false;
    if (!aceHasGpu) {
      setLoras([]);
      setLoraNote(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${getAceSidecarBase()}/loras`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { loras?: LoraOption[] };
        if (cancelled) return;
        setLoras(Array.isArray(data?.loras) ? data.loras : []);
        setLoraNote(
          data?.loras?.length
            ? 'Applies before Generate only when changed.'
            : 'No adapters found — drop LoRAs in ACE_LORA_DIR on the GPU PC.',
        );
      } catch {
        if (!cancelled) {
          setLoras([]);
          setLoraNote('LoRA list unavailable — bridge not reachable.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aceHasGpu]);

  return (
    <section className="panel section-accent-power">
      <h2>
        Sound &amp; engine
        <HelpTip text={HELP.powerPanel} ariaLabel="About sound and engine controls" />
      </h2>

      <p className="power-callout" role="note">
        <strong>Studio</strong> = ACE on your local GPU (RTX 5080) when the bridge is green.{' '}
        <strong>Sketch</strong> = CPU browser path. If Studio is offline, Generate fail-softs to
        Sketch — never fake GPU audio.
      </p>

      <label className="export-bit-depth">
        <span className="label-with-tip">
          <span className="label-with-tip-text">Export bit depth (Sketch)</span>
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

      <label className="master-loudness">
        <input
          type="checkbox"
          checked={masterOn}
          onChange={(e) => setMasterOn(e.target.checked)}
          title="Apply loudness mastering (-9 LUFS, -1 dB ceiling) to Studio takes"
        />
        <span>Master for loudness (Studio)</span>
      </label>

      <label className="master-target">
        <span className="label-with-tip">
          <span className="label-with-tip-text">Mastering target</span>
        </span>
        <select
          value={masterTarget}
          disabled={!masterOn}
          onChange={(e) => setMasterTarget(e.target.value as MasterTarget)}
          title="Target loudness: Loud -9 / Balanced -11 (default) / Dynamic -14 LUFS"
        >
          <option value="loud">Loud · -9 LUFS</option>
          <option value="balanced">Balanced · -11 LUFS (default)</option>
          <option value="dynamic">Dynamic · -14 LUFS</option>
        </select>
      </label>

      <button
        type="button"
        className="btn ghost btn-finish"
        disabled={!result || !String(result.backendId).startsWith('ace-step')}
        onClick={() => void finishTake()}
        title="Bridge Demucs stem rebalance + pedalboard/pyloudnorm club master (new take version)"
      >
        Finish (club)
      </button>

      <label className="recreate-manifest">
        <span className="label-with-tip">
          <span className="label-with-tip-text">Recreate from manifest.json</span>
        </span>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onRecreateFile(f);
            e.target.value = '';
          }}
          title="Load a ZIP's manifest.json to re-render with its exact params"
        />
      </label>
      {recreateMsg && (
        <p className="warn" role="status">
          {recreateMsg}
        </p>
      )}

      <label className="coherence-select">
        <span className="label-with-tip">
          <span className="label-with-tip-text">Coherence (Studio LM)</span>
        </span>
        <select
          value={coherence}
          onChange={(e) => setCoherence(e.target.value as Coherence)}
          title="LM sampling temperature: Tight 0.6 · Balanced 0.7 · Wild 0.9 (clamped 0.3-1.0)"
        >
          <option value="tight">Tight · 0.6</option>
          <option value="balanced">Balanced · 0.7 (default)</option>
          <option value="wild">Wild · 0.9</option>
        </select>
      </label>

      <label className="sampler-select">
        <span className="label-with-tip">
          <span className="label-with-tip-text">Sampler (Studio)</span>
        </span>
        <select
          value={sampler}
          onChange={(e) => setSampler(e.target.value as SamplerMethod)}
          title="ACE infer_method: ODE is deterministic, SDE adds noise for more variation"
        >
          <option value="ode">ODE · deterministic (default)</option>
          <option value="sde">SDE · more variation</option>
        </select>
      </label>

      <label className="real-break-level">
        <span className="label-with-tip">
          <span className="label-with-tip-text">
            Real break level · {realBreakGainDb} dB{realBreakOn ? '' : ' (off)'}
          </span>
        </span>
        <input
          type="range"
          min={-6}
          max={0}
          step={1}
          value={Math.min(0, Math.max(-6, realBreakGainDb + 12))}
          disabled={!realBreakOn}
          onChange={(e) => setRealBreakGainDb(-12 + Number(e.target.value))}
          title="Trim the break-under-drops bus: 0 dB keeps the -12 dB default, -6 dB makes it -18 dB"
        />
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
          </span>
        ))}
      </div>

      <label>
        <span className="label-with-tip">
          <span className="label-with-tip-text">Audio path</span>
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
        </div>
      )}

      <p className="hint label-with-tip" style={{ marginBottom: '0.45rem' }}>
        <span className="label-with-tip-text">
          Studio models live on your GPU PC (not downloaded in this tab). Loaded:{' '}
          {aceCheckpoint ?? 'unknown until the GPU server answers'}.
        </span>
      </p>
      <div className="model-slots">
        {STUDIO_MODELS.map((m) => (
          <div
            key={m.id}
            className={`model-slot${m.id === aceCheckpoint ? ' model-slot-active' : ''}`}
          >
            <strong>{m.label}</strong>
            <span className="meta" title={m.id}>
              {m.id === aceCheckpoint
                ? aceHasGpu
                  ? 'In use · GPU live'
                  : 'Last seen · GPU offline'
                : 'Not loaded'}
            </span>
            <span style={{ display: 'block', marginTop: '0.35rem' }}>{m.hint}</span>
          </div>
        ))}
      </div>

      <details className="lora-adapter">
        <summary>LoRA adapter (Studio GPU)</summary>

        <label>
          <span className="label-with-tip">
            <span className="label-with-tip-text">LoRA</span>
          </span>
          <select
            value={loraPath ?? ''}
            onChange={(e) => setLoraPath(e.target.value || null)}
            disabled={!aceHasGpu}
            title="Adapter dirs under ACE_LORA_DIR on the GPU PC (2B vs XL must match the loaded DiT)"
          >
            <option value="">None</option>
            {loras.map((l) => (
              <option key={l.path} value={l.path}>
                {(l.label ?? l.id) + (l.baseModel ? ` · ${l.baseModel}` : '')}
              </option>
            ))}
          </select>
        </label>

        <label className="lora-scale">
          <span>Scale · {loraScale.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={loraScale}
            disabled={!loraPath}
            onChange={(e) => setLoraScale(Number(e.target.value))}
            title="LoRA strength 0-1 (default 0.7) — applied before Generate"
          />
        </label>

        {loraNote && <p className="hint">{loraNote}</p>}
      </details>

      <details>
        <summary>Provenance details</summary>
        <pre className="notes">{loraNotes()}</pre>
      </details>
    </section>
  );
}
