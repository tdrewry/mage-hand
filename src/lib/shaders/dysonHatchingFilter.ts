/**
 * Dyson-Style Hatching Filter for PixiJS v8
 * Creates Dyson Logos-inspired triplet hatching around region edges
 */

import * as PIXI from 'pixi.js';

export interface DysonHatchingOptions {
  radius?: number;          // Max distance from edge (px)
  angleDeg?: number;        // Hatching angle (degrees)
  groupSpacing?: number;    // Distance between triplet groups (px)
  lineGap?: number;         // Gap between lines in triplet (px)
  lineWidth?: number;       // Stroke width (px)
  segmentLength?: number;   // Length of each stroke segment (px)
  segmentSpacing?: number;  // Gap between segments (px)
  jitter?: number;          // Hand-drawn wobble amount (px)
  inkColor?: number;        // Hex color (e.g., 0x000000)
  lineAlpha?: number;       // Opacity (0-1)
  insideThreshold?: number; // Alpha threshold for inside detection
}

export const DEFAULT_HATCHING_OPTIONS: Required<DysonHatchingOptions> = {
  radius: 18,
  angleDeg: 45,
  groupSpacing: 10,
  lineGap: 1.6,
  lineWidth: 0.9,
  segmentLength: 10,
  segmentSpacing: 6,
  jitter: 1.5,
  inkColor: 0x000000,
  lineAlpha: 1.0,
  insideThreshold: 0.5,
};

// Fragment shader for Dyson-style hatching (PixiJS v8 compatible)
const fragmentShader = /* wgsl */ `
struct DysonUniforms {
  uRadius: f32,
  uAngle: f32,
  uGroupSpacing: f32,
  uLineGap: f32,
  uLineWidth: f32,
  uSegmentLength: f32,
  uSegmentSpacing: f32,
  uJitter: f32,
  uInkColor: vec3<f32>,
  uLineAlpha: f32,
  uInsideThreshold: f32,
};

@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> dysonUniforms: DysonUniforms;
@group(2) @binding(0) var<uniform> uInputSize: vec4<f32>;

fn hash12(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn edgeBandMask(uv: vec2<f32>) -> f32 {
  let centerAlpha = textureSample(uTexture, uSampler, uv).a;
  if (centerAlpha > dysonUniforms.uInsideThreshold) {
    return 0.0;
  }

  let resolution = uInputSize.xy;
  var found = 0.0;

  for (var i = 1; i <= 32; i = i + 1) {
    let fi = f32(i);
    if (fi > dysonUniforms.uRadius) {
      break;
    }

    let off = vec2<f32>(fi) / resolution;

    let a1 = textureSample(uTexture, uSampler, uv + vec2<f32>(off.x, 0.0)).a;
    let a2 = textureSample(uTexture, uSampler, uv - vec2<f32>(off.x, 0.0)).a;
    let a3 = textureSample(uTexture, uSampler, uv + vec2<f32>(0.0, off.y)).a;
    let a4 = textureSample(uTexture, uSampler, uv - vec2<f32>(0.0, off.y)).a;

    let anyInside = max(max(a1, a2), max(a3, a4));
    if (anyInside > dysonUniforms.uInsideThreshold) {
      found = 1.0;
    }
  }

  return found;
}

fn tripletHatching(p: vec2<f32>) -> f32 {
  let dir = vec2<f32>(cos(dysonUniforms.uAngle), sin(dysonUniforms.uAngle));
  let perp = vec2<f32>(-dir.y, dir.x);

  var s = dot(p, dir);
  var t = dot(p, perp);

  let cellSize = dysonUniforms.uGroupSpacing * 1.5;
  let cell = floor(p / cellSize);
  let n = hash12(cell);

  let jitter = (n - 0.5) * dysonUniforms.uJitter;
  t = t + jitter;
  s = s + jitter * 0.7;

  let groupSize = dysonUniforms.uGroupSpacing;
  let localT = t % groupSize;

  let center = groupSize * 0.5;
  let offset = dysonUniforms.uLineGap;
  let halfW = dysonUniforms.uLineWidth;

  let d1 = abs(localT - (center - offset));
  let d2 = abs(localT - center);
  let d3 = abs(localT - (center + offset));

  let line1 = 1.0 - smoothstep(halfW, halfW + 1.0, d1);
  let line2 = 1.0 - smoothstep(halfW, halfW + 1.0, d2);
  let line3 = 1.0 - smoothstep(halfW, halfW + 1.0, d3);

  let linesMask = max(line1, max(line2, line3));

  let period = dysonUniforms.uSegmentLength + dysonUniforms.uSegmentSpacing;
  let segPos = (s + n * period * 0.5) % period;
  var segMask = 0.0;
  if (segPos < dysonUniforms.uSegmentLength) {
    segMask = 1.0;
  }

  return linesMask * segMask;
}

@fragment
fn main(@builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let src = textureSample(uTexture, uSampler, uv);

  let band = edgeBandMask(uv);

  if (band <= 0.0) {
    return src;
  }

  let p = uv * uInputSize.xy;
  let hatch = tripletHatching(p);
  let mask = band * hatch * dysonUniforms.uLineAlpha;

  let color = mix(src.rgb, dysonUniforms.uInkColor, mask);
  return vec4<f32>(color, src.a);
}
`;

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

// GLSL fragment shader for WebGL (PixiJS v8)
const glslFragmentShader = /* glsl */ `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;

uniform float uRadius;
uniform float uAngle;
uniform float uGroupSpacing;
uniform float uLineGap;
uniform float uLineWidth;
uniform float uSegmentLength;
uniform float uSegmentSpacing;
uniform float uJitter;
uniform vec3 uInkColor;
uniform float uLineAlpha;
uniform float uInsideThreshold;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float edgeBandMask(vec2 uv) {
  float centerAlpha = texture(uTexture, uv).a;
  if (centerAlpha > uInsideThreshold) {
    return 0.0;
  }

  vec2 resolution = uInputSize.xy;
  float found = 0.0;

  for (int i = 1; i <= 32; i++) {
    float fi = float(i);
    if (fi > uRadius) break;

    vec2 off = vec2(fi) / resolution;

    float a1 = texture(uTexture, uv + vec2(off.x, 0.0)).a;
    float a2 = texture(uTexture, uv - vec2(off.x, 0.0)).a;
    float a3 = texture(uTexture, uv + vec2(0.0, off.y)).a;
    float a4 = texture(uTexture, uv - vec2(0.0, off.y)).a;

    float anyInside = max(max(a1, a2), max(a3, a4));
    if (anyInside > uInsideThreshold) {
      found = 1.0;
    }
  }

  return found;
}

float tripletHatching(vec2 p) {
  vec2 dir = vec2(cos(uAngle), sin(uAngle));
  vec2 perp = vec2(-dir.y, dir.x);

  float s = dot(p, dir);
  float t = dot(p, perp);

  float cellSize = uGroupSpacing * 1.5;
  vec2 cell = floor(p / cellSize);
  float n = hash12(cell);

  float jitter = (n - 0.5) * uJitter;
  t += jitter;
  s += jitter * 0.7;

  float groupSize = uGroupSpacing;
  float localT = mod(t, groupSize);

  float center = groupSize * 0.5;
  float offset = uLineGap;
  float halfW = uLineWidth;

  float d1 = abs(localT - (center - offset));
  float d2 = abs(localT - center);
  float d3 = abs(localT - (center + offset));

  float line1 = 1.0 - smoothstep(halfW, halfW + 1.0, d1);
  float line2 = 1.0 - smoothstep(halfW, halfW + 1.0, d2);
  float line3 = 1.0 - smoothstep(halfW, halfW + 1.0, d3);

  float linesMask = max(line1, max(line2, line3));

  float period = uSegmentLength + uSegmentSpacing;
  float segPos = mod(s + n * period * 0.5, period);
  float segMask = step(segPos, uSegmentLength);

  return linesMask * segMask;
}

void main() {
  vec4 src = texture(uTexture, vTextureCoord);

  float band = edgeBandMask(vTextureCoord);

  if (band <= 0.0) {
    finalColor = src;
    return;
  }

  vec2 p = vTextureCoord * uInputSize.xy;
  float hatch = tripletHatching(p);
  float mask = band * hatch * uLineAlpha;

  vec3 color = mix(src.rgb, uInkColor, mask);
  finalColor = vec4(color, src.a);
}
`;

/**
 * PixiJS v8 Filter for Dyson-style hatching effect
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
          uAngle: { value: (options.angleDeg * Math.PI) / 180, type: 'f32' },
          uGroupSpacing: { value: options.groupSpacing, type: 'f32' },
          uLineGap: { value: options.lineGap, type: 'f32' },
          uLineWidth: { value: options.lineWidth, type: 'f32' },
          uSegmentLength: { value: options.segmentLength, type: 'f32' },
          uSegmentSpacing: { value: options.segmentSpacing, type: 'f32' },
          uJitter: { value: options.jitter, type: 'f32' },
          uInkColor: { value: new Float32Array([r, g, b]), type: 'vec3<f32>' },
          uLineAlpha: { value: options.lineAlpha, type: 'f32' },
          uInsideThreshold: { value: options.insideThreshold, type: 'f32' },
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

  get angleDeg(): number {
    return this._options.angleDeg;
  }
  set angleDeg(value: number) {
    this._options.angleDeg = value;
    this.resources.dysonUniforms.uniforms.uAngle = (value * Math.PI) / 180;
  }

  get groupSpacing(): number {
    return this._options.groupSpacing;
  }
  set groupSpacing(value: number) {
    this._options.groupSpacing = value;
    this.resources.dysonUniforms.uniforms.uGroupSpacing = value;
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

  get segmentLength(): number {
    return this._options.segmentLength;
  }
  set segmentLength(value: number) {
    this._options.segmentLength = value;
    this.resources.dysonUniforms.uniforms.uSegmentLength = value;
  }

  get segmentSpacing(): number {
    return this._options.segmentSpacing;
  }
  set segmentSpacing(value: number) {
    this._options.segmentSpacing = value;
    this.resources.dysonUniforms.uniforms.uSegmentSpacing = value;
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

  /**
   * Update all options at once
   */
  updateOptions(opts: Partial<DysonHatchingOptions>): void {
    if (opts.radius !== undefined) this.radius = opts.radius;
    if (opts.angleDeg !== undefined) this.angleDeg = opts.angleDeg;
    if (opts.groupSpacing !== undefined) this.groupSpacing = opts.groupSpacing;
    if (opts.lineGap !== undefined) this.lineGap = opts.lineGap;
    if (opts.lineWidth !== undefined) this.lineWidth = opts.lineWidth;
    if (opts.segmentLength !== undefined) this.segmentLength = opts.segmentLength;
    if (opts.segmentSpacing !== undefined) this.segmentSpacing = opts.segmentSpacing;
    if (opts.jitter !== undefined) this.jitter = opts.jitter;
    if (opts.inkColor !== undefined) this.inkColor = opts.inkColor;
    if (opts.lineAlpha !== undefined) this.lineAlpha = opts.lineAlpha;
    if (opts.insideThreshold !== undefined) this.insideThreshold = opts.insideThreshold;
  }
}

/**
 * Preset hatching styles
 */
export const HATCHING_PRESETS: Record<string, DysonHatchingOptions> = {
  'Dyson Classic': {
    radius: 18,
    angleDeg: 45,
    groupSpacing: 10,
    lineGap: 1.6,
    lineWidth: 0.9,
    segmentLength: 10,
    segmentSpacing: 6,
    jitter: 1.5,
    inkColor: 0x000000,
    lineAlpha: 1.0,
  },
  'Dense Sketch': {
    radius: 24,
    angleDeg: 30,
    groupSpacing: 6,
    lineGap: 1.2,
    lineWidth: 0.7,
    segmentLength: 8,
    segmentSpacing: 4,
    jitter: 2.0,
    inkColor: 0x222222,
    lineAlpha: 0.9,
  },
  'Light Touch': {
    radius: 12,
    angleDeg: 60,
    groupSpacing: 14,
    lineGap: 2.0,
    lineWidth: 0.6,
    segmentLength: 12,
    segmentSpacing: 8,
    jitter: 0.8,
    inkColor: 0x333333,
    lineAlpha: 0.7,
  },
  'Stonework': {
    radius: 20,
    angleDeg: 90,
    groupSpacing: 8,
    lineGap: 1.4,
    lineWidth: 1.0,
    segmentLength: 6,
    segmentSpacing: 4,
    jitter: 0.5,
    inkColor: 0x2C241D,
    lineAlpha: 0.85,
  },
  'Cave': {
    radius: 28,
    angleDeg: 35,
    groupSpacing: 12,
    lineGap: 2.5,
    lineWidth: 1.2,
    segmentLength: 14,
    segmentSpacing: 10,
    jitter: 3.0,
    inkColor: 0x1a1a1a,
    lineAlpha: 0.75,
  },
};
