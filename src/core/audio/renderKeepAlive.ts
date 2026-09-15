/**
 * Keep-alive helpers for long ACE GPU renders on the phone/LAN path.
 * Mobile browsers suspend background-tab network activity on screen-lock,
 * which drops the render fetch before the sidecar can respond (server logs
 * show ConnectionResetError writing the completed render). Wake Lock keeps
 * the screen (and tab) foregrounded for the duration of the render; the
 * heartbeat pings the bridge so a dead connection surfaces as an early
 * warning instead of a silent stall.
 */

type WakeLockSentinelLike = { release: () => Promise<void> };

let activeWakeLock: WakeLockSentinelLike | null = null;

export async function acquireRenderWakeLock(): Promise<void> {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    }) : undefined;
    if (!nav?.wakeLock) return;
    activeWakeLock = await nav.wakeLock.request('screen');
  } catch {
    activeWakeLock = null;
  }
}

export async function releaseRenderWakeLock(): Promise<void> {
  const lock = activeWakeLock;
  activeWakeLock = null;
  try {
    await lock?.release();
  } catch {
    /* already released (e.g. tab lost visibility) */
  }
}

export type Heartbeat = { stop: () => void };

/**
 * Polls `${bridgeBase}/health` every `intervalMs` while a render is pending.
 * Calls `onUnhealthy` (at most once per miss) so the UI can warn the user
 * their connection may drop the render, without touching the render promise.
 */
export function startRenderHeartbeat(
  bridgeBase: string,
  onUnhealthy: () => void,
  intervalMs = 15000,
): Heartbeat {
  if (typeof fetch !== 'function') return { stop: () => {} };
  const timer = setInterval(() => {
    fetch(`${bridgeBase}/health`, { method: 'GET' })
      .then((res) => {
        if (!res.ok) onUnhealthy();
      })
      .catch(() => onUnhealthy());
  }, intervalMs);
  return { stop: () => clearInterval(timer) };
}
