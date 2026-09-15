/** @deprecated Prefer `@/core/styleRef` — kept as a compatibility re-export. */
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
} from '../styleRef/analyzeAudio';
