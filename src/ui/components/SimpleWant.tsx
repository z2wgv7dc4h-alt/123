import { useStudioStore } from '../hooks/useStudioStore';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

/**
 * Step 1 of Simple Mode process: what do you want?
 * Prompt up top (not buried in More / ParamPanel).
 */
export function SimpleWant() {
  const promptText = useStudioStore((s) => s.promptText);
  const setPromptText = useStudioStore((s) => s.setPromptText);
  const busy = useStudioStore((s) => s.busy);

  return (
    <section className="simple-want panel" aria-label="What do you want" id="want">
      <div className="simple-want-head">
        <h2>
          <span className="step-num" aria-hidden>1</span> What do you want?
          <HelpTip text={HELP.styleText} ariaLabel="About style text" />
        </h2>
        <p className="hint">Mood words · optional. Drop a vibe MP3 below if you have one.</p>
      </div>
      <label className="simple-want-label">
        <span className="sr-only">Style prompt</span>
        <textarea
          rows={2}
          disabled={busy}
          value={promptText}
          placeholder="Describe the vibe (e.g. rock DnB, bright drops…)"
          onChange={(e) => setPromptText(e.target.value)}
        />
      </label>
    </section>
  );
}
