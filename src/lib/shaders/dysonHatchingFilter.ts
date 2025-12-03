/**
 * Dyson-Style Hatching Filter for PixiJS v8
 * Creates authentic Dyson Logos-inspired hatching with per-cluster random angles
 * Based on Watabou's implementation using Poisson disk sampling concept
 */

import * as PIXI from 'pixi.js';

export interface DysonHatchingOptions {
  radius?: number;          // Max distance from edge (px) - in world space
  clusterSize?: number;     // Size of each hatching cluster (px) - in world space
  strokeCount?: number;     // Number of strokes per cluster (2-5)
  lineGap?: number;         // Gap between lines in cluster (px)
  lineWidth?: number;       // Stroke width (px)
  strokeLength?: number;    // Base length of strokes (px) - in world space
  lengthVariation?: number; // How much stroke lengths vary (0-1, center longer)
  jitter?: number;          // Hand-drawn wobble amount (px)
  inkColor?: number;        // Hex color (e.g., 0x000000)
  lineAlpha?: number;       // Opacity (0-1)
  insideThreshold?: number; // Alpha threshold for inside detection
  zoom?: number;            // Current zoom level for scaling
}

export const DEFAULT_HATCHING_OPTIONS: Required<DysonHatchingOptions> = {
  radius: 20,
  clusterSize: 14,
  strokeCount: 3,
  lineGap: 2.0,
  lineWidth: 0.8,
  strokeLength: 12,
  lengthVariation: 0.35,
  jitter: 1.2,
  inkColor: 0x000000,
  lineAlpha: 1.0,
  insideThreshold: 0.5,
  zoom: 1.0,
};

// GLSL vertex shader for WebGL (PixiJS v8)
const glslVertexShader = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

// GLSL fragment shader - Authentic Dyson/Watabou style hatching
const glslFragmentShader = /* glsl */ `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

uniform float uRadius;
uniform float uClusterSize;
uniform float uStrokeCount;
uniform float uLineGap;
uniform float uLineWidth;
uniform float uStrokeLength;
uniform float uLengthVariation;
uniform float uJitter;
uniform vec3 uInkColor;
uniform float uLineAlpha;
uniform float uInsideThreshold;
uniform float uZoom;

#define PI 3.14159265359

// Hash functions for procedural randomness
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 8-direction edge detection for proper corner handling
float edgeBandMask(vec2 uv) {
  float centerAlpha = texture(uTexture, uv).a;
  if (centerAlpha > uInsideThreshold) {
    return 0.0;
  }

  vec2 resolution = uInputSize.xy;
  float found = 0.0;
  
  // Scale radius by zoom so it stays consistent in world space
  float scaledRadius = uRadius * uZoom;

  for (int i = 1; i <= 64; i++) {
    float fi = float(i);
    if (fi > scaledRadius) break;

    vec2 off = vec2(fi) / resolution;
    float diagOff = fi * 0.7071 / resolution.x;

    // Cardinal directions
    float a1 = texture(uTexture, uv + vec2(off.x, 0.0)).a;
    float a2 = texture(uTexture, uv - vec2(off.x, 0.0)).a;
    float a3 = texture(uTexture, uv + vec2(0.0, off.y)).a;
    float a4 = texture(uTexture, uv - vec2(0.0, off.y)).a;
    
    // Diagonal directions for corner detection
    float a5 = texture(uTexture, uv + vec2(diagOff, diagOff)).a;
    float a6 = texture(uTexture, uv + vec2(-diagOff, diagOff)).a;
    float a7 = texture(uTexture, uv + vec2(diagOff, -diagOff)).a;
    float a8 = texture(uTexture, uv + vec2(-diagOff, -diagOff)).a;

    float anyInside = max(max(max(a1, a2), max(a3, a4)), max(max(a5, a6), max(a7, a8)));
    if (anyInside > uInsideThreshold) {
      found = 1.0;
    }
  }

  return found;
}

// Authentic Dyson-style cluster hatching with per-cluster random angles
float clusterHatching(vec2 p) {
  // Scale all parameters by zoom for world-space consistency
  float scaledClusterSize = uClusterSize * uZoom;
  float scaledStrokeLength = uStrokeLength * uZoom;
  float scaledJitter = uJitter * uZoom;
  float scaledLineGap = uLineGap * uZoom;
  float scaledLineWidth = uLineWidth * uZoom;
  
  // Determine which cluster cell we're in
  vec2 cell = floor(p / scaledClusterSize);
  vec2 cellCenter = (cell + 0.5) * scaledClusterSize;
  
  // Get random values for this cluster
  vec2 rnd = hash22(cell);
  
  // Per-cluster random angle (full 180° range for variety)
  float clusterAngle = rnd.x * PI;
  
  // Direction vectors for this cluster's orientation
  vec2 dir = vec2(cos(clusterAngle), sin(clusterAngle));
  vec2 perp = vec2(-dir.y, dir.x);
  
  // Transform point into cluster's local coordinate space
  vec2 localP = p - cellCenter;
  
  // Add position jitter based on cluster hash
  float jitterX = (rnd.y - 0.5) * scaledJitter;
  float jitterY = (hash12(cell + 100.0) - 0.5) * scaledJitter;
  localP += vec2(jitterX, jitterY);
  
  // Project onto cluster's local axes
  float s = dot(localP, dir);   // Along stroke direction
  float t = dot(localP, perp);  // Perpendicular to strokes
  
  // Draw N strokes with varying lengths (center longest)
  float mask = 0.0;
  int strokeCount = int(uStrokeCount);
  float halfCount = float(strokeCount - 1) * 0.5;
  
  // Anti-aliasing scaled with zoom
  float aa = max(0.5, 1.0 / uZoom);
  
  for (int i = 0; i < 5; i++) {
    if (i >= strokeCount) break;
    
    float fi = float(i);
    
    // Calculate perpendicular offset for this stroke
    float strokeOffset = (fi - halfCount) * scaledLineGap;
    
    // Calculate length variation - center stroke longest, edges shorter
    float normalizedPos = abs(fi - halfCount) / max(halfCount, 0.5);
    float lengthScale = 1.0 - normalizedPos * uLengthVariation;
    float currentStrokeLen = scaledStrokeLength * lengthScale;
    
    // Add slight length jitter per stroke using hash
    float lengthJitter = hash12(cell + vec2(fi * 7.0, fi * 13.0));
    currentStrokeLen *= 0.85 + lengthJitter * 0.3;
    
    // Distance from this stroke line
    float d = abs(t - strokeOffset);
    
    // Stroke line mask with anti-aliasing
    float lineMask = 1.0 - smoothstep(scaledLineWidth * 0.5, scaledLineWidth * 0.5 + aa, d);
    
    // Stroke length mask - check if we're within the stroke segment
    float segMask = 1.0 - smoothstep(currentStrokeLen * 0.5 - aa, currentStrokeLen * 0.5 + aa, abs(s));
    
    // Combine
    mask = max(mask, lineMask * segMask);
  }
  
  return mask;
}

void main() {
  vec4 src = texture(uTexture, vTextureCoord);

  float band = edgeBandMask(vTextureCoord);

  if (band <= 0.0) {
    // Outside the hatching band - fully transparent
    finalColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  vec2 p = vTextureCoord * uInputSize.xy;
  float hatch = clusterHatching(p);
  float mask = band * hatch * uLineAlpha;

  // Only output ink where hatching is drawn, fully transparent elsewhere
  if (mask <= 0.01) {
    finalColor = vec4(0.0, 0.0, 0.0, 0.0);
  } else {
    finalColor = vec4(uInkColor, mask);
  }
}
`;

/**
 * PixiJS v8 Filter for authentic Dyson-style hatching effect
 */
export class DysonHatchingFilter extends PIXI.Filter {
  private _options: Required<DysonHatchingOptions>;

  constructor(opts: DysonHatchingOptions = {}) {
    const options: Required<DysonHatchingOptions> = {
      ...DEFAULT_HATCHING_OPTIONS,
      ...opts,
    };

    const r = ((options.inkColor >> 16) & 0xff) / 255;
    const g = ((options.inkColor >> 8) & 0xff) / 255;
    const b = (options.inkColor & 0xff) / 255;

    super({
      glProgram: PIXI.GlProgram.from({
        vertex: glslVertexShader,
        fragment: glslFragmentShader,
        name: 'dyson-hatching-filter',
      }),
      resources: {
        dysonUniforms: {
          uRadius: { value: options.radius, type: 'f32' },
          uClusterSize: { value: options.clusterSize, type: 'f32' },
          uStrokeCount: { value: options.strokeCount, type: 'f32' },
          uLineGap: { value: options.lineGap, type: 'f32' },
          uLineWidth: { value: options.lineWidth, type: 'f32' },
          uStrokeLength: { value: options.strokeLength, type: 'f32' },
          uLengthVariation: { value: options.lengthVariation, type: 'f32' },
          uJitter: { value: options.jitter, type: 'f32' },
          uInkColor: { value: new Float32Array([r, g, b]), type: 'vec3<f32>' },
          uLineAlpha: { value: options.lineAlpha, type: 'f32' },
          uInsideThreshold: { value: options.insideThreshold, type: 'f32' },
          uZoom: { value: options.zoom, type: 'f32' },
        },
      },
    });

    this._options = options;
  }

  get radius(): number {
    return this._options.radius;
  }
  set radius(value: number) {
    this._options.radius = value;
    this.resources.dysonUniforms.uniforms.uRadius = value;
  }

  get clusterSize(): number {
    return this._options.clusterSize;
  }
  set clusterSize(value: number) {
    this._options.clusterSize = value;
    this.resources.dysonUniforms.uniforms.uClusterSize = value;
  }

  get strokeCount(): number {
    return this._options.strokeCount;
  }
  set strokeCount(value: number) {
    this._options.strokeCount = Math.max(2, Math.min(5, Math.round(value)));
    this.resources.dysonUniforms.uniforms.uStrokeCount = this._options.strokeCount;
  }

  get lineGap(): number {
    return this._options.lineGap;
  }
  set lineGap(value: number) {
    this._options.lineGap = value;
    this.resources.dysonUniforms.uniforms.uLineGap = value;
  }

  get lineWidth(): number {
    return this._options.lineWidth;
  }
  set lineWidth(value: number) {
    this._options.lineWidth = value;
    this.resources.dysonUniforms.uniforms.uLineWidth = value;
  }

  get strokeLength(): number {
    return this._options.strokeLength;
  }
  set strokeLength(value: number) {
    this._options.strokeLength = value;
    this.resources.dysonUniforms.uniforms.uStrokeLength = value;
  }

  get lengthVariation(): number {
    return this._options.lengthVariation;
  }
  set lengthVariation(value: number) {
    this._options.lengthVariation = Math.max(0, Math.min(1, value));
    this.resources.dysonUniforms.uniforms.uLengthVariation = this._options.lengthVariation;
  }

  get jitter(): number {
    return this._options.jitter;
  }
  set jitter(value: number) {
    this._options.jitter = value;
    this.resources.dysonUniforms.uniforms.uJitter = value;
  }

  get inkColor(): number {
    return this._options.inkColor;
  }
  set inkColor(value: number) {
    this._options.inkColor = value;
    const r = ((value >> 16) & 0xff) / 255;
    const g = ((value >> 8) & 0xff) / 255;
    const b = (value & 0xff) / 255;
    this.resources.dysonUniforms.uniforms.uInkColor = new Float32Array([r, g, b]);
  }

  get lineAlpha(): number {
    return this._options.lineAlpha;
  }
  set lineAlpha(value: number) {
    this._options.lineAlpha = value;
    this.resources.dysonUniforms.uniforms.uLineAlpha = value;
  }

  get insideThreshold(): number {
    return this._options.insideThreshold;
  }
  set insideThreshold(value: number) {
    this._options.insideThreshold = value;
    this.resources.dysonUniforms.uniforms.uInsideThreshold = value;
  }

  get zoom(): number {
    return this._options.zoom;
  }
  set zoom(value: number) {
    this._options.zoom = value;
    this.resources.dysonUniforms.uniforms.uZoom = value;
  }

  /**
   * Update all options at once
   */
  updateOptions(opts: Partial<DysonHatchingOptions>): void {
    if (opts.radius !== undefined) this.radius = opts.radius;
    if (opts.clusterSize !== undefined) this.clusterSize = opts.clusterSize;
    if (opts.strokeCount !== undefined) this.strokeCount = opts.strokeCount;
    if (opts.lineGap !== undefined) this.lineGap = opts.lineGap;
    if (opts.lineWidth !== undefined) this.lineWidth = opts.lineWidth;
    if (opts.strokeLength !== undefined) this.strokeLength = opts.strokeLength;
    if (opts.lengthVariation !== undefined) this.lengthVariation = opts.lengthVariation;
    if (opts.jitter !== undefined) this.jitter = opts.jitter;
    if (opts.inkColor !== undefined) this.inkColor = opts.inkColor;
    if (opts.lineAlpha !== undefined) this.lineAlpha = opts.lineAlpha;
    if (opts.insideThreshold !== undefined) this.insideThreshold = opts.insideThreshold;
    if (opts.zoom !== undefined) this.zoom = opts.zoom;
  }
}

/**
 * Preset hatching styles - authentic Dyson/Watabou variations
 */
export const HATCHING_PRESETS: Record<string, DysonHatchingOptions> = {
  'Dyson Classic': {
    radius: 20,
    clusterSize: 14,
    strokeCount: 3,
    lineGap: 2.0,
    lineWidth: 0.8,
    strokeLength: 12,
    lengthVariation: 0.35,
    jitter: 1.2,
    inkColor: 0x000000,
    lineAlpha: 1.0,
  },
  'Light Sketch': {
    radius: 16,
    clusterSize: 18,
    strokeCount: 2,
    lineGap: 2.5,
    lineWidth: 0.6,
    strokeLength: 10,
    lengthVariation: 0.5,
    jitter: 1.5,
    inkColor: 0x333333,
    lineAlpha: 0.8,
  },
  'Dense Cave': {
    radius: 28,
    clusterSize: 10,
    strokeCount: 4,
    lineGap: 1.5,
    lineWidth: 0.7,
    strokeLength: 8,
    lengthVariation: 0.25,
    jitter: 1.0,
    inkColor: 0x000000,
    lineAlpha: 1.0,
  },
  'Heavy Ink': {
    radius: 24,
    clusterSize: 12,
    strokeCount: 5,
    lineGap: 1.8,
    lineWidth: 1.0,
    strokeLength: 10,
    lengthVariation: 0.3,
    jitter: 0.8,
    inkColor: 0x000000,
    lineAlpha: 1.0,
  },
  'Stonework': {
    radius: 18,
    clusterSize: 16,
    strokeCount: 3,
    lineGap: 2.2,
    lineWidth: 0.9,
    strokeLength: 14,
    lengthVariation: 0.4,
    jitter: 2.0,
    inkColor: 0x444444,
    lineAlpha: 0.9,
  },
};
