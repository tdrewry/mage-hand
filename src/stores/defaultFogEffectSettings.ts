/**
 * Default fog effect settings - shared across all files that need FogSettings
 */

import type { FogEffectSettings, EffectQuality } from './fogStore';

export const DEFAULT_FOG_EFFECT_SETTINGS: FogEffectSettings = {
  postProcessingEnabled: false,
  edgeBlur: 8,
  lightFalloff: 0.5,
  volumetricEnabled: false,
  effectQuality: 'balanced' as EffectQuality,
  dimZoneOpacity: 0.4,
};
