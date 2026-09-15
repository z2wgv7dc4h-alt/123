/** #86 Once-flag post-export DAW tip — localStorage; mutex vs coaches in UI. */

export const EXPORT_DAW_TIP_KEY = 'dnb-export-daw-tip-v1';

let memorySeen = false;

export function shouldShowExportDawTip(): boolean {
  try {
    if (globalThis.localStorage) {
      return globalThis.localStorage.getItem(EXPORT_DAW_TIP_KEY) !== '1';
    }
  } catch {
    /* private mode */
  }
  return !memorySeen;
}

export function markExportDawTipSeen(): void {
  memorySeen = true;
  try {
    globalThis.localStorage?.setItem(EXPORT_DAW_TIP_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Test helper. */
export function __resetExportDawTipForTests(): void {
  memorySeen = false;
  try {
    globalThis.localStorage?.removeItem(EXPORT_DAW_TIP_KEY);
  } catch {
    /* */
  }
}
