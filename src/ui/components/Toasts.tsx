import { useEffect, useState } from 'react';
import {
  dismissToast,
  subscribeToasts,
  type ToastItem,
} from '../lib/toasts';
import { useStudioStore } from '../hooks/useStudioStore';

/** Accessible snackbar stack — single bus from lib/toasts (store pushToast). */
export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const storeError = useStudioStore((s) => s.error);

  useEffect(() => subscribeToasts(setItems), []);

  const dismiss = (t: ToastItem) => {
    dismissToast(t.id);
    // Sticky store errors stay in sync when the toast is dismissed.
    if (t.kind === 'error') {
      useStudioStore.setState({ error: null });
    }
  };

  // Mirror sticky store.error into the stack if bus somehow missed it.
  const shown = items.slice(-3); // cycle-7: visible stack ≤3
  if (storeError && !shown.some((t) => t.kind === 'error' && t.message === storeError)) {
    shown.push({
      id: 'store-error',
      kind: 'error',
      message: storeError,
      durationMs: 0,
    });
  }
  const capped = shown.slice(-3);

  if (!capped.length) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {capped.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          role={t.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-kind" aria-hidden="true">{t.kind}</span>
          <span className="toast-msg">{t.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Dismiss notification"
            onClick={() => {
              if (t.id === 'store-error') {
                useStudioStore.setState({ error: null });
              } else {
                dismiss(t);
              }
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
