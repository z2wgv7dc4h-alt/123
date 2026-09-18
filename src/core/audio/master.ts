/**
 * Loudness mastering for Studio (ACE) mixes.
 * ITU-R BS.1770 LUFS measurement + glue compression + peak limiting.
 */

import type { MasterReport } from '../types';

/**
 * One biquad section, direct form I. Coefficients are normalized by a0.
 * Shared by both K-weighting stages.
 */
function biquad(
  input: Float32Array,
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number,
): Float32Array {
  const out = new Float32Array(input.length);
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i]!;
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}

/**
 * ITU-R BS.1770-4 K-weighting = high-shelf (head pre-filter) then RLB
 * high-pass, both designed from the standard's analog prototype (the
 * libebur128 coefficients), so they are valid at any sample rate and hit the
 * published 48 kHz values exactly. The old hand-rolled "simplified" filter
 * attenuated everything by ~1e6, which made every measurement -Infinity and
 * silently no-opped mastering.
 */
function kWeight(channel: Float32Array, sampleRate: number): Float32Array {
  // Stage 1: high-shelf (~+4 dB above ~1.7 kHz).
  const shelfF0 = 1681.974450955533;
  const shelfGain = 3.999843853973347;
  const shelfQ = 0.7071752369554196;
  const kShelf = Math.tan((Math.PI * shelfF0) / sampleRate);
  const vh = Math.pow(10, shelfGain / 20);
  const vb = Math.pow(vh, 0.4996667741545416);
  const shelfA0 = 1 + kShelf / shelfQ + kShelf * kShelf;
  const shelfB0 = vh + (vb * kShelf) / shelfQ + kShelf * kShelf;
  const shelfB1 = 2 * (kShelf * kShelf - vh);
  const shelfB2 = vh - (vb * kShelf) / shelfQ + kShelf * kShelf;
  const shelfA1 = 2 * (kShelf * kShelf - 1);
  const shelfA2 = 1 - kShelf / shelfQ + kShelf * kShelf;
  const shelved = biquad(channel, shelfB0, shelfB1, shelfB2, shelfA0, shelfA1, shelfA2);

  // Stage 2: RLB high-pass (~38 Hz).
  const hpF0 = 38.13547087602444;
  const hpQ = 0.5003270373238773;
  const kHp = Math.tan((Math.PI * hpF0) / sampleRate);
  const hpA0 = 1 + kHp / hpQ + kHp * kHp;
  const hpA1 = 2 * (kHp * kHp - 1);
  const hpA2 = 1 - kHp / hpQ + kHp * kHp;
  return biquad(shelved, 1, -2, 1, hpA0, hpA1, hpA2);
}

/**
 * Compute integrated loudness per ITU-R BS.1770-4 (simplified gating).
 * Applies K-weighting (high-shelf + RLB high-pass) and measures RMS in 400 ms
 * blocks with 75% overlap. Returns -Infinity for silence.
 */
export function integratedLufs(left: Float32Array, right: Float32Array, sampleRate: number): number {
  if (left.length === 0 || right.length === 0) return -Infinity;

  const leftHp = kWeight(left, sampleRate);
  const rightHp = kWeight(right, sampleRate);

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
