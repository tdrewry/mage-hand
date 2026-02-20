/**
 * GPU Illumination Filter for PixiJS
 *
 * This is intentionally a PURE POST-PROCESS pass — it applies the BlurFilter
 * edge softening to the already-composited fog+illumination canvas texture.
 *
 * ALL position-aware gradient work (bright/dim zones, visibility polygon clipping,
 * color tints) is performed on the Canvas 2D side (fogPostProcessing.ts) where the
 * world→screen coordinate transform is correct and well-tested. We deliberately
 * avoid duplicating any geometry math here.
 *
 * This filter is kept as a separate class (rather than using BlurFilter directly)
 * so that future GPU-side effects (e.g. vignette, chromatic aberration) can be
 * added as additional shader stages without touching the fog pipeline.
 */

import { Filter, GlProgram } from 'pixi.js';

// Minimal vertex shader — standard filter quad
const vertexGLSL = `
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

// Minimal fragment shader — pure pass-through
// The BlurFilter (applied first in the fogContainer filter array) handles all
// edge softening. This filter exists as a compositing stage placeholder.
const fragmentGLSL = `
  precision highp float;
  varying vec2 vTextureCoord;
  uniform sampler2D uTexture;

  void main(void) {
    gl_FragColor = texture2D(uTexture, vTextureCoord);
  }
`;

export interface IlluminationFilterOptions {
  // Reserved for future per-filter settings (e.g. vignette strength)
  globalEdgeBlur?: number;
}

export class IlluminationFilter extends Filter {
  // Intentionally no illumination uniforms — see module docstring above.
  // The `globalEdgeBlur` property is kept for API compatibility with
  // postProcessingLayer.ts but has no effect on rendering.
  private _globalEdgeBlur: number;

  constructor(options: IlluminationFilterOptions = {}) {
    const glProgram = GlProgram.from({
      vertex: vertexGLSL,
      fragment: fragmentGLSL,
    });

    super({ glProgram, resources: {} });

    this._globalEdgeBlur = options.globalEdgeBlur ?? 8;
  }

  /** No-op — blur is handled by BlurFilter in the filter chain. */
  set globalEdgeBlur(value: number) {
    this._globalEdgeBlur = value;
  }

  get globalEdgeBlur(): number {
    return this._globalEdgeBlur;
  }

  /** No-op — retained for call-site compatibility. */
  updateIllumination(_data: unknown): void {
    // Intentional no-op. All illumination is rendered on Canvas 2D.
  }
}
