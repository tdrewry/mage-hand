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
  uniform float uColorEnabled[${MAX_ILLUMINATION_SOURCES}];
  
  // Global settings
  uniform float uGlobalEdgeBlur;
  
  void main(void) {
    vec2 fragPos = vTextureCoord * uInputSize.xy;
    vec4 fogColor = texture(uTexture, vTextureCoord);
    
    // baseVisibility: 1.0 = fully visible (inside visibility polygon), 0.0 = fogged/blocked
    float baseVisibility = 1.0 - fogColor.a;
    
    // Apply visibility threshold to prevent color bleeding at soft fog edges
    float thresholdedVisibility = baseVisibility > 0.1 ? baseVisibility : 0.0;
    
    // If fog is fully opaque (behind walls), no processing needed
    if (fogColor.a >= 0.99) {
      finalColor = fogColor;
      return;
    }
    
    // If no sources, just pass through
    if (uSourceCount == 0) {
      finalColor = fogColor;
      return;
    }
    
    // Calculate darkening and color accumulation
    float minDarkening = 1.0;
    vec3 accumulatedColor = vec3(0.0);
    float totalColorWeight = 0.0;
    float totalIllumination = 0.0;
    
    for (int i = 0; i < ${MAX_ILLUMINATION_SOURCES}; i++) {
      if (i >= uSourceCount) break;
      
      float dist = distance(fragPos, uPositions[i]);
      float range = uRanges[i];
      
      if (range <= 0.0) continue;
      
      float brightZone = uBrightZones[i];
      float brightIntensity = uBrightIntensities[i];
      float dimIntensity = uDimIntensities[i];
      
      float rawIllumination = 0.0;
      
      if (dist <= range * brightZone) {
        rawIllumination = brightIntensity;
      } else if (dist <= range) {
        float dimProgress = (dist - range * brightZone) / (range * (1.0 - brightZone));
        rawIllumination = mix(brightIntensity, dimIntensity, dimProgress);
      }
      
      // CRITICAL: Clip illumination by visibility - light cannot pass through walls
      float illumination = rawIllumination * baseVisibility;
      
      float darkening = 1.0 - illumination;
      minDarkening = min(minDarkening, darkening);
      totalIllumination = max(totalIllumination, illumination);
      
      // Color weighted by visibility to respect wall occlusion
      if (uColorEnabled[i] > 0.5 && illumination > 0.0) {
        accumulatedColor += uColors[i] * illumination;
        totalColorWeight += illumination;
      }
    }
    
    // Apply dim zone darkening
    float darkenedVisibility = baseVisibility * (1.0 - minDarkening);
    float newFogAlpha = 1.0 - darkenedVisibility;
    float baseFogAlpha = max(fogColor.a, newFogAlpha * 0.7);
    
    // Apply color tinting
    if (totalColorWeight > 0.0 && thresholdedVisibility > 0.0) {
      vec3 normalizedColor = accumulatedColor / totalColorWeight;
      
      // Color overlay alpha - this makes the tint VISIBLE in lit areas
      // Scale by illumination and visibility for proper falloff
      float tintAlpha = totalIllumination * thresholdedVisibility * 0.35;
      
      // Final alpha: max of fog, dim zone, and color tint
      float finalAlpha = max(baseFogAlpha, tintAlpha);
      
      // Blend RGB: fog color in dark/blocked areas, tint color in lit areas
      vec3 outputColor = mix(fogColor.rgb, normalizedColor, thresholdedVisibility * totalIllumination);
      
      finalColor = vec4(outputColor, finalAlpha);
    } else {
      finalColor = vec4(fogColor.rgb, baseFogAlpha);
    }
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
  uniform float uColorEnabled[${MAX_ILLUMINATION_SOURCES}];
  uniform float uGlobalEdgeBlur;
  
  void main(void) {
    vec2 fragPos = vTextureCoord * uInputSize.xy;
    vec4 fogColor = texture2D(uTexture, vTextureCoord);
    
    // baseVisibility: 1.0 = fully visible, 0.0 = fogged/blocked
    float baseVisibility = 1.0 - fogColor.a;
    
    // Threshold to prevent color bleeding at soft fog edges
    float thresholdedVisibility = baseVisibility > 0.1 ? baseVisibility : 0.0;
    
    if (fogColor.a >= 0.99) {
      gl_FragColor = fogColor;
      return;
    }
    
    if (uSourceCount == 0) {
      gl_FragColor = fogColor;
      return;
    }
    
    float minDarkening = 1.0;
    vec3 accumulatedColor = vec3(0.0);
    float totalColorWeight = 0.0;
    float totalIllumination = 0.0;
    
    for (int i = 0; i < ${MAX_ILLUMINATION_SOURCES}; i++) {
      if (i >= uSourceCount) break;
      
      float dist = distance(fragPos, uPositions[i]);
      float range = uRanges[i];
      
      if (range <= 0.0) continue;
      
      float brightZone = uBrightZones[i];
      float brightIntensity = uBrightIntensities[i];
      float dimIntensity = uDimIntensities[i];
      
      float rawIllumination = 0.0;
      
      if (dist <= range * brightZone) {
        rawIllumination = brightIntensity;
      } else if (dist <= range) {
        float dimProgress = (dist - range * brightZone) / (range * (1.0 - brightZone));
        rawIllumination = mix(brightIntensity, dimIntensity, dimProgress);
      }
      
      // CRITICAL: Clip illumination by visibility - light cannot pass through walls
      float illumination = rawIllumination * baseVisibility;
      
      float darkening = 1.0 - illumination;
      minDarkening = min(minDarkening, darkening);
      totalIllumination = max(totalIllumination, illumination);
      
      if (uColorEnabled[i] > 0.5 && illumination > 0.0) {
        accumulatedColor += uColors[i] * illumination;
        totalColorWeight += illumination;
      }
    }
    
    float darkenedVisibility = baseVisibility * (1.0 - minDarkening);
    float newFogAlpha = 1.0 - darkenedVisibility;
    float baseFogAlpha = max(fogColor.a, newFogAlpha * 0.7);
    
    if (totalColorWeight > 0.0 && thresholdedVisibility > 0.0) {
      vec3 normalizedColor = accumulatedColor / totalColorWeight;
      
      float tintAlpha = totalIllumination * thresholdedVisibility * 0.35;
      float finalAlpha = max(baseFogAlpha, tintAlpha);
      
      vec3 outputColor = mix(fogColor.rgb, normalizedColor, thresholdedVisibility * totalIllumination);
      
      gl_FragColor = vec4(outputColor, finalAlpha);
    } else {
      gl_FragColor = vec4(fogColor.rgb, baseFogAlpha);
    }
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
