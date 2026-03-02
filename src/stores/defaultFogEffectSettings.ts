/**
 * Default fog effect settings - shared across all files that need FogSettings
 */

import type { FogEffectSettings, EffectQuality, MapFogSettings } from './fogStore';

export const DEFAULT_FOG_EFFECT_SETTINGS: FogEffectSettings = {
  postProcessingEnabled: true,
  edgeBlur: 8,
  lightFalloff: 0.5,
  volumetricEnabled: false,
  effectQuality: 'balanced' as EffectQuality,
  dimZoneOpacity: 0.4,
};

export const DEFAULT_MAP_FOG_SETTINGS: MapFogSettings = {
  enabled: false,
  revealAll: false,
  visionRange: 6,
  fogOpacity: 0.95,
  exploredOpacity: 0.4,
  showExploredAreas: true,
  effectSettings: { ...DEFAULT_FOG_EFFECT_SETTINGS },
};
