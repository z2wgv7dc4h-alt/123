/** #43 First-Play teaching coach — once per browser via localStorage. */

const LS_KEY = 'dnb-studio-first-play-coach-v1';

/** In-memory fallback when localStorage is unavailable (vitest/node). */
let memoryDismissed = false;

export function shouldShowFirstPlayCoach(): boolean {
  try {
    if (globalThis.localStorage) {
      return globalThis.localStorage.getItem(LS_KEY) !== '1';
    }
  } catch {
    /* private mode */
  }
  return !memoryDismissed;
}

export function dismissFirstPlayCoach(): void {
  memoryDismissed = true;
  try {
    globalThis.localStorage?.setItem(LS_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Test helper. */
export function __resetFirstPlayCoachForTests(): void {
  memoryDismissed = false;
  try {
    globalThis.localStorage?.removeItem(LS_KEY);
  } catch {
    /* */
  }
}
