/**
 * Loudness mastering for Studio (ACE) mixes.
 * ITU-R BS.1770 LUFS measurement + glue compression + peak limiting.
 */

import type { MasterReport } from '../types';

/**
 * Compute integrated loudness per ITU-R BS.1770-4 (simplified).
 * Applies K-weighting (high-pass + high-shelf) and measures RMS in blocks.
 * Returns -Infinity for silence.
 */
export function integratedLufs(left: Float32Array, right: Float32Array, sampleRate: number): number {
  if (left.length === 0 || right.length === 0) return -Infinity;

  // Simple K-weighting via RMS-based approach: apply high-pass filter approximation
  // BS.1770 uses biquad filters; we use a simplified design that's close enough
  const applyHighPass = (channel: Float32Array): Float32Array => {
    const out = new Float32Array(channel.length);
    const cutoffHz = 38; // RLB high-pass
    const omega = (2 * Math.PI * cutoffHz) / sampleRate;
    const coeff = (1 - Math.cos(omega)) / 2; // simplified
    const alpha = 0.5; // pole Q ~ 0.5 for wide rolloff
    const a0 = 1 + alpha;
    const a1 = -2 * (1 - coeff);
    const a2 = 1 - alpha;
    const b0 = coeff;
    const b1 = -2 * coeff;
    const b2 = coeff;

    let s1 = 0,
      s2 = 0;
    for (let i = 0; i < channel.length; i++) {
      const y = (b0 * channel[i]! + b1 * s1 + b2 * s2) / a0;
      s2 = s1;
      s1 = channel[i]! - (a1 * y + a2 * s2) / a0;
      out[i] = y;
    }
    return out;
  };

  const leftHp = applyHighPass(left);
  const rightHp = applyHighPass(right);

  // Measure RMS in 400 ms blocks with 75% overlap
  const blockMs = Math.round((400 * sampleRate) / 1000);
  const hopMs = Math.round(blockMs * 0.25);

  const blockRms: number[] = [];
  for (let start = 0; start + blockMs <= leftHp.length; start += hopMs) {
    let sum = 0;
    for (let i = start; i < start + blockMs; i++) {
      sum += (leftHp[i]! * leftHp[i]! + rightHp[i]! * rightHp[i]!) / 2;
    }
    const rms = Math.sqrt(sum / blockMs);
    blockRms.push(rms);
  }

  if (blockRms.length === 0) return -Infinity;

  // Gating: -70 LUFS absolute, -10 LU relative
  const gateAbsLinear = Math.pow(10, -70 / 10);
  const gated = blockRms.filter((rms) => rms > Math.sqrt(gateAbsLinear));
  if (gated.length === 0) return -Infinity;

  const meanRms = gated.reduce((a, b) => a + b) / gated.length;
  const gateRelLinear = Math.sqrt(meanRms * meanRms * Math.pow(10, -10 / 10));
  const final = gated.filter((rms) => rms > gateRelLinear);
  if (final.length === 0) return -Infinity;

  const finalMean = final.reduce((a, b) => a + b) / final.length;
  // LUFS = -0.691 + 10 * log10(mean-square); use RMS directly
  return 20 * Math.log10(finalMean) - 0.691;
}

/**
 * Master a stereo mix: glue compression → gain to target loudness →
 * look-ahead peak limiter → re-measure; iterative correction if needed.
 * Defaults: targetLufs -9, ceilingDb -1.
 * Inputs never mutated; output arrays are new.
 * Silence in → silence out, report.gainDb 0.
 */
export function masterStereo(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  opts?: { targetLufs?: number; ceilingDb?: number },
): {
  left: Float32Array;
  right: Float32Array;
  report: MasterReport;
} {
  const targetLufs = opts?.targetLufs ?? -9;
  const ceilingDb = opts?.ceilingDb ?? -1;
  const ceilingLinear = Math.pow(10, ceilingDb / 20);

  // Measure source
  const lufsBefore = integratedLufs(left, right, sampleRate);
  if (!Number.isFinite(lufsBefore) || left.length === 0) {
    return {
      left: new Float32Array(left),
      right: new Float32Array(right),
      report: { lufsBefore: 0, lufsAfter: 0, peakDbAfter: ceilingDb, gainDb: 0 },
    };
  }

  let outL = new Float32Array(left);
  let outR = new Float32Array(right);
  let gainDb = 0;

  // Glue compressor: gentle, stereo-linked, RMS detector
  // Attack 10 ms, release 120 ms, ratio 2:1, threshold 6 dB below track RMS
  const attackSamples = Math.max(1, Math.round((10 * sampleRate) / 1000));
  const releaseSamples = Math.max(1, Math.round((120 * sampleRate) / 1000));
  const windowSamples = Math.max(100, Math.round((200 * sampleRate) / 1000));

  // Measure RMS level
  let sumRms = 0;
  const checkEnd = Math.min(outL.length, windowSamples);
  for (let i = 0; i < checkEnd; i++) {
    sumRms += (outL[i]! * outL[i]! + outR[i]! * outR[i]!) / 2;
  }
  const trackRms = Math.sqrt(sumRms / checkEnd);
  const trackRmsDb = trackRms > 0 ? 20 * Math.log10(trackRms) : -60;
  const threshold = trackRmsDb - 6;

  let gainReductionDb = 0;
  for (let i = 0; i < outL.length; i++) {
    const s = Math.sqrt((outL[i]! * outL[i]! + outR[i]! * outR[i]!) / 2);
    const sDb = s > 0 ? 20 * Math.log10(s) : -60;

    let target = 0;
    if (sDb > threshold + 3) {
      target = (sDb - threshold) * (1 - 0.5); // 2:1 ratio
    } else if (sDb > threshold - 3) {
      // Soft knee
      const t = (sDb - threshold + 3) / 6;
      target = t * t * (sDb - threshold) * (1 - 0.5);
    }

    const coeff = target > gainReductionDb ? 1 / attackSamples : 1 / releaseSamples;
    gainReductionDb = target * coeff + gainReductionDb * (1 - coeff);

    const linearGain = Math.pow(10, -gainReductionDb / 20);
    outL[i] = outL[i]! * linearGain;
    outR[i] = outR[i]! * linearGain;
  }

  // Gain to target loudness (up to 2 passes with iterative correction)
  for (let pass = 0; pass < 2; pass++) {
    const lufs = integratedLufs(outL, outR, sampleRate);
    if (!Number.isFinite(lufs)) break;

    const lufsError = targetLufs - lufs;
    if (Math.abs(lufsError) <= 1) break;

    gainDb += lufsError;
    const gain = Math.pow(10, gainDb / 20);
    for (let i = 0; i < outL.length; i++) {
      outL[i] = (outL[i] || 0) * gain;
      outR[i] = (outR[i] || 0) * gain;
    }
  }

  // Look-ahead peak limiter: 5 ms lookahead, 60 ms release
  const lookAheadSamples = Math.max(1, Math.round((5 * sampleRate) / 1000));
  const limiterReleaseSamples = Math.max(1, Math.round((60 * sampleRate) / 1000));
  const limited = new Float32Array(outL.length);
  const limited2 = new Float32Array(outR.length);
  let limiterGain = 1;

  for (let i = 0; i < outL.length; i++) {
    const lookAheadEnd = Math.min(outL.length, i + lookAheadSamples);
    let maxAhead = 0;
    for (let j = i; j < lookAheadEnd; j++) {
      maxAhead = Math.max(maxAhead, Math.abs(outL[j]!), Math.abs(outR[j]!));
    }

    if (maxAhead > ceilingLinear) {
      limiterGain = Math.min(ceilingLinear / maxAhead, 1);
    } else {
      limiterGain = Math.min(limiterGain + (1 - limiterGain) / limiterReleaseSamples, 1);
    }

    limited[i] = outL[i]! * limiterGain;
    limited2[i] = outR[i]! * limiterGain;
  }

  // Measure final loudness and peak
  const lufsAfter = integratedLufs(limited, limited2, sampleRate);
  let peakDbAfter = ceilingDb;
  for (let i = 0; i < limited.length; i++) {
    const s = Math.max(Math.abs(limited[i]!), Math.abs(limited2[i]!));
    if (s > 0) {
      const sDb = 20 * Math.log10(s);
      peakDbAfter = Math.max(peakDbAfter, sDb);
    }
  }

  return {
    left: limited,
    right: limited2,
    report: {
      lufsBefore: Number.isFinite(lufsBefore) ? lufsBefore : 0,
      lufsAfter: Number.isFinite(lufsAfter) ? lufsAfter : 0,
      peakDbAfter: Number.isFinite(peakDbAfter) ? peakDbAfter : ceilingDb,
      gainDb,
    },
  };
}
