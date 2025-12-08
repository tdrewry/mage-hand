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
    
    // Visibility: 1.0 = visible (fog cut out), 0.0 = fogged/blocked
    float visibility = 1.0 - fogColor.a;
    
    // If fog is fully opaque (behind walls), no processing needed
    if (fogColor.a >= 0.99) {
      finalColor = fogColor;
      return;
    }
    
    // If no sources, just pass through the fog
    if (uSourceCount == 0) {
      finalColor = fogColor;
      return;
    }
    
    // Calculate dim zone darkening effect for visible areas
    // We want to ADD a slight fog overlay in dim zones (not bright zones)
    float dimOverlay = 0.0;
    
    for (int i = 0; i < ${MAX_ILLUMINATION_SOURCES}; i++) {
      if (i >= uSourceCount) break;
      
      float dist = distance(fragPos, uPositions[i]);
      float range = uRanges[i];
      
      if (range <= 0.0) continue;
      
      float brightZone = uBrightZones[i];
      float dimIntensity = uDimIntensities[i];
      float softEdge = uSoftEdgeRadii[i];
      
      // In bright zone: no dim overlay
      // In dim zone: gradual overlay based on distance
      // Outside range: full overlay (but already blocked by visibility)
      
      if (dist <= range * brightZone) {
        // Bright zone - no dimming, this source provides full illumination
        dimOverlay = 0.0;
        break; // If any source puts us in bright zone, no dimming
      } else if (dist <= range) {
        // Dim zone - apply gradual dimming
        float dimProgress = (dist - range * brightZone) / (range * (1.0 - brightZone));
        // dimProgress: 0.0 at bright zone edge, 1.0 at range edge
        float localDim = dimProgress * (1.0 - dimIntensity);
        dimOverlay = max(dimOverlay, localDim);
      }
    }
    
    // Apply dim overlay only to visible areas
    // This adds a subtle fog tint in dim zones
    float dimFog = dimOverlay * visibility * 0.4; // 0.4 = max dim darkness
    
    // Final fog alpha combines original fog + dim zone overlay
    float finalFogAlpha = fogColor.a + dimFog;
    finalFogAlpha = clamp(finalFogAlpha, 0.0, 1.0);
    
    // Output fog with dim overlay
    finalColor = vec4(fogColor.rgb, finalFogAlpha);
  }
`;

// WebGL 1 fallback (for older browsers)
// Simplified - color tinting handled by Canvas 2D overlay
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
    
    // Visibility: 1.0 = visible (fog cut out), 0.0 = fogged/blocked
    float visibility = 1.0 - fogColor.a;
    
    if (fogColor.a >= 0.99) {
      gl_FragColor = fogColor;
      return;
    }
    
    if (uSourceCount == 0) {
      gl_FragColor = fogColor;
      return;
    }
    
    // Calculate dim zone darkening effect for visible areas
    float dimOverlay = 0.0;
    
    for (int i = 0; i < ${MAX_ILLUMINATION_SOURCES}; i++) {
      if (i >= uSourceCount) break;
      
      float dist = distance(fragPos, uPositions[i]);
      float range = uRanges[i];
      
      if (range <= 0.0) continue;
      
      float brightZone = uBrightZones[i];
      float dimIntensity = uDimIntensities[i];
      
      if (dist <= range * brightZone) {
        // Bright zone - no dimming
        dimOverlay = 0.0;
        break;
      } else if (dist <= range) {
        // Dim zone - gradual dimming
        float dimProgress = (dist - range * brightZone) / (range * (1.0 - brightZone));
        float localDim = dimProgress * (1.0 - dimIntensity);
        dimOverlay = max(dimOverlay, localDim);
      }
    }
    
    // Apply dim overlay only to visible areas
    float dimFog = dimOverlay * visibility * 0.4;
    float finalFogAlpha = clamp(fogColor.a + dimFog, 0.0, 1.0);
    
    gl_FragColor = vec4(fogColor.rgb, finalFogAlpha);
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
