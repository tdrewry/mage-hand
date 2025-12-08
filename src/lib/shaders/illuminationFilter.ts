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

const fragment = `
  precision highp float;
  
  in vec2 vTextureCoord;
  out vec4 finalColor;
  
  uniform sampler2D uTexture;
  uniform vec4 uInputSize;
  
  // Illumination uniforms
  uniform int uSourceCount;
  uniform vec2 uPositions[${MAX_ILLUMINATION_SOURCES}];
  uniform float uRanges[${MAX_ILLUMINATION_SOURCES}];
  uniform float uBrightZones[${MAX_ILLUMINATION_SOURCES}];
  uniform float uBrightIntensities[${MAX_ILLUMINATION_SOURCES}];
  uniform float uDimIntensities[${MAX_ILLUMINATION_SOURCES}];
  uniform float uSoftEdgeRadii[${MAX_ILLUMINATION_SOURCES}];
  uniform vec3 uColors[${MAX_ILLUMINATION_SOURCES}];
  
  // Global settings
  uniform float uGlobalEdgeBlur;
  
  void main(void) {
    // Get fragment position in pixels
    vec2 fragPos = vTextureCoord * uInputSize.xy;
    
    // Sample the fog texture
    vec4 fogColor = texture(uTexture, vTextureCoord);
    
    // Calculate total illumination from all sources
    float totalIllumination = 0.0;
    
    for (int i = 0; i < ${MAX_ILLUMINATION_SOURCES}; i++) {
      if (i >= uSourceCount) break;
      
      // Calculate distance from this source
      float dist = distance(fragPos, uPositions[i]);
      float range = uRanges[i];
      
      if (range <= 0.0 || dist > range) continue;
      
      float brightZone = uBrightZones[i];
      float brightIntensity = uBrightIntensities[i];
      float dimIntensity = uDimIntensities[i];
      float softRadius = uSoftEdgeRadii[i];
      
      // Normalize distance (0 = center, 1 = edge)
      float normalizedDist = dist / range;
      
      // Calculate illumination based on zone
      float illumination = 0.0;
      
      if (normalizedDist <= brightZone) {
        // In bright zone - full bright intensity
        illumination = brightIntensity;
      } else {
        // In dim zone - interpolate from bright to dim
        float dimProgress = (normalizedDist - brightZone) / (1.0 - brightZone);
        illumination = mix(brightIntensity, dimIntensity, dimProgress);
      }
      
      // Apply soft edge falloff at outer boundary
      if (softRadius > 0.0) {
        float edgeDist = range - dist;
        if (edgeDist < softRadius) {
          float edgeFactor = edgeDist / softRadius;
          illumination *= smoothstep(0.0, 1.0, edgeFactor);
        }
      }
      
      // Stack illumination (additive, clamped to 1.0)
      totalIllumination = min(1.0, totalIllumination + illumination);
    }
    
    // Apply illumination to fog
    // illumination = 1.0 means fully lit (remove fog)
    // illumination = 0.0 means no light (keep fog)
    float finalAlpha = fogColor.a * (1.0 - totalIllumination);
    
    finalColor = vec4(fogColor.rgb, finalAlpha);
  }
`;

// WebGL 1 fallback (for older browsers)
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
  uniform float uGlobalEdgeBlur;
  
  void main(void) {
    vec2 fragPos = vTextureCoord * uInputSize.xy;
    vec4 fogColor = texture2D(uTexture, vTextureCoord);
    
    float totalIllumination = 0.0;
    
    for (int i = 0; i < ${MAX_ILLUMINATION_SOURCES}; i++) {
      if (i >= uSourceCount) break;
      
      float dist = distance(fragPos, uPositions[i]);
      float range = uRanges[i];
      
      if (range <= 0.0 || dist > range) continue;
      
      float brightZone = uBrightZones[i];
      float brightIntensity = uBrightIntensities[i];
      float dimIntensity = uDimIntensities[i];
      float softRadius = uSoftEdgeRadii[i];
      
      float normalizedDist = dist / range;
      float illumination = 0.0;
      
      if (normalizedDist <= brightZone) {
        illumination = brightIntensity;
      } else {
        float dimProgress = (normalizedDist - brightZone) / (1.0 - brightZone);
        illumination = mix(brightIntensity, dimIntensity, dimProgress);
      }
      
      if (softRadius > 0.0) {
        float edgeDist = range - dist;
        if (edgeDist < softRadius) {
          float edgeFactor = edgeDist / softRadius;
          illumination *= smoothstep(0.0, 1.0, edgeFactor);
        }
      }
      
      totalIllumination = min(1.0, totalIllumination + illumination);
    }
    
    float finalAlpha = fogColor.a * (1.0 - totalIllumination);
    gl_FragColor = vec4(fogColor.rgb, finalAlpha);
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
