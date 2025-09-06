// RedBlob Games hex coordinate system implementation
// Based on https://www.redblobgames.com/grids/hexagons/

export interface HexCoordinate {
  q: number; // column
  r: number; // row
  s: number; // diagonal (q + r + s = 0)
}

export interface Point {
  x: number;
  y: number;
}

export interface HexLayout {
  orientation: HexOrientation;
  size: Point;
  origin: Point;
}

export interface HexOrientation {
  f0: number; f1: number; f2: number; f3: number;
  b0: number; b1: number; b2: number; b3: number;
  start_angle: number;
}

// Standard orientations
export const POINTY_TOP: HexOrientation = {
  f0: Math.sqrt(3.0), f1: Math.sqrt(3.0) / 2.0, f2: 0.0, f3: 3.0 / 2.0,
  b0: Math.sqrt(3.0) / 3.0, b1: -1.0 / 3.0, b2: 0.0, b3: 2.0 / 3.0,
  start_angle: 0.5
};

export const FLAT_TOP: HexOrientation = {
  f0: 3.0 / 2.0, f1: 0.0, f2: Math.sqrt(3.0) / 2.0, f3: Math.sqrt(3.0),
  b0: 2.0 / 3.0, b1: 0.0, b2: -1.0 / 3.0, b3: Math.sqrt(3.0) / 3.0,
  start_angle: 0.0
};

// Cube coordinate operations
export function hexAdd(a: HexCoordinate, b: HexCoordinate): HexCoordinate {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

export function hexSubtract(a: HexCoordinate, b: HexCoordinate): HexCoordinate {
  return { q: a.q - b.q, r: a.r - b.r, s: a.s - b.s };
}

export function hexScale(hex: HexCoordinate, factor: number): HexCoordinate {
  return { q: hex.q * factor, r: hex.r * factor, s: hex.s * factor };
}

export function hexRotateLeft(hex: HexCoordinate): HexCoordinate {
  return { q: -hex.s, r: -hex.q, s: -hex.r };
}

export function hexRotateRight(hex: HexCoordinate): HexCoordinate {
  return { q: -hex.r, r: -hex.s, s: -hex.q };
}

// Hex directions (neighbors)
export const HEX_DIRECTIONS: HexCoordinate[] = [
  { q: 1, r: 0, s: -1 }, { q: 1, r: -1, s: 0 }, { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 }, { q: -1, r: 1, s: 0 }, { q: 0, r: 1, s: -1 }
];

export function hexDirection(direction: number): HexCoordinate {
  return HEX_DIRECTIONS[direction];
}

export function hexNeighbor(hex: HexCoordinate, direction: number): HexCoordinate {
  return hexAdd(hex, hexDirection(direction));
}

// Convert between hex and pixel coordinates
export function hexToPixel(layout: HexLayout, hex: HexCoordinate): Point {
  const M = layout.orientation;
  const size = layout.size;
  const origin = layout.origin;
  const x = (M.f0 * hex.q + M.f1 * hex.r) * size.x;
  const y = (M.f2 * hex.q + M.f3 * hex.r) * size.y;
  return { x: x + origin.x, y: y + origin.y };
}

export function pixelToHex(layout: HexLayout, p: Point): HexCoordinate {
  const M = layout.orientation;
  const size = layout.size;
  const origin = layout.origin;
  const pt = { x: (p.x - origin.x) / size.x, y: (p.y - origin.y) / size.y };
  const q = M.b0 * pt.x + M.b1 * pt.y;
  const r = M.b2 * pt.x + M.b3 * pt.y;
  return { q, r, s: -q - r };
}

// Round fractional hex coordinates to nearest hex
export function hexRound(hex: HexCoordinate): HexCoordinate {
  let q = Math.round(hex.q);
  let r = Math.round(hex.r);
  let s = Math.round(hex.s);

  const q_diff = Math.abs(q - hex.q);
  const r_diff = Math.abs(r - hex.r);
  const s_diff = Math.abs(s - hex.s);

  if (q_diff > r_diff && q_diff > s_diff) {
    q = -r - s;
  } else if (r_diff > s_diff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q, r, s };
}

// Get hex corner coordinates
export function hexCornerOffset(layout: HexLayout, corner: number): Point {
  const M = layout.orientation;
  const size = layout.size;
  const angle = 2.0 * Math.PI * (M.start_angle - corner) / 6.0;
  return { x: size.x * Math.cos(angle), y: size.y * Math.sin(angle) };
}

export function hexCorners(layout: HexLayout, hex: HexCoordinate): Point[] {
  const corners: Point[] = [];
  const center = hexToPixel(layout, hex);
  for (let i = 0; i < 6; i++) {
    const offset = hexCornerOffset(layout, i);
    corners.push({ x: center.x + offset.x, y: center.y + offset.y });
  }
  return corners;
}

// Distance between hexes
export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// Create a hex layout for given size
export function createHexLayout(size: number, orientation: HexOrientation = POINTY_TOP): HexLayout {
  return {
    orientation,
    size: { x: size, y: size },
    origin: { x: 0, y: 0 }
  };
}

// Get all hexes in a rectangular region
export function hexesInRectangle(layout: HexLayout, left: number, top: number, width: number, height: number): HexCoordinate[] {
  const hexes: HexCoordinate[] = [];
  
  // Convert rectangle corners to hex coordinates
  const topLeft = pixelToHex(layout, { x: left, y: top });
  const bottomRight = pixelToHex(layout, { x: left + width, y: top + height });
  
  // Round to get integer bounds
  const minQ = Math.floor(Math.min(topLeft.q, bottomRight.q)) - 1;
  const maxQ = Math.ceil(Math.max(topLeft.q, bottomRight.q)) + 1;
  const minR = Math.floor(Math.min(topLeft.r, bottomRight.r)) - 1;
  const maxR = Math.ceil(Math.max(topLeft.r, bottomRight.r)) + 1;
  
  // Generate hexes in the region
  for (let q = minQ; q <= maxQ; q++) {
    for (let r = minR; r <= maxR; r++) {
      const hex = { q, r, s: -q - r };
      const pixel = hexToPixel(layout, hex);
      
        // Check if hex center is within extended bounds (with some padding)
        if (pixel.x >= left - layout.size.x * 2 && pixel.x <= left + width + layout.size.x * 2 &&
            pixel.y >= top - layout.size.y * 2 && pixel.y <= top + height + layout.size.y * 2) {
          hexes.push(hex);
        }
    }
  }
  
  return hexes;
}