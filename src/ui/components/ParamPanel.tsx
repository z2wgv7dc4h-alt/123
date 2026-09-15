import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip, LabelWithTip } from './HelpTip';
import { pushToast } from '../lib/toasts';

export function ParamPanel() {
  const mode = useStudioStore((s) => s.mode);
  const seed = useStudioStore((s) => s.seed);
  const bpm = useStudioStore((s) => s.bpm);
  const bars = useStudioStore((s) => s.bars);
  const energy = useStudioStore((s) => s.energy);
  const darkness = useStudioStore((s) => s.darkness);
  const chaos = useStudioStore((s) => s.chaos);
  const promptText = useStudioStore((s) => s.promptText);
  const setSeed = useStudioStore((s) => s.setSeed);
  const keepSeed = useStudioStore((s) => s.keepSeed);
  const setKeepSeed = useStudioStore((s) => s.setKeepSeed);
  const setBpm = useStudioStore((s) => s.setBpm);
  const setBars = useStudioStore((s) => s.setBars);
  const setEnergy = useStudioStore((s) => s.setEnergy);
  const setDarkness = useStudioStore((s) => s.setDarkness);
  const setChaos = useStudioStore((s) => s.setChaos);
  const setPromptText = useStudioStore((s) => s.setPromptText);
  const paramsDirty = useStudioStore((s) => s.paramsDirty);
  const generateAgain = useStudioStore((s) => s.generateAgain);

  const isSimple = mode === 'simple';

  return (
    <section className="panel" aria-label="Arrangement parameters">
      <h2>
        Arrangement
        <HelpTip text={HELP.arrangement} ariaLabel="About arrangement" />
        <HelpTip text={HELP.paramsVsMixer} ariaLabel="Knobs vs mute solo" />
      </h2>
      <p className="hint">
        {isSimple
          ? 'Nudge the sketch feel. Tempo stays about 174. Knobs apply on next Generate (not live).'
          : 'Song layout places the bars. Drive / Mood / Chaos apply on next Generate — mute/solo/gain are live.'}
      </p>
      {paramsDirty && (
        <p className="regen-inline-hint" role="status">
          Settings changed ·{' '}
          <button type="button" className="btn tiny ghost" onClick={() => void generateAgain()}>
            Regenerate to hear these knobs
          </button>
        </p>
      )}

      {isSimple ? (
        <p className="bpm-pill-row" aria-label="Tempo">
          <span className="bpm-pill">174 BPM</span>
          <HelpTip text={HELP.bpmLock} ariaLabel="About BPM lock" />
        </p>
      ) : (
        <label>
          <LabelWithTip tip={HELP.bpmPower} tipLabel="About BPM">
            BPM · locked near 174 (UI band 170–176)
          </LabelWithTip>
          <input
            type="number"
            min={170}
            max={176}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </label>
      )}

      <div className="seed-row">
        <label>
          <LabelWithTip tip={HELP.seed} tipLabel="About seed">
            Seed · same seed → same song layout
          </LabelWithTip>
          <input
            type="number"
            value={seed}
            title="Deterministic structure seed"
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <span className="transport-btn-wrap">
          <button
            type="button"
            className="btn ghost tiny"
            title="Copy seed to clipboard"
            onClick={() => {
              const text = String(seed >>> 0);
              const ok = async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  pushToast('Seed copied', 'success', 2200);
                } catch {
                  pushToast('Could not copy seed', 'warn', 2800);
                }
              };
              void ok();
            }}
          >
            Copy seed
          </button>
          <HelpTip text={HELP.seedCopy} ariaLabel="About copy seed" />
        </span>
        <span className="transport-btn-wrap">
          <button
            type="button"
            className="btn ghost tiny"
            title="Copy seed + knobs as text"
            onClick={() => {
              const pack = [
                `seed=${seed >>> 0}`,
                `bpm=${bpm}`,
                `bars=${bars}`,
                `energy=${energy.toFixed(3)}`,
                `darkness=${darkness.toFixed(3)}`,
                `chaos=${chaos.toFixed(3)}`,
                `prompt=${promptText}`,
              ].join('\n');
              void (async () => {
                try {
                  await navigator.clipboard.writeText(pack);
                  pushToast('Settings copied', 'success', 2200);
                } catch {
                  pushToast('Could not copy settings', 'warn', 2800);
                }
              })();
            }}
          >
            Copy settings
          </button>
          <HelpTip text={HELP.copySettings} ariaLabel="About copy settings" />
        </span>
        {!isSimple && (
          <button
            type="button"
            className="btn ghost"
            title="Pick a fresh uint32 seed"
            onClick={() => setSeed((Math.random() * 1e9) >>> 0)}
          >
            Shuffle seed
          </button>
        )}
        <label className="keep-seed-toggle" title="Keep seed on Generate">
          <input
            type="checkbox"
            checked={keepSeed}
            onChange={(e) => setKeepSeed(e.target.checked)}
          />
          <span>Keep seed</span>
          <HelpTip text={HELP.keepSeed} ariaLabel="About Keep seed" />
        </label>
      </div>
      {!isSimple && (
        <>
          <label>
            Bars · Power only (16–64)
            <input
              type="number"
              min={16}
              max={64}
              step={4}
              value={bars}
              onChange={(e) => setBars(Number(e.target.value))}
            />
          </label>
        </>
      )}

      <label>
        <LabelWithTip tip={HELP.energy} tipLabel="About energy">
          {isSimple ? `Drive · ${energy.toFixed(2)}` : `Energy · drive / drop weight · ${energy.toFixed(2)}`}
        </LabelWithTip>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={energy}
          onChange={(e) => setEnergy(Number(e.target.value))}
        />
      </label>
      <label>
        <LabelWithTip tip={HELP.darkness} tipLabel="About darkness / mood">
          {isSimple ? `Mood · ${darkness.toFixed(2)}` : `Darkness · bass mood · ${darkness.toFixed(2)}`}
        </LabelWithTip>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={darkness}
          onChange={(e) => setDarkness(Number(e.target.value))}
        />
      </label>
      <label>
        <LabelWithTip tip={HELP.chaos} tipLabel="About chaos">
          Chaos · {chaos.toFixed(2)}
        </LabelWithTip>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={chaos}
          onChange={(e) => setChaos(Number(e.target.value))}
        />
      </label>
      <label>
        <LabelWithTip tip={HELP.styleText} tipLabel="About style text">
          Style text · mood / vibe words (artist names OK as descriptors)
        </LabelWithTip>
        <textarea
          rows={3}
          value={promptText}
          placeholder="deep bass, half-time break, Pendulum-vibe…"
          onChange={(e) => setPromptText(e.target.value)}
        />
      </label>
    </section>
  );
}
