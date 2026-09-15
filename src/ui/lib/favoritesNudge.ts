/** #49 Post-Play favorites nudge — once per browser. */
const LS_KEY = 'dnb-studio-favorites-nudge-v1';
let memoryDone = false;

export function shouldShowFavoritesNudge(): boolean {
  try {
    if (globalThis.localStorage) {
      return globalThis.localStorage.getItem(LS_KEY) !== '1';
    }
  } catch {
    /* */
  }
  return !memoryDone;
}

export function dismissFavoritesNudge(): void {
  memoryDone = true;
  try {
    globalThis.localStorage?.setItem(LS_KEY, '1');
  } catch {
    /* */
  }
}

export function __resetFavoritesNudgeForTests(): void {
  memoryDone = false;
  try {
    globalThis.localStorage?.removeItem(LS_KEY);
  } catch {
    /* */
  }
}
