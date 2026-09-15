/**
 * #55 Resume last seed+knobs (no audio blob) — browser localStorage only.
 */

export const RESUME_DRAFT_KEY = 'dnb-studio-resume-draft-v1';
export const RESUME_DRAFT_DISMISS_KEY = 'dnb-studio-resume-draft-dismiss-v1';

export type ResumeDraft = {
  seed: number;
  bpm: number;
  bars: number;
  energy: number;
  darkness: number;
  chaos: number;
  promptText: string;
  vibeIntensity: number;
  savedAt: number;
};

/** In-memory fallback when localStorage is unavailable (vitest/node). */
let memoryDraft: ResumeDraft | null = null;
let memoryDismissed = false;

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isDraft(v: unknown): v is ResumeDraft {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.seed === 'number' &&
    typeof o.bpm === 'number' &&
    typeof o.bars === 'number' &&
    typeof o.energy === 'number' &&
    typeof o.darkness === 'number' &&
    typeof o.chaos === 'number' &&
    typeof o.promptText === 'string' &&
    typeof o.vibeIntensity === 'number' &&
    typeof o.savedAt === 'number'
  );
}

export function saveResumeDraft(
  input: Omit<ResumeDraft, 'savedAt'>,
): ResumeDraft {
  const draft: ResumeDraft = { ...input, savedAt: Date.now() };
  memoryDraft = draft;
  memoryDismissed = false;
  const s = storage();
  if (s) {
    s.setItem(RESUME_DRAFT_KEY, JSON.stringify(draft));
    s.removeItem(RESUME_DRAFT_DISMISS_KEY);
  }
  return draft;
}

export function loadResumeDraft(): ResumeDraft | null {
  const s = storage();
  if (s) {
    try {
      const raw = s.getItem(RESUME_DRAFT_KEY);
      if (!raw) return memoryDraft;
      const parsed = JSON.parse(raw) as unknown;
      return isDraft(parsed) ? parsed : memoryDraft;
    } catch {
      return memoryDraft;
    }
  }
  return memoryDraft;
}

export function clearResumeDraft(): void {
  memoryDraft = null;
  memoryDismissed = false;
  const s = storage();
  if (!s) return;
  s.removeItem(RESUME_DRAFT_KEY);
  s.removeItem(RESUME_DRAFT_DISMISS_KEY);
}

export function dismissResumeDraftStrip(): void {
  memoryDismissed = true;
  const s = storage();
  if (!s) return;
  s.setItem(RESUME_DRAFT_DISMISS_KEY, '1');
}

export function shouldShowResumeDraftStrip(): boolean {
  const draft = loadResumeDraft();
  if (!draft) return false;
  try {
    if (storage()?.getItem(RESUME_DRAFT_DISMISS_KEY) === '1') return false;
  } catch {
    /* */
  }
  if (memoryDismissed) return false;
  return true;
}

/** Test helper. */
export function __resetResumeDraftForTests(): void {
  memoryDraft = null;
  memoryDismissed = false;
  const s = storage();
  if (!s) return;
  s.removeItem(RESUME_DRAFT_KEY);
  s.removeItem(RESUME_DRAFT_DISMISS_KEY);
}
