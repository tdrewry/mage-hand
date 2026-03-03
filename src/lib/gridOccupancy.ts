/**
 * Grid Occupancy Calculations
 * 
 * Pure calculation functions for determining which grid cells
 * (hex or square) a token occupies within a region.
 * Extracted from SimpleTabletop.tsx.
 */

import type { CanvasRegion } from '../stores/regionStore';
import { isPointInPolygon } from '../utils/pathUtils';

/**
 * Check if a point is inside a region (supports rect, rotated rect, and path regions).
 */
export const isPointInRegion = (x: number, y: number, region: CanvasRegion): boolean => {
  if (region.regionType === "path" && region.pathPoints) {
    return isPointInPolygon({ x, y }, region.pathPoints);
  } else if (region.rotation && region.rotation !== 0) {
    const centerX = region.x + region.width / 2;
    const centerY = region.y + region.height / 2;
    const angle = (region.rotation * Math.PI) / 180;

    const corners = [
      { x: region.x, y: region.y },
      { x: region.x + region.width, y: region.y },
      { x: region.x + region.width, y: region.y + region.height },
      { x: region.x, y: region.y + region.height },
    ];

    const rotatedCorners = corners.map((corner) => ({
      x: centerX + (corner.x - centerX) * Math.cos(angle) - (corner.y - centerY) * Math.sin(angle),
      y: centerY + (corner.x - centerX) * Math.sin(angle) + (corner.y - centerY) * Math.cos(angle),
    }));

    return isPointInPolygon({ x, y }, rotatedCorners);
  } else {
    return x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
  }
};

/**
 * Calculate which hex grid cells a token occupies based on its size.
 */
export const calculateTokenHexOccupancy = (
  tokenX: number,
  tokenY: number,
  region: CanvasRegion,
  gridWidth: number = 1,
  gridHeight: number = 1,
): { hexX: number; hexY: number; radius: number }[] => {
  if (region.gridType !== "hex") return [];

  const gridSize = region.gridSize;
  const hexRadius = gridSize / 2;
  const hexHeight = hexRadius * Math.sqrt(3);
  const hexWidth = hexRadius * 2;

  const startX = region.x;
  const startY = region.y;

  // Find the closest hex center to the token position
  const relativeX = tokenX - startX - hexRadius;
  const relativeY = tokenY - startY - hexRadius;

  const col = Math.round(relativeX / (hexWidth * 0.75));
  const row = Math.round((relativeY - (col % 2) * (hexHeight / 2)) / hexHeight);

  const centerHexX = startX + col * (hexWidth * 0.75) + hexRadius;
  const centerHexY = startY + row * hexHeight + hexRadius + (col % 2) * (hexHeight / 2);

  const centerHex = { hexX: centerHexX, hexY: centerHexY, col, row };
  const occupiedHexes: { hexX: number; hexY: number; radius: number }[] = [];

  if (gridWidth === 1 && gridHeight === 1) {
    // Medium (1x1): Just the center hex
    occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });
  } else if (gridWidth === 2 && gridHeight === 2) {
    // Large (2x2): Center + 6 neighbors
    occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });

    const allNeighbors = [
      [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
    ];

    allNeighbors.forEach(([dCol, dRow]) => {
      const neighborCol = centerHex.col + dCol;
      const neighborRow = centerHex.row + dRow;

      const neighborHexX = startX + neighborCol * (hexWidth * 0.75) + hexRadius;
      const neighborHexY = startY + neighborRow * hexHeight + hexRadius + (neighborCol % 2) * (hexHeight / 2);

      if (
        neighborHexX >= region.x - hexRadius &&
        neighborHexX <= region.x + region.width + hexRadius &&
        neighborHexY >= region.y - hexRadius &&
        neighborHexY <= region.y + region.height + hexRadius
      ) {
        occupiedHexes.push({ hexX: neighborHexX, hexY: neighborHexY, radius: hexRadius });
      }
    });
  } else if (gridWidth === 3 && gridHeight === 3) {
    // Huge (3x3): Center + 6 neighbors
    occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });

    const allNeighbors = [
      [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
    ];

    allNeighbors.forEach(([dCol, dRow]) => {
      const neighborCol = centerHex.col + dCol;
      const neighborRow = centerHex.row + dRow;

      const neighborHexX = startX + neighborCol * (hexWidth * 0.75) + hexRadius;
      const neighborHexY = startY + neighborRow * hexHeight + hexRadius + (neighborCol % 2) * (hexHeight / 2);

      if (
        neighborHexX >= region.x - hexRadius &&
        neighborHexX <= region.x + region.width + hexRadius &&
        neighborHexY >= region.y - hexRadius &&
        neighborHexY <= region.y + region.height + hexRadius
      ) {
        occupiedHexes.push({ hexX: neighborHexX, hexY: neighborHexY, radius: hexRadius });
      }
    });
  } else if (gridWidth === 4 && gridHeight === 4) {
    // Gargantuan (4x4): Center + first ring + second ring
    occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });

    const firstRing = [
      [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
    ];
    const secondRing = [
      [2, 0], [1, 1], [-1, 2], [-2, 1], [-1, -1], [1, -2],
      [2, -1], [0, 2], [-2, 0], [0, -2], [1, 2], [-1, -2],
    ];

    [...firstRing, ...secondRing].forEach(([dCol, dRow]) => {
      const neighborCol = centerHex.col + dCol;
      const neighborRow = centerHex.row + dRow;

      const neighborHexX = startX + neighborCol * (hexWidth * 0.75) + hexRadius;
      const neighborHexY = startY + neighborRow * hexHeight + hexRadius + (neighborCol % 2) * (hexHeight / 2);

      if (
        neighborHexX >= region.x - hexRadius &&
        neighborHexX <= region.x + region.width + hexRadius &&
        neighborHexY >= region.y - hexRadius &&
        neighborHexY <= region.y + region.height + hexRadius
      ) {
        occupiedHexes.push({ hexX: neighborHexX, hexY: neighborHexY, radius: hexRadius });
      }
    });
  } else {
    // Non-standard sizes: flexible ring approach
    occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });

    const maxDimension = Math.max(gridWidth, gridHeight);
    const rings = Math.ceil(maxDimension / 2);

    for (let ring = 1; ring < rings; ring++) {
      const ringOffsets = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const dCol = Math.round(ring * Math.cos(angle));
        const dRow = Math.round(ring * Math.sin(angle));
        ringOffsets.push([dCol, dRow]);
      }

      ringOffsets.forEach(([dCol, dRow]) => {
        const neighborCol = centerHex.col + dCol;
        const neighborRow = centerHex.row + dRow;

        const neighborHexX = startX + neighborCol * (hexWidth * 0.75) + hexRadius;
        const neighborHexY = startY + neighborRow * hexHeight + hexRadius + (neighborCol % 2) * (hexHeight / 2);

        if (
          neighborHexX >= region.x - hexRadius &&
          neighborHexX <= region.x + region.width + hexRadius &&
          neighborHexY >= region.y - hexRadius &&
          neighborHexY <= region.y + region.height + hexRadius
        ) {
          occupiedHexes.push({ hexX: neighborHexX, hexY: neighborHexY, radius: hexRadius });
        }
      });
    }
  }

  return occupiedHexes;
};

/**
 * Calculate which square grid cells a token occupies.
 */
export const calculateTokenSquareOccupancy = (
  tokenX: number,
  tokenY: number,
  region: CanvasRegion,
  gridWidth: number = 1,
  gridHeight: number = 1,
): { gridX: number; gridY: number; size: number }[] => {
  if (region.gridType !== "square") return [];

  const gridSize = region.gridSize;
  const occupiedSquares: { gridX: number; gridY: number; size: number }[] = [];

  const relativeX = tokenX - region.x;
  const relativeY = tokenY - region.y;
  const centerCol = Math.floor(relativeX / gridSize);
  const centerRow = Math.floor(relativeY / gridSize);

  const startCol = centerCol - Math.floor((gridWidth - 1) / 2);
  const startRow = centerRow - Math.floor((gridHeight - 1) / 2);

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const gridCol = startCol + col;
      const gridRow = startRow + row;

      const gridCenterX = region.x + (gridCol + 0.5) * gridSize;
      const gridCenterY = region.y + (gridRow + 0.5) * gridSize;

      if (
        gridCenterX >= region.x &&
        gridCenterX <= region.x + region.width &&
        gridCenterY >= region.y &&
        gridCenterY <= region.y + region.height
      ) {
        occupiedSquares.push({ gridX: gridCenterX, gridY: gridCenterY, size: gridSize });
      }
    }
  }

  return occupiedSquares;
};
