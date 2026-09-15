/** Tiny toast event bus — single source of truth for App Toasts + store pushToast. */

export type ToastKind = 'success' | 'error' | 'info' | 'warn';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss ms; 0 = sticky until closed. Default 4200. */
  durationMs: number;
}

type Listener = (toasts: ToastItem[]) => void;

let seq = 0;
const items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = items.slice();
  for (const l of listeners) l(snapshot);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(items.slice());
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return items.slice();
}

export function dismissToast(id: string): void {
  const i = items.findIndex((t) => t.id === id);
  if (i >= 0) {
    items.splice(i, 1);
    emit();
  }
}

/** Drop all toasts of a kind (e.g. clear sticky errors with StatusPanel dismiss). */
export function dismissToastsByKind(kind: ToastKind): void {
  let changed = false;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]!.kind === kind) {
      items.splice(i, 1);
      changed = true;
    }
  }
  if (changed) emit();
}

export function pushToast(
  message: string,
  kind: ToastKind = 'info',
  durationMs = 4200,
): string {
  const id = `toast_${++seq}_${Date.now()}`;
  // Newest success wins: drop prior success toasts so the stack stays calm.
  if (kind === 'success') {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i]!.kind === 'success') items.splice(i, 1);
    }
  }
  items.push({ id, kind, message, durationMs });
  // Cap visible stack to 3 (cycle-7). Prefer dropping oldest info so warn/success stay (#50/#51).
  while (items.length > 3) {
    const infoIdx = items.findIndex((t) => t.kind === 'info');
    if (infoIdx >= 0 && infoIdx < items.length - 1) items.splice(infoIdx, 1);
    else items.shift();
  }
  emit();
  if (durationMs > 0) {
    globalThis.setTimeout(() => dismissToast(id), durationMs);
  }
  return id;
}

/** Test helper — wipe bus between suites. */
export function __resetToastsForTests(): void {
  items.length = 0;
  seq = 0;
  emit();
}
