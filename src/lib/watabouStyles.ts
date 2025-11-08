// Watabou rendering style system

export interface WatabouStyle {
  colorInk: string;
  colorShading: string;
  colorWater: string;
  colorBg: string;
  colorPaper: string;
  strokeThin: number;
  strokeHatching: number;
  strokeNormal: number;
  strokeThick: number;
  shadowColor: string;
  shadowDist: number;
  hatchingStyle: 'Default' | 'Stonework' | 'Bricks';
  hatchingStrokes: number;
  hatchingSize: number;
  hatchingDistance: number;
}

// Built-in style presets
export const WATABOU_STYLES: Record<string, WatabouStyle> = {
  'Black & White': {
    colorInk: '#000000',
    colorShading: '#FFFFFF',
    colorWater: '#EEEEEE',
    colorBg: '#FFFFFF',
    colorPaper: '#FFFFFF',
    strokeThin: 0.3,
    strokeHatching: 0.3,
    strokeNormal: 1.0,
    strokeThick: 2.0,
    shadowColor: '#FFFFFF',
    shadowDist: 0.2,
    hatchingStyle: 'Default',
    hatchingStrokes: 4,
    hatchingSize: 0.25,
    hatchingDistance: 0.3,
  },
  'Antique': {
    colorInk: '#000000',
    colorShading: '#C9C1B1',
    colorWater: '#B2AA9D',
    colorBg: '#F7EEDE',
    colorPaper: '#EDE0CE',
    strokeThin: 0.5,
    strokeHatching: 1.2,
    strokeNormal: 1.5,
    strokeThick: 3.5,
    shadowColor: '#999999',
    shadowDist: 0.15,
    hatchingStyle: 'Default',
    hatchingStrokes: 3,
    hatchingSize: 0.3,
    hatchingDistance: 0.5,
  },
  'Stonework': {
    colorInk: '#2C241D',
    colorShading: '#BFBEB6',
    colorWater: '#99665C',
    colorBg: '#D9D5C3',
    colorPaper: '#E5E2CF',
    strokeThin: 0.5,
    strokeHatching: 0.5,
    strokeNormal: 1.5,
    strokeThick: 3.0,
    shadowColor: '#B2A097',
    shadowDist: 0.3,
    hatchingStyle: 'Stonework',
    hatchingStrokes: 3,
    hatchingSize: 0.4,
    hatchingDistance: 0.6,
  },
  'Slate': {
    colorInk: '#000000',
    colorShading: '#7F7766',
    colorWater: '#7A9999',
    colorBg: '#B8BFAC',
    colorPaper: '#899199',
    strokeThin: 0.5,
    strokeHatching: 1.0,
    strokeNormal: 1.5,
    strokeThick: 2.0,
    shadowColor: '#CCCCCC',
    shadowDist: 0.2,
    hatchingStyle: 'Bricks',
    hatchingStrokes: 4,
    hatchingSize: 0.4,
    hatchingDistance: 0.67,
  },
};

export const DEFAULT_STYLE = WATABOU_STYLES['Antique'];
