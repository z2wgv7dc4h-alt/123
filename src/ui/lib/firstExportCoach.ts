/** #67 First-export teaching coach — once per browser; never stacks with first-play. */

const LS_KEY = 'dnb-studio-first-export-coach-v1';

let memoryDismissed = false;

export function shouldShowFirstExportCoach(): boolean {
  try {
    if (globalThis.localStorage) {
      return globalThis.localStorage.getItem(LS_KEY) !== '1';
    }
  } catch {
    /* private mode */
  }
  return !memoryDismissed;
}

export function dismissFirstExportCoach(): void {
  memoryDismissed = true;
  try {
    globalThis.localStorage?.setItem(LS_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function __resetFirstExportCoachForTests(): void {
  memoryDismissed = false;
  try {
    globalThis.localStorage?.removeItem(LS_KEY);
  } catch {
    /* */
  }
}
