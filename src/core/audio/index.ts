export { PreviewPlayer, previewPlayer, audibleStemIds, renderRemixedWavBlob } from './PreviewPlayer';
export { acquireRenderWakeLock, releaseRenderWakeLock, startRenderHeartbeat } from './renderKeepAlive';
export type { Heartbeat } from './renderKeepAlive';
export type { PreviewState, RemixedWavResult } from './PreviewPlayer';
export { computeWaveformPeaks, bufferRms } from './waveformPeaks';
export { wavPcmPeakAbs, EXPORT_HOT_PEAK, EXPORT_HOT_PEAK_PREGLUE } from './wavPeak';
export {
  STYLE_REF_ACCEPT,
  STYLE_BPM_BAND,
  isAllowedStyleAudioFile,
  toMono,
  peakAbs,
  estimateEnergyFromRms,
  onsetEnvelope,
  estimateBpmFromMono,
  nudgeBpmTowardReference,
  blendEnergy,
  analyzeMonoBuffer,
  analyzeStyleReferenceFile,
  peakDbFromLinear,
  clampBpmToDnBBand,
} from './styleReferenceAnalyzer';
export {
  fingerprintHash,
  estimateBrightness,
  estimateDarknessHint,
  guessSectionHints,
  vibeFromMono,
  mapVibeToParams,
  analyzeUserAudio,
} from '../styleRef/vibeMirror';

export {
  decodeWavToMono,
  expectedHitTimesSec,
  peakPickOnsetTimes,
  refineOnsetSec,
  detectOnsetTimesSec,
  matchAbsErrorsMs,
  median,
  measureKickSnareOnsetGrid,
  ONSET_GRID_MEDIAN_MAX_MS,
} from './onsetGrid';
export type { OnsetGridReport, OnsetGridRoleReport } from './onsetGrid';

export {
  DROP_INTRO_RMS_MIN_RATIO,
  findSection,
  sectionWindowRms,
  measureDropVsIntroRms,
} from './sectionEnergyRms';
export type { SectionRmsReport, DropVsIntroRmsReport } from './sectionEnergyRms';
