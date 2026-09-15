/**
 * Map raw backend / browser errors into short actionable status copy.
 * Keeps ACE/5080 path explicit without dumping stack traces into the UI.
 */
export function formatStudioError(raw: string): string {
  const msg = (raw || '').trim() || 'Unknown error';
  if (/503|gpu_required|hasGpu.?false|sidecar unreachable|GPU required|requires a local GPU/i.test(msg)) {
    return [
      'Studio GPU path offline right now (bridge/ACE not ready).',
      'Hard-refresh after start-ace-stack, or stay on Sketch (CPU) in Simple.',
    ].join(' ');
  }
  if (/ACE sidecar \/render|ACE sidecar HTTP|upstream_/i.test(msg)) {
    return [
      'Studio ACE render failed — weights may still be loading on the 5080.',
      'Leave ACE running and retry Generate in a minute.',
      sanitizeChrome(msg.split('\n')[0]!.slice(0, 160)),
    ].filter(Boolean).join(' ');
  }
  if (/ACE-Step|CUDA|sidecar/i.test(msg)) {
    return sanitizeChrome(msg.split('\n')[0]!.slice(0, 280));
  }
  if (/cancelled/i.test(msg)) {
    return 'Render cancelled.';
  }
  if (/All stems muted/i.test(msg)) {
    return 'All stems are muted — unmute at least one stem, then Play.';
  }
  if (/Generate first/i.test(msg)) {
    return 'Nothing to export yet — press Generate, then Export ZIP.';
  }
  if (/Preview load timeout/i.test(msg)) {
    return 'Preview failed to load the mix WAV — try Generate again.';
  }
  if (/zip|export/i.test(msg) && /fail|error|abort/i.test(msg)) {
    return `Export issue: ${sanitizeChrome(msg)} — falling back to individual stem downloads when possible.`;
  }
  const oneLine = sanitizeChrome(msg.split('\n')[0]!.slice(0, 280));
  return oneLine;
}

/** Never leak OfflineStub / hard-grid-v0 into chrome. */
function sanitizeChrome(s: string): string {
  return s
    .replace(/OfflineStubBackend/gi, 'browser sketch')
    .replace(/OfflineStub/gi, 'browser sketch')
    .replace(/hard-grid-v\d+/gi, 'song layout ~174')
    .replace(/hard-grid/gi, 'song layout');
}

export type ToastKind = 'error' | 'warn' | 'success' | 'info';

export interface ToastPayload {
  id: number;
  kind: ToastKind;
  message: string;
}
