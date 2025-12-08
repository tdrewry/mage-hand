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
    // Get fragment position in pixels
    vec2 fragPos = vTextureCoord * uInputSize.xy;
    
    // Sample the fog texture
    // The fog already has visibility polygons cut out (alpha = 0 inside visible areas)
    vec4 fogColor = texture(uTexture, vTextureCoord);
    
    // If fog is fully opaque, no illumination processing needed
    if (fogColor.a >= 0.99) {
      finalColor = fogColor;
      return;
    }
    
    // If no sources, just pass through
    if (uSourceCount == 0) {
      finalColor = fogColor;
      return;
    }
    
    // Calculate how much to darken the visible area based on distance from light sources
    // Areas close to light centers stay fully visible (alpha = 0)
    // Areas at the dim zone edge get partial fog added back
    float minDarkening = 1.0; // Start with full darkening, reduce based on light proximity
    
    // Accumulate color tinting from enabled light sources
    vec3 accumulatedColor = vec3(0.0);
    float totalColorWeight = 0.0;
    
    for (int i = 0; i < ${MAX_ILLUMINATION_SOURCES}; i++) {
      if (i >= uSourceCount) break;
      
      float dist = distance(fragPos, uPositions[i]);
      float range = uRanges[i];
      
      if (range <= 0.0) continue;
      
      float brightZone = uBrightZones[i];
      float brightIntensity = uBrightIntensities[i];
      float dimIntensity = uDimIntensities[i];
      
      // Calculate how much this light illuminates this point
      float illumination = 0.0;
      
      if (dist <= range * brightZone) {
        // In bright zone - full illumination (no darkening)
        illumination = brightIntensity;
      } else if (dist <= range) {
        // In dim zone - fade from bright to dim intensity
        float dimProgress = (dist - range * brightZone) / (range * (1.0 - brightZone));
        illumination = mix(brightIntensity, dimIntensity, dimProgress);
      }
      // Beyond range: illumination stays 0
      
      // Less darkening where there's more illumination
      float darkening = 1.0 - illumination;
      minDarkening = min(minDarkening, darkening);
      
      // Accumulate color contribution if color is enabled for this source
      if (uColorEnabled[i] > 0.5 && illumination > 0.0) {
        accumulatedColor += uColors[i] * illumination;
        totalColorWeight += illumination;
      }
    }
    
    // Apply darkening to visible areas (where fog alpha is low)
    // This adds fog back at the edges of visibility, creating the dim zone effect
    // fogColor.a is 0 in fully visible areas, so we add darkness there
    float baseVisibility = 1.0 - fogColor.a; // How visible this pixel currently is
    float darkenedVisibility = baseVisibility * (1.0 - minDarkening);
    float newFogAlpha = 1.0 - darkenedVisibility;
    
    // Calculate final fog color with optional color tinting
    vec3 finalFogColor = fogColor.rgb;
    if (totalColorWeight > 0.0) {
      // Normalize accumulated color and blend with the base fog color
      vec3 normalizedColor = accumulatedColor / totalColorWeight;
      // Apply color tint to visible areas by modulating the fog color
      // The tint is stronger where there's more visibility
      float tintStrength = baseVisibility * 0.4; // 40% max tint strength
      finalFogColor = mix(fogColor.rgb, fogColor.rgb * normalizedColor, tintStrength);
    }
    
    // Blend: areas inside visibility get gradient, areas outside stay fogged
    finalColor = vec4(finalFogColor, max(fogColor.a, newFogAlpha * 0.7));
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
    
    // If fog is fully opaque, no illumination processing needed
    if (fogColor.a >= 0.99) {
      gl_FragColor = fogColor;
      return;
    }
    
    // If no sources, just pass through
    if (uSourceCount == 0) {
      gl_FragColor = fogColor;
      return;
    }
    
    // Calculate darkening based on distance from light sources
    float minDarkening = 1.0;
    
    // Accumulate color tinting from enabled light sources
    vec3 accumulatedColor = vec3(0.0);
    float totalColorWeight = 0.0;
    
    for (int i = 0; i < ${MAX_ILLUMINATION_SOURCES}; i++) {
      if (i >= uSourceCount) break;
      
      float dist = distance(fragPos, uPositions[i]);
      float range = uRanges[i];
      
      if (range <= 0.0) continue;
      
      float brightZone = uBrightZones[i];
      float brightIntensity = uBrightIntensities[i];
      float dimIntensity = uDimIntensities[i];
      
      float illumination = 0.0;
      
      if (dist <= range * brightZone) {
        illumination = brightIntensity;
      } else if (dist <= range) {
        float dimProgress = (dist - range * brightZone) / (range * (1.0 - brightZone));
        illumination = mix(brightIntensity, dimIntensity, dimProgress);
      }
      
      float darkening = 1.0 - illumination;
      minDarkening = min(minDarkening, darkening);
      
      // Accumulate color contribution if color is enabled for this source
      if (uColorEnabled[i] > 0.5 && illumination > 0.0) {
        accumulatedColor += uColors[i] * illumination;
        totalColorWeight += illumination;
      }
    }
    
    float baseVisibility = 1.0 - fogColor.a;
    float darkenedVisibility = baseVisibility * (1.0 - minDarkening);
    float newFogAlpha = 1.0 - darkenedVisibility;
    
    // Calculate final fog color with optional color tinting
    vec3 finalFogColor = fogColor.rgb;
    if (totalColorWeight > 0.0) {
      vec3 normalizedColor = accumulatedColor / totalColorWeight;
      float tintStrength = baseVisibility * 0.4;
      finalFogColor = mix(fogColor.rgb, fogColor.rgb * normalizedColor, tintStrength);
    }
    
    gl_FragColor = vec4(finalFogColor, max(fogColor.a, newFogAlpha * 0.7));
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
