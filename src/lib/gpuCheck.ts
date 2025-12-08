/**
 * GPU Capability Check
 * Verifies WebGL support is available (required for this application)
 */

export interface GPUCapabilities {
  webglSupported: boolean;
  webgl2Supported: boolean;
  maxTextureSize: number;
  maxUniformVectors: number;
  renderer: string;
  vendor: string;
}

let cachedCapabilities: GPUCapabilities | null = null;

/**
 * Check GPU capabilities and WebGL support
 */
export function checkGPUCapabilities(): GPUCapabilities {
  if (cachedCapabilities) return cachedCapabilities;
  
  const canvas = document.createElement('canvas');
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  let webgl2Supported = false;
  let webglSupported = false;
  
  // Try WebGL 2 first
  try {
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    if (gl) {
      webgl2Supported = true;
      webglSupported = true;
    }
  } catch (e) {
    console.warn('WebGL 2 not available');
  }
  
  // Fall back to WebGL 1
  if (!gl) {
    try {
      gl = canvas.getContext('webgl') as WebGLRenderingContext;
      if (gl) {
        webglSupported = true;
      }
    } catch (e) {
      console.warn('WebGL 1 not available');
    }
  }
  
  // Get capabilities if WebGL is available
  let maxTextureSize = 0;
  let maxUniformVectors = 0;
  let renderer = 'Unknown';
  let vendor = 'Unknown';
  
  if (gl) {
    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    maxUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    
    // Try to get renderer info
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
      vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown';
    }
  }
  
  cachedCapabilities = {
    webglSupported,
    webgl2Supported,
    maxTextureSize,
    maxUniformVectors,
    renderer,
    vendor,
  };
  
  return cachedCapabilities;
}

/**
 * Check if GPU requirements are met for this application
 */
export function isGPUSupported(): boolean {
  const caps = checkGPUCapabilities();
  return caps.webglSupported;
}

/**
 * Get a human-readable GPU status message
 */
export function getGPUStatusMessage(): string {
  const caps = checkGPUCapabilities();
  
  if (!caps.webglSupported) {
    return 'WebGL is not supported in your browser. This application requires GPU acceleration to run.';
  }
  
  if (caps.webgl2Supported) {
    return `WebGL 2 supported. GPU: ${caps.renderer}`;
  }
  
  return `WebGL 1 supported (limited features). GPU: ${caps.renderer}`;
}
