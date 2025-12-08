/**
 * GPU Illumination Filter for PixiJS
 * Handles all illumination calculations on the GPU using custom shaders
 */

import { Filter, GlProgram, GpuProgram } from 'pixi.js';
import { MAX_ILLUMINATION_SOURCES, type IlluminationShaderData } from '@/types/illumination';

const vertex = `
  in vec2 aPosition;
  out vec2 vTextureCoord;
  
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;
  
  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }
  
  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }
  
  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

// Simplified fragment shader - color tinting is now handled by a separate
// Canvas 2D overlay that's clipped to each source's visibility polygon.
// This shader only handles fog/visibility and dim zone darkening.
// Simplified fragment shader - bright/dim zones are now rendered on Canvas 2D
// with per-source visibility polygon clipping. This shader is a pass-through
// that preserves the fog mask for compositing.
const fragment = `
  precision highp float;
  
  in vec2 vTextureCoord;
  out vec4 finalColor;
  
  uniform sampler2D uTexture;
  uniform vec4 uInputSize;
  
  // Keep uniforms for potential future effects (soft edges, etc)
  uniform int uSourceCount;
  uniform vec2 uPositions[${MAX_ILLUMINATION_SOURCES}];
  uniform float uRanges[${MAX_ILLUMINATION_SOURCES}];
  uniform float uBrightZones[${MAX_ILLUMINATION_SOURCES}];
  uniform float uBrightIntensities[${MAX_ILLUMINATION_SOURCES}];
  uniform float uDimIntensities[${MAX_ILLUMINATION_SOURCES}];
  uniform float uSoftEdgeRadii[${MAX_ILLUMINATION_SOURCES}];
  uniform vec3 uColors[${MAX_ILLUMINATION_SOURCES}];
  uniform float uColorEnabled[${MAX_ILLUMINATION_SOURCES}];
  uniform float uGlobalEdgeBlur;
  
  void main(void) {
    vec4 fogColor = texture(uTexture, vTextureCoord);
    
    // Pass through the fog mask - bright/dim zones are already
    // baked in via Canvas 2D radial gradients with visibility clipping
    finalColor = fogColor;
  }
`;

// WebGL 1 fallback (for older browsers)
// Simplified - color tinting handled by Canvas 2D overlay
// WebGL 1 fallback - simplified pass-through
const fragmentGLSL100 = `
  precision highp float;
  
  varying vec2 vTextureCoord;
  
  uniform sampler2D uTexture;
  uniform vec4 uInputSize;
  
  uniform int uSourceCount;
  uniform vec2 uPositions[${MAX_ILLUMINATION_SOURCES}];
  uniform float uRanges[${MAX_ILLUMINATION_SOURCES}];
  uniform float uBrightZones[${MAX_ILLUMINATION_SOURCES}];
  uniform float uBrightIntensities[${MAX_ILLUMINATION_SOURCES}];
  uniform float uDimIntensities[${MAX_ILLUMINATION_SOURCES}];
  uniform float uSoftEdgeRadii[${MAX_ILLUMINATION_SOURCES}];
  uniform vec3 uColors[${MAX_ILLUMINATION_SOURCES}];
  uniform float uColorEnabled[${MAX_ILLUMINATION_SOURCES}];
  uniform float uGlobalEdgeBlur;
  
  void main(void) {
    vec4 fogColor = texture2D(uTexture, vTextureCoord);
    
    // Pass through - bright/dim zones are baked in via Canvas 2D
    gl_FragColor = fogColor;
  }
`;

const vertexGLSL100 = `
  attribute vec2 aPosition;
  varying vec2 vTextureCoord;
  
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

export interface IlluminationFilterOptions {
  globalEdgeBlur?: number;
}

export class IlluminationFilter extends Filter {
  constructor(options: IlluminationFilterOptions = {}) {
    const glProgram = GlProgram.from({
      vertex: vertexGLSL100,
      fragment: fragmentGLSL100,
    });
    
    // Create default uniform arrays
    const defaultPositions = new Float32Array(MAX_ILLUMINATION_SOURCES * 2);
    const defaultRanges = new Float32Array(MAX_ILLUMINATION_SOURCES);
    const defaultBrightZones = new Float32Array(MAX_ILLUMINATION_SOURCES).fill(0.5);
    const defaultBrightIntensities = new Float32Array(MAX_ILLUMINATION_SOURCES).fill(1.0);
    const defaultDimIntensities = new Float32Array(MAX_ILLUMINATION_SOURCES).fill(0.4);
    const defaultSoftEdgeRadii = new Float32Array(MAX_ILLUMINATION_SOURCES).fill(8);
    const defaultColors = new Float32Array(MAX_ILLUMINATION_SOURCES * 3);
    const defaultColorEnabled = new Float32Array(MAX_ILLUMINATION_SOURCES);
    
    super({
      glProgram,
      resources: {
        illuminationUniforms: {
          uSourceCount: { value: 0, type: 'i32' },
          uPositions: { value: defaultPositions, type: 'vec2<f32>', size: MAX_ILLUMINATION_SOURCES },
          uRanges: { value: defaultRanges, type: 'f32', size: MAX_ILLUMINATION_SOURCES },
          uBrightZones: { value: defaultBrightZones, type: 'f32', size: MAX_ILLUMINATION_SOURCES },
          uBrightIntensities: { value: defaultBrightIntensities, type: 'f32', size: MAX_ILLUMINATION_SOURCES },
          uDimIntensities: { value: defaultDimIntensities, type: 'f32', size: MAX_ILLUMINATION_SOURCES },
          uSoftEdgeRadii: { value: defaultSoftEdgeRadii, type: 'f32', size: MAX_ILLUMINATION_SOURCES },
          uColors: { value: defaultColors, type: 'vec3<f32>', size: MAX_ILLUMINATION_SOURCES },
          uColorEnabled: { value: defaultColorEnabled, type: 'f32', size: MAX_ILLUMINATION_SOURCES },
          uGlobalEdgeBlur: { value: options.globalEdgeBlur ?? 8, type: 'f32' },
        },
      },
    });
  }
  
  /**
   * Update illumination data from shader data structure
   */
  updateIllumination(data: IlluminationShaderData): void {
    const uniforms = this.resources.illuminationUniforms.uniforms;
    
    uniforms.uSourceCount = data.sourceCount;
    uniforms.uPositions = data.positions;
    uniforms.uRanges = data.ranges;
    uniforms.uBrightZones = data.brightZones;
    uniforms.uBrightIntensities = data.brightIntensities;
    uniforms.uDimIntensities = data.dimIntensities;
    uniforms.uSoftEdgeRadii = data.softEdgeRadii;
    uniforms.uColors = data.colors;
    uniforms.uColorEnabled = data.colorEnabled;
  }
  
  /**
   * Set global edge blur amount
   */
  set globalEdgeBlur(value: number) {
    this.resources.illuminationUniforms.uniforms.uGlobalEdgeBlur = value;
  }
  
  get globalEdgeBlur(): number {
    return this.resources.illuminationUniforms.uniforms.uGlobalEdgeBlur as number;
  }
}
