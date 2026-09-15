import { useStudioStore } from '../hooks/useStudioStore';
import type { FlowStep } from '@/core/types';
import { HELP } from '../lib/helpCopy';
import { HelpTip } from './HelpTip';

const STEPS: Array<{ id: FlowStep; n: number; label: string; simple: string }> = [
  { id: 'idle', n: 0, label: 'Ready', simple: 'Ready' },
  { id: 'generated', n: 1, label: '1 Generated', simple: 'Generated' },
  { id: 'played', n: 2, label: '2 Played', simple: 'Played' },
  { id: 'exported', n: 3, label: '3 Exported', simple: 'Exported' },
];

function rank(step: FlowStep): number {
  if (step === 'exported') return 3;
  if (step === 'played') return 2;
  if (step === 'generated') return 1;
  return 0;
}

export function FlowStatusChips() {
  const flowStep = useStudioStore((s) => s.flowStep);
  const mode = useStudioStore((s) => s.mode);
  const isSimple = mode === 'simple';
  const r = rank(flowStep);
  return (
    <div className={`flow-chips${isSimple ? ' flow-chips-simple' : ''}`} role="status" aria-label="Progress">
      {!isSimple && (
        <span className="label-with-tip flow-chips-head">
          <span className="label-with-tip-text sr-only">Progress</span>
          <HelpTip text={HELP.flowChips} ariaLabel="About progress chips" />
        </span>
      )}
      {STEPS.filter((s) => s.id !== 'idle').map((s) => (
        <span
          key={s.id}
          className={`flow-chip ${r >= s.n ? 'on' : ''} ${flowStep === s.id ? 'current' : ''}`}
        >
          {isSimple ? s.simple : s.label}
        </span>
      ))}
      {r === 0 && (
        <span className="flow-chip idle">
          {isSimple ? 'Ready' : 'Idle · Generate to start'}
        </span>
      )}
    </div>
  );
}
