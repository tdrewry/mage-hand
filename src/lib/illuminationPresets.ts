import type { IlluminationSource } from '@/types/illumination';
import { DEFAULT_ILLUMINATION } from '@/types/illumination';

export interface IlluminationPreset {
  name: string;
  icon: string;
  description: string;
  range: number;
  brightZone: number;
  brightIntensity: number;
  dimIntensity: number;
  color: string;
  colorEnabled: boolean;
  colorIntensity: number;
  softEdge: boolean;
  softEdgeRadius: number;
}

export const ILLUMINATION_PRESETS = {
  custom: {
    name: 'Custom',
    icon: '⚙️',
    description: 'Custom settings',
    ...DEFAULT_ILLUMINATION,
  },
  torch: {
    name: 'Torch',
    icon: '🔥',
    description: '40ft bright, 40ft dim',
    range: 8,
    brightZone: 0.5,
    brightIntensity: 1.0,
    dimIntensity: 0.6,
    color: '#FF6B00',
    colorEnabled: true,
    colorIntensity: 0.2,
    softEdge: true,
    softEdgeRadius: 6,
  },
  lantern: {
    name: 'Lantern',
    icon: '🏮',
    description: '60ft bright, 60ft dim',
    range: 12,
    brightZone: 0.5,
    brightIntensity: 1.0,
    dimIntensity: 0.5,
    color: '#FFD700',
    colorEnabled: true,
    colorIntensity: 0.15,
    softEdge: true,
    softEdgeRadius: 8,
  },
  darkvision: {
    name: 'Darkvision',
    icon: '👁️',
    description: '60ft dim light vision',
    range: 12,
    brightZone: 0.0,
    brightIntensity: 0.0,
    dimIntensity: 0.7,
    color: '#90EE90',
    colorEnabled: true,
    colorIntensity: 0.1,
    softEdge: true,
    softEdgeRadius: 4,
  },
  moonlight: {
    name: 'Moonlight',
    icon: '🌙',
    description: '120ft ambient light',
    range: 24,
    brightZone: 0.3,
    brightIntensity: 0.6,
    dimIntensity: 0.3,
    color: '#87CEEB',
    colorEnabled: true,
    colorIntensity: 0.15,
    softEdge: true,
    softEdgeRadius: 12,
  },
  candle: {
    name: 'Candle',
    icon: '🕯️',
    description: '5ft bright, 10ft dim',
    range: 3,
    brightZone: 0.5,
    brightIntensity: 0.8,
    dimIntensity: 0.4,
    color: '#FFE4B5',
    colorEnabled: true,
    colorIntensity: 0.25,
    softEdge: true,
    softEdgeRadius: 2,
  },
} as const;

export type PresetKey = keyof typeof ILLUMINATION_PRESETS;

export function getPreset(key: PresetKey): IlluminationPreset {
  return ILLUMINATION_PRESETS[key];
}

export function getAllPresets(): { key: PresetKey; preset: IlluminationPreset }[] {
  return Object.entries(ILLUMINATION_PRESETS).map(([key, preset]) => ({
    key: key as PresetKey,
    preset,
  }));
}

export function getSelectablePresets(): { key: PresetKey; preset: IlluminationPreset }[] {
  return getAllPresets().filter(({ key }) => key !== 'custom');
}

export function presetToIlluminationSource(preset: IlluminationPreset): Partial<IlluminationSource> {
  return {
    range: preset.range,
    brightZone: preset.brightZone,
    brightIntensity: preset.brightIntensity,
    dimIntensity: preset.dimIntensity,
    color: preset.color,
    colorEnabled: preset.colorEnabled,
    colorIntensity: preset.colorIntensity,
    softEdge: preset.softEdge,
    softEdgeRadius: preset.softEdgeRadius,
  };
}
