/**
 * Pure envelope follower functions for live kick→bass sidechain ducking.
 */

/**
 * One envelope-follower step for the live rAF-driven kick→bass duck.
 * Same attack/release shape as OfflineStubBackend.sidechainDuckBass, but
 * stepped once per animation frame against a live kick level.
 */
export function duckEnvelopeStep(
  levelAbs: number,
  prevEnv: number,
  atkCoef: number,
  relCoef: number,
): number {
  const lvl = Math.max(0, Math.min(1, levelAbs));
  return lvl > prevEnv
    ? prevEnv * atkCoef + lvl * (1 - atkCoef)
    : prevEnv * relCoef + lvl * (1 - relCoef);
}

/** Linear duck gain (1 = no duck) from an envelope value — mirrors OfflineStubBackend's duck curve. */
export function duckGainFromEnvelope(env: number, duckDb: number): number {
  const duckLin = Math.pow(10, -duckDb / 20);
  const amount = Math.min(1, env * 1.15);
  return 1 - amount * (1 - duckLin);
}

export type DuckShapeParams = { duckDb: number; attackMs: number; releaseMs: number };

/**
 * Kick→bass duck shape (depth/attack/release) as a function of energy and
 * whether the song shape is a "hyped" one (dubstep/half-time-drop/trap-bounce).
 * Single source of truth shared by the offline render path
 * (OfflineStubBackend.sidechainDuckBass) and the live rAF envelope follower
 * (PreviewPlayer.startDuckLoop), so live-tweak preview punch cannot silently
 * drift from what export actually renders.
 */
export function computeDuckShapeParams(energy: number, hyped: boolean): DuckShapeParams {
  const e = Math.max(0, Math.min(1, Number.isFinite(energy) ? energy : 0));
  return {
    duckDb: (hyped ? 3.2 : 2.4) + e * (hyped ? 2.6 : 2.2),
    attackMs: 3 + (1 - e) * 5,
    releaseMs: (hyped ? 55 : 40) + (1 - e) * 40,
  };
}
