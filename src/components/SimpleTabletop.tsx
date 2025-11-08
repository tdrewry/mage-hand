/**
 * CRITICAL DEPENDENCY NOTICE:
 * This component relies on the following packages that are ESSENTIAL to functionality:
 * - zustand: State management for all stores (sessionStore, mapStore, regionStore)
 * - fabric: Canvas library (preserved for future Paper.js-like functionality)
 * - @radix-ui/react-*: All modal dialogs and UI components
 * - tailwindcss: Entire styling system
 * - lucide-react: All icons used throughout the component
 * 
 * DO NOT REMOVE these dependencies without consulting DEPENDENCIES.md
 */

import React, { useEffect, useRef, useState } from 'react';
import { Toolbar } from './Toolbar';
import { MapManager } from './MapManager';
import { FloatingMenu } from './FloatingMenu';
import { TokenContextManager } from './TokenContextManager';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { useRegionStore, type CanvasRegion } from '../stores/regionStore';
import { useDungeonStore } from '../stores/dungeonStore';
import { renderDoors, renderAnnotations, renderTerrainFeatures, renderDungeonMapRegions, renderDungeonMapDoors } from '../lib/dungeonRenderer';
import { generateNegativeSpaceRegion } from '../lib/wallGeometry';
import { snapToMapGrid } from '../lib/mapGridSystem';
import { 
  HexCoordinate, 
  HexLayout, 
  POINTY_TOP, 
  createHexLayout, 
  pixelToHex, 
  hexToPixel, 
  hexRound,
  hexCorners 
} from '../lib/hexCoordinates';
import { isPointInPolygon, getPolygonBounds, isPointNearPolygonEdge, findNearestVertex } from '../utils/pathUtils';
import { simplifyPath } from '../utils/pathSimplification';
import { generateBezierControlPoints, getBezierBounds } from '../utils/bezierUtils';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Settings, Grid3X3, Eye, Pen, Square } from 'lucide-react';
import { RegionBackgroundModal } from './modals/RegionBackgroundModal';
import { RegionControlPanel, type TransformMode } from './RegionControlPanel';
import { 
  generateTransformHandles, 
  getRotationCenterHandle, 
  hitTestTransformHandle,
  scaleRegion,
  rotateRegion,
  calculateScaleFromDrag,
  calculateRotationFromDrag,
  getRegionBounds,
  type TransformHandle 
} from '../lib/regionTransforms';

export const SimpleTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showMapManager, setShowMapManager] = useState(false);
  const [isRegionBackgroundModalOpen, setIsRegionBackgroundModalOpen] = useState(false);
  const [selectedRegionForEdit, setSelectedRegionForEdit] = useState<CanvasRegion | null>(null);
  
  // Pan and zoom state
  const [transform, setTransform] = useState({
    x: 0,
    y: 0,
    zoom: 1
  });
  
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  // Token interaction state
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [isDraggingToken, setIsDraggingToken] = useState(false);
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragPath, setDragPath] = useState<{ x: number, y: number }[]>([]);
  
  // Grid snapping toggle (default disabled)
  const [isGridSnappingEnabled, setIsGridSnappingEnabled] = useState(false);
  
  // Region transformation state
  const [transformMode, setTransformMode] = useState<'move' | 'scale' | 'rotate'>('move');
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformHandle, setTransformHandle] = useState<string | null>(null);
  const [rotationCenter, setRotationCenter] = useState<{ x: number; y: number } | null>(null);
  
  // Grid highlighting state for token movement (supports both hex and square grids)
  const [highlightedGrids, setHighlightedGrids] = useState<{
    regionId: string, 
    hexes: {hexX: number, hexY: number, radius: number}[],
    squares: {gridX: number, gridY: number, size: number}[]
  }[]>([]);
  
  // Use persistent region store
  const { 
    regions, 
    addRegion, 
    updateRegion, 
    removeRegion, 
    clearRegions,
    setRegions,
    selectRegion,
    deselectRegion,
    clearSelection,
    getSelectedRegions
  } = useRegionStore();
  
  // Dungeon features store
  const { 
    doors,
    annotations,
    terrainFeatures,
    renderingMode,
    watabouStyle
  } = useDungeonStore();
  
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isDraggingRegion, setIsDraggingRegion] = useState(false);
  const [draggedRegionId, setDraggedRegionId] = useState<string | null>(null);
  const [regionDragOffset, setRegionDragOffset] = useState({ x: 0, y: 0 });
  const [isResizingRegion, setIsResizingRegion] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  
  // Local drag state to avoid excessive store updates
  const [dragPreview, setDragPreview] = useState<{
    regionId: string;
    pathPoints?: Array<{ x: number; y: number }>;
    bezierControlPoints?: Array<{ cp1: { x: number; y: number }; cp2: { x: number; y: number } }>;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } | null>(null);
  
  // Path drawing state
  const [pathDrawingMode, setPathDrawingMode] = useState<'none' | 'drawing' | 'editing'>('none');
  const [pathDrawingType, setPathDrawingType] = useState<'polygon' | 'freehand'>('polygon');
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [editingVertexIndex, setEditingVertexIndex] = useState<number | null>(null);
  const [editingControlPointIndex, setEditingControlPointIndex] = useState<{ segmentIndex: number; isFirst: boolean } | null>(null);
  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);
  const [lastFreehandPoint, setLastFreehandPoint] = useState<{ x: number; y: number } | null>(null);
  
  // Track tokens moved by region drag to prevent individual snapping
  const [tokensMovedByRegion, setTokensMovedByRegion] = useState<string[]>([]);
  
  // Grouped dragging state - simpler approach without Paper.js
  const [groupedTokens, setGroupedTokens] = useState<{tokenId: string, startX: number, startY: number}[]>([]);
  
  // Temporary token positions during region drag to avoid store updates
  const [tempTokenPositions, setTempTokenPositions] = useState<{[tokenId: string]: {x: number, y: number}}>();
  
  // Rotation state
  const [isRotatingRegion, setIsRotatingRegion] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);
  const [tempRegionRotation, setTempRegionRotation] = useState<{[regionId: string]: number}>({});

  const {
    sessionId,
    tokens,
    addToken,
    updateTokenPosition,
    updateTokenLabel,
    updateTokenColor,
    removeToken,
    currentPlayerId,
  } = useSessionStore();

  const { maps, getVisibleMaps, getActiveRegionAt } = useMapStore();

  // Update highlights whenever tokens or regions change
  useEffect(() => {
    updateAllTokenHighlights();
  }, [tokens, regions]); // Re-run when tokens positions change or regions change

  // Helper function to convert screen coordinates to world coordinates
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - transform.x) / transform.zoom,
      y: (screenY - transform.y) / transform.zoom
    };
  };

  // Helper function to convert world coordinates to screen coordinates
  const worldToScreen = (worldX: number, worldY: number) => {
    return {
      x: worldX * transform.zoom + transform.x,
      y: worldY * transform.zoom + transform.y
    };
  };

  // Hit test for tokens
  const getTokenAtPosition = (worldX: number, worldY: number): any | null => {
    const baseTokenSize = 40; // Base size for 1x1 token
    
    // Check tokens in reverse order (top to bottom)
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];
      // Calculate actual token size based on grid dimensions
      const tokenWidth = (token.gridWidth || 1) * baseTokenSize;
      const tokenHeight = (token.gridHeight || 1) * baseTokenSize;
      const maxRadius = Math.max(tokenWidth, tokenHeight) / 2;
      
      const distance = Math.sqrt(
        Math.pow(worldX - token.x, 2) + Math.pow(worldY - token.y, 2)
      );
      
      if (distance <= maxRadius) {
        return token;
      }
    }
    
    return null;
  };

  // Hit test for regions
  const getRegionAtPosition = (worldX: number, worldY: number): CanvasRegion | null => {
    // Check regions in reverse order (top to bottom)
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      if (isPointInRegion(worldX, worldY, region)) {
        return region;
      }
    }
    return null;
  };

  // Calculate which hex(es) a token occupies using D&D hex grid patterns
  const calculateTokenHexOccupancy = (tokenX: number, tokenY: number, region: CanvasRegion, gridWidth: number = 1, gridHeight: number = 1): {hexX: number, hexY: number, radius: number}[] => {
    if (region.gridType !== 'hex') return [];
    
    const hexRadius = region.gridSize / 2;
    const hexWidth = hexRadius * 2;
    const hexHeight = hexRadius * Math.sqrt(3);
    
    // Calculate number of hexes that fit (same as drawHexGrid)
    const cols = Math.ceil(region.width / (hexWidth * 0.75)) + 1;
    const rows = Math.ceil(region.height / hexHeight) + 1;
    
    // Starting position aligned to region (same as drawHexGrid)
    const startX = region.x;
    const startY = region.y;
    
    let centerHex: {hexX: number, hexY: number, radius: number, col: number, row: number} | null = null;
    let closestDistance = Infinity;
    
    // Find the closest hex center to the token position
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate hex center position (same formula as drawHexGrid)
        const hexX = startX + col * (hexWidth * 0.75) + hexRadius;
        const hexY = startY + row * hexHeight + hexRadius + (col % 2) * (hexHeight / 2);
        
        // Only check hexes within or near region bounds
        if (hexX >= region.x - hexRadius && hexX <= region.x + region.width + hexRadius &&
            hexY >= region.y - hexRadius && hexY <= region.y + region.height + hexRadius) {
          
          // Calculate distance from token to hex center
          const distance = Math.sqrt((tokenX - hexX) ** 2 + (tokenY - hexY) ** 2);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            centerHex = { hexX, hexY, radius: hexRadius, col, row };
          }
        }
      }
    }
    
    if (!centerHex) return [];
    
    const occupiedHexes: {hexX: number, hexY: number, radius: number}[] = [];
    
    // D&D hex patterns based on creature size
    if (gridWidth === 1 && gridHeight === 1) {
      // Small/Medium (1x1): Single hex
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });
    } else if (gridWidth === 2 && gridHeight === 2) {
      // Large (2x2): EXACTLY 3 hexes total according to D&D rules
      console.log('Calculating 2x2 hex pattern - should be exactly 3 hexes');
      
      // Center hex
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });
      
      // For a Large creature, add exactly 2 specific adjacent hexes
      // Pattern should be center + 2 adjacent forming a triangle
      const largeCreatureOffsets = [
        [1, 0],   // Right neighbor  
        [-1, 1]   // Bottom-left neighbor (creates proper triangle)
      ];
      
      largeCreatureOffsets.forEach(([dCol, dRow]) => {
        const neighborCol = centerHex.col + dCol;
        const neighborRow = centerHex.row + dRow;
        
        const neighborHexX = startX + neighborCol * (hexWidth * 0.75) + hexRadius;
        const neighborHexY = startY + neighborRow * hexHeight + hexRadius + (neighborCol % 2) * (hexHeight / 2);
        
        if (neighborHexX >= region.x - hexRadius && neighborHexX <= region.x + region.width + hexRadius &&
            neighborHexY >= region.y - hexRadius && neighborHexY <= region.y + region.height + hexRadius) {
          occupiedHexes.push({ hexX: neighborHexX, hexY: neighborHexY, radius: hexRadius });
          console.log(`Added Large creature hex at col:${neighborCol}, row:${neighborRow}`);
        }
      });
      
      console.log(`Large creature total hexes: ${occupiedHexes.length} (should be 3)`);
    } else if (gridWidth === 3 && gridHeight === 3) {
      // Huge (3x3): Center + all 6 neighbors (7 total)
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });
      
      // All 6 hex neighbors
      const allNeighbors = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
      
      allNeighbors.forEach(([dCol, dRow]) => {
        const neighborCol = centerHex.col + dCol;
        const neighborRow = centerHex.row + dRow;
        
        const neighborHexX = startX + neighborCol * (hexWidth * 0.75) + hexRadius;
        const neighborHexY = startY + neighborRow * hexHeight + hexRadius + (neighborCol % 2) * (hexHeight / 2);
        
        if (neighborHexX >= region.x - hexRadius && neighborHexX <= region.x + region.width + hexRadius &&
            neighborHexY >= region.y - hexRadius && neighborHexY <= region.y + region.height + hexRadius) {
          occupiedHexes.push({ hexX: neighborHexX, hexY: neighborHexY, radius: hexRadius });
        }
      });
    } else if (gridWidth === 4 && gridHeight === 4) {
      // Gargantuan (4x4): Center + 6 neighbors + 6 more hexes (19 total in flower pattern)
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });
      
      // First ring: 6 neighbors
      const firstRing = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
      // Second ring: additional hexes for gargantuan
      const secondRing = [[2, 0], [1, 1], [-1, 2], [-2, 1], [-1, -1], [1, -2], [2, -1], [0, 2], [-2, 0], [0, -2], [1, 2], [-1, -2]];
      
      [...firstRing, ...secondRing].forEach(([dCol, dRow]) => {
        const neighborCol = centerHex.col + dCol;
        const neighborRow = centerHex.row + dRow;
        
        const neighborHexX = startX + neighborCol * (hexWidth * 0.75) + hexRadius;
        const neighborHexY = startY + neighborRow * hexHeight + hexRadius + (neighborCol % 2) * (hexHeight / 2);
        
        if (neighborHexX >= region.x - hexRadius && neighborHexX <= region.x + region.width + hexRadius &&
            neighborHexY >= region.y - hexRadius && neighborHexY <= region.y + region.height + hexRadius) {
          occupiedHexes.push({ hexX: neighborHexX, hexY: neighborHexY, radius: hexRadius });
        }
      });
    } else {
      // For non-square sizes or larger sizes, use a more flexible approach
      // This handles rectangular creatures or sizes > 4x4
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });
      
      const maxDimension = Math.max(gridWidth, gridHeight);
      const rings = Math.ceil(maxDimension / 2);
      
      for (let ring = 1; ring < rings; ring++) {
        const ringOffsets = [];
        // Generate hex ring offsets (this is a simplified approach)
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
          
          if (neighborHexX >= region.x - hexRadius && neighborHexX <= region.x + region.width + hexRadius &&
              neighborHexY >= region.y - hexRadius && neighborHexY <= region.y + region.height + hexRadius) {
            occupiedHexes.push({ hexX: neighborHexX, hexY: neighborHexY, radius: hexRadius });
          }
        });
      }
    }
    
    return occupiedHexes;
  };

  // Calculate which square grid cells a token occupies
  const calculateTokenSquareOccupancy = (tokenX: number, tokenY: number, region: CanvasRegion, gridWidth: number = 1, gridHeight: number = 1): {gridX: number, gridY: number, size: number}[] => {
    if (region.gridType !== 'square') return [];
    
    const gridSize = region.gridSize;
    const occupiedSquares: {gridX: number, gridY: number, size: number}[] = [];
    
    // Calculate which grid cell the token center is in
    const relativeX = tokenX - region.x;
    const relativeY = tokenY - region.y;
    const centerCol = Math.floor(relativeX / gridSize);
    const centerRow = Math.floor(relativeY / gridSize);
    
    // Calculate the top-left corner of the token's grid area
    const startCol = centerCol - Math.floor((gridWidth - 1) / 2);
    const startRow = centerRow - Math.floor((gridHeight - 1) / 2);
    
    // Add all grid cells occupied by the token
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const gridCol = startCol + col;
        const gridRow = startRow + row;
        
        const gridCenterX = region.x + (gridCol + 0.5) * gridSize;
        const gridCenterY = region.y + (gridRow + 0.5) * gridSize;
        
        // Verify grid cell is within region bounds
        if (gridCenterX >= region.x && gridCenterX <= region.x + region.width &&
            gridCenterY >= region.y && gridCenterY <= region.y + region.height) {
          occupiedSquares.push({ gridX: gridCenterX, gridY: gridCenterY, size: gridSize });
        }
      }
    }
    
    return occupiedSquares;
  };

  // Update highlighted grids based on token position and size
  const updateGridHighlights = (tokenX: number, tokenY: number, gridWidth: number = 1, gridHeight: number = 1) => {
    const newHighlights: {regionId: string, hexes: {hexX: number, hexY: number, radius: number}[], squares: {gridX: number, gridY: number, size: number}[]}[] = [];
    
    regions.forEach(region => {
      if (region.gridType === 'hex' || region.gridType === 'square') {
        // Check if token is within this region (use proper shape detection)
        if (isPointInRegion(tokenX, tokenY, region)) {
          const occupiedHexes = region.gridType === 'hex' ? calculateTokenHexOccupancy(tokenX, tokenY, region, gridWidth, gridHeight) : [];
          const occupiedSquares = region.gridType === 'square' ? calculateTokenSquareOccupancy(tokenX, tokenY, region, gridWidth, gridHeight) : [];
          
          if (occupiedHexes.length > 0 || occupiedSquares.length > 0) {
            newHighlights.push({ regionId: region.id, hexes: occupiedHexes, squares: occupiedSquares });
          }
        }
      }
    });
    
    setHighlightedGrids(newHighlights);
  };

  // Update highlights for all tokens in regions with visible grids
  const updateAllTokenHighlights = () => {
    const newHighlights: {regionId: string, hexes: {hexX: number, hexY: number, radius: number}[], squares: {gridX: number, gridY: number, size: number}[]}[] = [];
    
    // Check each token against each region
    tokens.forEach(token => {
      regions.forEach(region => {
        if (region.gridType === 'hex' || region.gridType === 'square') { // Always calculate token highlights for grid regions
          // Check if token is within this region (use proper shape detection)
          if (isPointInRegion(token.x, token.y, region)) {
            const occupiedHexes = region.gridType === 'hex' ? calculateTokenHexOccupancy(token.x, token.y, region) : [];
            const occupiedSquares = region.gridType === 'square' ? calculateTokenSquareOccupancy(token.x, token.y, region) : [];
            
            if (occupiedHexes.length > 0 || occupiedSquares.length > 0) {
              // Check if this region already has highlights
              const existingRegionHighlight = newHighlights.find(h => h.regionId === region.id);
              if (existingRegionHighlight) {
                existingRegionHighlight.hexes.push(...occupiedHexes);
                existingRegionHighlight.squares.push(...occupiedSquares);
              } else {
                newHighlights.push({ regionId: region.id, hexes: occupiedHexes, squares: occupiedSquares });
              }
            }
          }
        }
      });
    });
    
    setHighlightedGrids(newHighlights);
  };

  // Get resize handle at position for a region
  const getResizeHandle = (region: CanvasRegion, worldX: number, worldY: number): string | null => {
    if (region.regionType === 'path' && region.pathPoints) {
      const handleSize = 20 / transform.zoom; // Increased hitbox size
      
      // Check Bezier control points first (smaller, higher priority)
      if (region.bezierControlPoints) {
        for (let i = 0; i < region.bezierControlPoints.length; i++) {
          const controls = region.bezierControlPoints[i];
          
          // Check first control point
          const distCp1 = Math.sqrt(
            Math.pow(worldX - controls.cp1.x, 2) + Math.pow(worldY - controls.cp1.y, 2)
          );
          if (distCp1 <= handleSize / 3) {
            return `cp-${i}-1`;
          }
          
          // Check second control point
          if (i < region.pathPoints.length - 1) {
            const distCp2 = Math.sqrt(
              Math.pow(worldX - controls.cp2.x, 2) + Math.pow(worldY - controls.cp2.y, 2)
            );
            if (distCp2 <= handleSize / 3) {
              return `cp-${i}-2`;
            }
          }
        }
      }
      
      // Then check anchor points
      for (let i = 0; i < region.pathPoints.length; i++) {
        const point = region.pathPoints[i];
        const distance = Math.sqrt(
          Math.pow(worldX - point.x, 2) + Math.pow(worldY - point.y, 2)
        );
        
        if (distance <= handleSize / 2) {
          return `node-${i}`;
        }
      }
      
      return null;
    } else {
      // Rectangle region resize handles  
      const handleSize = 20 / transform.zoom; // Increased hitbox size
      const { x, y, width, height } = region;
      
      // Check corner handles
      if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - y) <= handleSize) return 'nw';
      if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - y) <= handleSize) return 'ne';
      if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return 'sw';
      if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return 'se';
      
      // Check edge handles
      if (Math.abs(worldX - (x + width/2)) <= handleSize && Math.abs(worldY - y) <= handleSize) return 'n';
      if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - (y + height/2)) <= handleSize) return 'e';
      if (Math.abs(worldX - (x + width/2)) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return 's';
      if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - (y + height/2)) <= handleSize) return 'w';
      
      return null;
    }
  };
  const redrawCanvas = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context
    ctx.save();
    
    // Apply transform
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.zoom, transform.zoom);
    
    // Calculate viewport
    const viewWidth = canvas.width / transform.zoom;
    const viewHeight = canvas.height / transform.zoom;
    const viewX = -transform.x / transform.zoom;
    const viewY = -transform.y / transform.zoom;
    
    // Determine rendering mode
    const isPlayMode = renderingMode === 'play';
    const isEditMode = renderingMode === 'edit';
    
    // TODO: Future enhancement - apply Watabou styling in Play Mode
    // For now, both modes use the same VTT rendering style
    
    // Draw background
    if (isPlayMode) {
      // Play mode: Eventually will use Watabou styling, for now same as edit
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(viewX - 1000, viewY - 1000, viewWidth + 2000, viewHeight + 2000);
    } else {
      // Edit mode: VTT dark background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(viewX - 1000, viewY - 1000, viewWidth + 2000, viewHeight + 2000);
    }
    
    // Draw grid (both modes for now)
    if (true) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1 / transform.zoom;
      
      const gridSize = 40;
      const startX = Math.floor((viewX - 1000) / gridSize) * gridSize;
      const endX = Math.ceil((viewX + viewWidth + 1000) / gridSize) * gridSize;
      const startY = Math.floor((viewY - 1000) / gridSize) * gridSize;
      const endY = Math.ceil((viewY + viewHeight + 1000) / gridSize) * gridSize;
      
      // Vertical lines
      for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
    }
    
    // Draw tokens that are in viewport
    const visibleTokens: any[] = [];
    const offScreenTokens: any[] = [];
    const baseTokenSize = 40; // Base size for 1x1 token
    
    tokens.forEach(token => {
      // Use temporary position if available (during region drag)
      const tempPos = tempTokenPositions?.[token.id];
      const checkToken = tempPos ? { ...token, x: tempPos.x, y: tempPos.y } : token;
      
      // Use the larger dimension for circular token radius
      const tokenSize = Math.max(checkToken.gridWidth || 1, checkToken.gridHeight || 1) * baseTokenSize;
      const radius = tokenSize / 2;
      const tokenLeft = checkToken.x - radius;
      const tokenRight = checkToken.x + radius;
      const tokenTop = checkToken.y - radius;
      const tokenBottom = checkToken.y + radius;
      
      // Check if token is in viewport
      if (tokenRight >= viewX && tokenLeft <= viewX + viewWidth &&
          tokenBottom >= viewY && tokenTop <= viewY + viewHeight) {
        visibleTokens.push(checkToken);
      } else {
        offScreenTokens.push(checkToken);
      }
    });
    
    // 1. First render terrain features (water, debris, etc.) - BELOW walls
    renderTerrainFeatures(ctx, terrainFeatures, transform.zoom, isPlayMode, watabouStyle, regions);
    
    // 2. Then render regions/walls - ABOVE terrain features
    if (isPlayMode) {
      // Play mode: Same rendering as edit for now
      regions.forEach(region => {
        drawRegion(ctx, region);
      });
    } else {
      // Edit mode: Render regions + negative space visualization
      regions.forEach(region => {
        drawRegion(ctx, region);
      });
      
      // Draw negative space region in edit mode
      const negativeSpace = generateNegativeSpaceRegion(regions);
      if (negativeSpace) {
        drawNegativeSpaceRegion(ctx, negativeSpace.wallGeometry);
      }
    }
    
    // 3. Then render doors - ABOVE walls
    if (isPlayMode) {
      renderDoors(ctx, doors, transform.zoom);
    } else {
      renderDoors(ctx, doors, transform.zoom);
    }
    
    // Draw highlighted grids (if any) - below tokens in z-order
    drawHighlightedGrids(ctx);
    
    // Draw visible tokens
    visibleTokens.forEach(token => {
      // Use temporary position if available (during region drag)
      const tempPos = tempTokenPositions?.[token.id];
      const renderToken = tempPos ? { ...token, x: tempPos.x, y: tempPos.y } : token;
      drawToken(ctx, renderToken);
    });
    
    // Draw annotations on top of tokens
    renderAnnotations(ctx, annotations, transform.zoom);
    
    // Draw current path being drawn
    if (pathDrawingMode === 'drawing' && currentPath.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2 / transform.zoom;
      ctx.setLineDash([5, 5]);
      
      if (currentPath.length === 1) {
        // Draw first point
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(currentPath[0].x, currentPath[0].y, 4 / transform.zoom, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        // Draw path lines
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        for (let i = 1; i < currentPath.length; i++) {
          ctx.lineTo(currentPath[i].x, currentPath[i].y);
        }
        ctx.stroke();
        
        // Draw vertices
        ctx.fillStyle = '#ff6b6b';
        currentPath.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4 / transform.zoom, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
      ctx.restore();
    }
    
    // Draw ghost token and drag path if dragging
    if (isDraggingToken && draggedTokenId) {
      drawDragGhostAndPath(ctx);
    }
    
    // Restore context before drawing off-screen indicators
    ctx.restore();
    
    // Draw off-screen token indicators
    offScreenTokens.forEach(token => {
      drawOffScreenIndicator(ctx, token, viewX, viewY, viewWidth, viewHeight);
    });
  };

  // Function to draw drag ghost and path
  const drawDragGhostAndPath = (ctx: CanvasRenderingContext2D) => {
    if (!draggedTokenId) return;
    
    const draggedToken = tokens.find(t => t.id === draggedTokenId);
    if (!draggedToken) return;
    
    // Draw ghost token at original position
    drawGhostToken(ctx, dragStartPos.x, dragStartPos.y, draggedToken);
    
    // Draw drag path
    drawDragPath(ctx, draggedToken);
  };

  // Function to draw a ghost token (semi-transparent version)
  const drawGhostToken = (ctx: CanvasRenderingContext2D, x: number, y: number, token: any) => {
    const baseTokenSize = 40; // Base size for 1x1 token
    // Use the larger dimension for circular token radius
    const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
    const radius = tokenSize / 2;
    
    // Save context to restore alpha
    ctx.save();
    ctx.globalAlpha = 0.3;
    
    // Draw ghost token circle
    ctx.fillStyle = token.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw ghost border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / transform.zoom;
    ctx.setLineDash([5 / transform.zoom, 5 / transform.zoom]); // Dashed border
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash
    
    // Draw ghost label
    if (token.label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${12 / transform.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.label, x, y);
    }
    
    ctx.restore();
  };

  // Function to draw drag path
  const drawDragPath = (ctx: CanvasRenderingContext2D, token: any) => {
    // For free movement: draw straight line from start to current position
    // TODO: For grid movement, this will use grid-based pathfinding algorithms
    
    const gridSize = 40; // Grid unit size in pixels
    
    ctx.save();
    
    // Calculate distance in grid units
    const dx = token.x - dragStartPos.x;
    const dy = token.y - dragStartPos.y;
    const distancePixels = Math.sqrt(dx * dx + dy * dy);
    const distanceGridUnits = (distancePixels / gridSize).toFixed(2);
    
    // Draw path line
    ctx.strokeStyle = token.color || '#ffffff';
    ctx.lineWidth = 3 / transform.zoom;
    ctx.globalAlpha = 0.6;
    
    // Simple straight line for free movement
    ctx.beginPath();
    ctx.moveTo(dragStartPos.x, dragStartPos.y);
    ctx.lineTo(token.x, token.y);
    ctx.stroke();
    
    // Draw distance text at midpoint of line
    if (distancePixels > 10) { // Only show if line is long enough
      const midX = (dragStartPos.x + token.x) / 2;
      const midY = (dragStartPos.y + token.y) / 2;
      
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.font = `${14 / transform.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Add background to text for better readability
      const textMetrics = ctx.measureText(`${distanceGridUnits} units`);
      const textWidth = textMetrics.width;
      const textHeight = 14 / transform.zoom;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(midX - textWidth / 2 - 4 / transform.zoom, midY - textHeight / 2, textWidth + 8 / transform.zoom, textHeight);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${distanceGridUnits} units`, midX, midY);
    }
    
    // Draw path points if we have a detailed path
    if (dragPath.length > 1) {
      ctx.fillStyle = token.color || '#ffffff';
      ctx.globalAlpha = 0.4;
      
      // Calculate total path distance
      let pathDistance = 0;
      for (let i = 1; i < dragPath.length; i++) {
        const dx = dragPath[i].x - dragPath[i - 1].x;
        const dy = dragPath[i].y - dragPath[i - 1].y;
        pathDistance += Math.sqrt(dx * dx + dy * dy);
      }
      const pathDistanceGridUnits = (pathDistance / gridSize).toFixed(2);
      
      // Draw path points
      dragPath.forEach((point, index) => {
        if (index === 0 || index === dragPath.length - 1) return; // Skip start and end
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2 / transform.zoom, 0, 2 * Math.PI);
        ctx.fill();
      });
      
      // Draw path distance text near the end of the path
      if (dragPath.length > 2 && pathDistance > 10) {
        const endPoint = dragPath[dragPath.length - 1];
        const secondLastPoint = dragPath[dragPath.length - 2];
        
        // Position text farther offset from the end point to avoid token overlap
        const offsetX = 40 / transform.zoom;
        const offsetY = -40 / transform.zoom;
        const textX = endPoint.x + offsetX;
        const textY = endPoint.y + offsetY;
        
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.font = `${12 / transform.zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add background to text for better readability
        const pathText = `Path: ${pathDistanceGridUnits}`;
        const textMetrics = ctx.measureText(pathText);
        const textWidth = textMetrics.width;
        const textHeight = 12 / transform.zoom;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(textX - textWidth / 2 - 3 / transform.zoom, textY - textHeight / 2, textWidth + 6 / transform.zoom, textHeight);
        
        ctx.fillStyle = token.color || '#ffffff';
        ctx.fillText(pathText, textX, textY);
      }
    }
    
    // Draw direction arrow at current position
    drawDirectionArrow(ctx, dragStartPos, { x: token.x, y: token.y }, token.color || '#ffffff');
    
    ctx.restore();
  };

  // Function to draw direction arrow
  const drawDirectionArrow = (ctx: CanvasRenderingContext2D, from: { x: number, y: number }, to: { x: number, y: number }, color: string) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 10) return; // Too close to draw arrow
    
    const angle = Math.atan2(dy, dx);
    const arrowLength = 15 / transform.zoom;
    const arrowAngle = Math.PI / 6; // 30 degrees
    
    ctx.save();
    ctx.translate(to.x, to.y);
    ctx.rotate(angle);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2 / transform.zoom;
    ctx.globalAlpha = 0.8;
    
    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowLength, -arrowLength * Math.tan(arrowAngle));
    ctx.lineTo(-arrowLength, arrowLength * Math.tan(arrowAngle));
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  };

  // Function to draw negative space region (walls visualization in edit mode)
  const drawNegativeSpaceRegion = (ctx: CanvasRenderingContext2D, wallGeometry: any) => {
    ctx.save();
    
    // Draw with distinct visual style so users know it's the negative space
    ctx.strokeStyle = '#ff6b6b'; // Red outline
    ctx.lineWidth = 2 / transform.zoom;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#333333'; // Dark fill
    
    // Draw the wall path
    ctx.fill(wallGeometry.wallPath, 'evenodd');
    ctx.stroke(wallGeometry.wallPath);
    
    ctx.restore();
  };
  
  // Function to draw regions
  const drawRegion = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    const isSelected = region.selected;
    
    // Check if this region has a drag preview
    const preview = dragPreview?.regionId === region.id ? dragPreview : null;
    
    // Use preview data if available, otherwise use region data
    const effectiveRegion = preview ? {
      ...region,
      x: preview.x ?? region.x,
      y: preview.y ?? region.y,
      width: preview.width ?? region.width,
      height: preview.height ?? region.height,
      pathPoints: preview.pathPoints ?? region.pathPoints,
      bezierControlPoints: preview.bezierControlPoints ?? region.bezierControlPoints
    } : region;
    
    if (effectiveRegion.regionType === 'path' && effectiveRegion.pathPoints && effectiveRegion.pathPoints.length > 2) {
      // Handle path region rendering
      drawPathRegion(ctx, effectiveRegion, isSelected);
    } else {
      // Handle rectangle region rendering
      drawRectangleRegion(ctx, effectiveRegion, isSelected);
    }
    
    // Only show handles and selection in edit mode
    if (isSelected && renderingMode === 'edit') {
      if (region.regionType === 'path') {
        drawPathHandles(ctx, region);
      } else {
        drawRegionHandles(ctx, region);
      }
    }
  };

  // Function to draw path regions
  const drawPathRegion = (ctx: CanvasRenderingContext2D, region: CanvasRegion, isSelected: boolean) => {
    ctx.save();
    
    // Create path for clipping and filling
    ctx.beginPath();
    if (region.pathPoints && region.pathPoints.length > 0) {
      ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
      
      // Draw Bezier curves if control points exist
      if (region.bezierControlPoints && region.bezierControlPoints.length > 0) {
        for (let i = 0; i < region.pathPoints.length - 1; i++) {
          const p1 = region.pathPoints[i];
          const p2 = region.pathPoints[i + 1];
          const controls = region.bezierControlPoints[i];
          
          if (controls) {
            ctx.bezierCurveTo(
              controls.cp1.x, controls.cp1.y,
              controls.cp2.x, controls.cp2.y,
              p2.x, p2.y
            );
          } else {
            ctx.lineTo(p2.x, p2.y);
          }
        }
      } else {
        // Fallback to straight lines
        for (let i = 1; i < region.pathPoints.length; i++) {
          ctx.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
        }
      }
      ctx.closePath();
    }
    
    // Fill background
    if (region.backgroundImage) {
      ctx.clip();
      drawRegionBackground(ctx, region);
      ctx.restore();
      ctx.save();
      // Recreate path for stroke
      ctx.beginPath();
      if (region.pathPoints && region.pathPoints.length > 0) {
        ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
        
        // Draw Bezier curves if control points exist
        if (region.bezierControlPoints && region.bezierControlPoints.length > 0) {
          for (let i = 0; i < region.pathPoints.length - 1; i++) {
            const p1 = region.pathPoints[i];
            const p2 = region.pathPoints[i + 1];
            const controls = region.bezierControlPoints[i];
            
            if (controls) {
              ctx.bezierCurveTo(
                controls.cp1.x, controls.cp1.y,
                controls.cp2.x, controls.cp2.y,
                p2.x, p2.y
              );
            } else {
              ctx.lineTo(p2.x, p2.y);
            }
          }
        } else {
          // Fallback to straight lines
          for (let i = 1; i < region.pathPoints.length; i++) {
            ctx.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
          }
        }
        ctx.closePath();
      }
    } else {
      // Draw solid color background
      ctx.fillStyle = region.color || 'rgba(100, 100, 100, 0.3)';
      ctx.fill();
    }
    
    // Draw path outline
    ctx.strokeStyle = isSelected ? '#ffffff' : '#666666';
    ctx.lineWidth = (isSelected ? 3 : 2) / transform.zoom;
    ctx.stroke();
    
    ctx.restore();
    
    // Draw region-specific grid (only if visible)
    if (region.gridType !== 'free' && region.gridVisible) {
      drawRegionGrid(ctx, region);
    }
    
    // Draw transformation handles based on mode (handles themselves drawn in parent)
    if (isSelected) {
      // Draw transformation handles based on mode
      if (transformMode === 'scale') {
        drawScaleHandles(ctx, region);
      } else if (transformMode === 'rotate') {
        drawRotationHandles(ctx, region);
      }
    }
    
    // Draw grid type label
    if (region.gridType !== 'free' && region.pathPoints && region.pathPoints.length > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${10 / transform.zoom}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `${region.gridType.toUpperCase()} ${region.gridScale}x`, 
        region.pathPoints[0].x + 4 / transform.zoom, 
        region.pathPoints[0].y + 4 / transform.zoom
      );
    }
  };

  // Function to draw rectangle regions
  const drawRectangleRegion = (ctx: CanvasRenderingContext2D, region: CanvasRegion, isSelected: boolean) => {
    ctx.save();
    
    // Apply rotation if present
    const effectiveRotation = (region.rotation || 0) + (tempRegionRotation[region.id] || 0);
    if (effectiveRotation !== 0) {
      const centerX = region.x + region.width / 2;
      const centerY = region.y + region.height / 2;
      const angle = (effectiveRotation * Math.PI) / 180;
      
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.translate(-centerX, -centerY);
    }
    
    // Clip to region bounds
    ctx.beginPath();
    ctx.rect(region.x, region.y, region.width, region.height);
    ctx.clip();
    
    // Draw background image if available
    if (region.backgroundImage) {
      drawRegionBackground(ctx, region);
    } else {
      // Draw solid color background
      ctx.fillStyle = region.color || 'rgba(100, 100, 100, 0.3)';
      ctx.fillRect(region.x, region.y, region.width, region.height);
    }
    
    ctx.restore();
    
    // Save again for border and handles drawing with rotation
    ctx.save();
    
    // Apply rotation again for border drawing
    if (region.rotation && region.rotation !== 0) {
      const effectiveRotation = (region.rotation || 0) + (tempRegionRotation[region.id] || 0);
      const centerX = region.x + region.width / 2;
      const centerY = region.y + region.height / 2;
      const angle = (effectiveRotation * Math.PI) / 180;
      
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.translate(-centerX, -centerY);
    }
    
    // Draw region-specific grid (only if visible)
    if (region.gridType !== 'free' && region.gridVisible) {
      drawRegionGrid(ctx, region);
    }
    
    // Draw region border
    ctx.strokeStyle = isSelected ? '#ffffff' : '#666666';
    ctx.lineWidth = (isSelected ? 2 : 1) / transform.zoom;
    ctx.strokeRect(region.x, region.y, region.width, region.height);
    
    // Draw grid type label
    if (region.gridType !== 'free') {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${10 / transform.zoom}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `${region.gridType.toUpperCase()} ${region.gridScale}x`, 
        region.x + 4 / transform.zoom, 
        region.y + 4 / transform.zoom
      );
    }
    
    ctx.restore();
    
    // Draw transformation handles based on mode (handles themselves drawn in parent)
    if (isSelected) {
      // Draw transformation handles based on mode
      if (transformMode === 'scale') {
        drawScaleHandles(ctx, region);
      } else if (transformMode === 'rotate') {
        drawRotationHandles(ctx, region);
      }
    }
  };

  // Function to draw scale handles for a region
  const drawScaleHandles = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    const handles = generateTransformHandles(region);
    const scaleHandles = handles.filter(h => h.type !== 'rotate');
    
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1 / transform.zoom;
    
    scaleHandles.forEach(handle => {
      const size = handle.size / transform.zoom;
      ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
      ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
    });
    
    ctx.restore();
  };

  // Function to draw rotation handles for a region
  const drawRotationHandles = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    const handles = generateTransformHandles(region);
    const rotateHandle = handles.find(h => h.type === 'rotate');
    const centerHandle = getRotationCenterHandle(region, rotationCenter);
    
    if (!rotateHandle) return;
    
    ctx.save();
    
    // Draw rotation handle (circle)
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1 / transform.zoom;
    ctx.beginPath();
    ctx.arc(rotateHandle.x, rotateHandle.y, rotateHandle.size / transform.zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw center handle (diamond)
    ctx.fillStyle = '#4ecdc4';
    ctx.strokeStyle = '#333333';
    ctx.save();
    ctx.translate(centerHandle.x, centerHandle.y);
    ctx.rotate(Math.PI / 4);
    const size = centerHandle.size / transform.zoom;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
    
    // Draw line from center to rotation handle
    ctx.strokeStyle = '#666666';
    ctx.setLineDash([5 / transform.zoom, 5 / transform.zoom]);
    ctx.beginPath();
    ctx.moveTo(centerHandle.x, centerHandle.y);
    ctx.lineTo(rotateHandle.x, rotateHandle.y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.restore();
  };

  // Image cache to prevent re-loading images on every redraw
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Function to draw region background image
  const drawRegionBackground = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    if (!region.backgroundImage) return;
    
    let img = imageCache.current.get(region.backgroundImage);
    
    if (!img) {
      // Create and cache new image
      img = new Image();
      img.crossOrigin = 'anonymous';
      imageCache.current.set(region.backgroundImage, img);
      
      // Only set up onload for new images
      img.onload = () => {
        // Don't trigger another full redraw, just mark canvas as dirty
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const devicePixelRatio = window.devicePixelRatio || 1;
          redrawCanvas();
        }
      };
      
      img.src = region.backgroundImage;
      return; // Image not ready yet
    }
    
    // Only draw if image is fully loaded
    if (!img.complete || img.naturalHeight === 0) return;
    
    const { x, y, width, height } = region;
    const offsetX = region.backgroundOffsetX || 0;
    const offsetY = region.backgroundOffsetY || 0;
    const repeat = region.backgroundRepeat || 'no-repeat';
    
    if (repeat === 'no-repeat') {
      // For no-repeat, just draw the image once at the offset position
      ctx.drawImage(
        img, 
        x + offsetX, 
        y + offsetY,
        Math.min(img.width, width),
        Math.min(img.height, height)
      );
    } else {
      // For repeat patterns, use createPattern
      const pattern = ctx.createPattern(img, repeat);
      if (pattern) {
        // Apply offset to the pattern
        const matrix = new DOMMatrix();
        matrix.translateSelf(offsetX, offsetY);
        pattern.setTransform(matrix);
        
        ctx.fillStyle = pattern;
        ctx.fillRect(x, y, width, height);
      }
    }
  };

  // Function to draw grid within a region
  const drawRegionGrid = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    ctx.save();
    
    // Clip to region bounds - handle both rectangle and path regions
    if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 2) {
      // Clip to path shape using Bezier curves if available
      ctx.beginPath();
      ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
      
      // Use Bezier curves if control points exist
      if (region.bezierControlPoints && region.bezierControlPoints.length > 0) {
        for (let i = 0; i < region.pathPoints.length - 1; i++) {
          const p1 = region.pathPoints[i];
          const p2 = region.pathPoints[i + 1];
          const controls = region.bezierControlPoints[i];
          
          if (controls) {
            ctx.bezierCurveTo(
              controls.cp1.x, controls.cp1.y,
              controls.cp2.x, controls.cp2.y,
              p2.x, p2.y
            );
          } else {
            ctx.lineTo(p2.x, p2.y);
          }
        }
      } else {
        // Fallback to straight lines for polygon paths
        for (let i = 1; i < region.pathPoints.length; i++) {
          ctx.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
        }
      }
      
      ctx.closePath();
      ctx.clip();
    } else {
      // Clip to rectangle bounds
      ctx.beginPath();
      ctx.rect(region.x, region.y, region.width, region.height);
      ctx.clip();
    }
    
    ctx.strokeStyle = region.gridType === 'square' ? '#4f46e5' : '#06b6d4';
    ctx.lineWidth = 1 / transform.zoom;
    ctx.globalAlpha = 0.6;
    
    if (region.gridType === 'square') {
      drawSquareGrid(ctx, region);
    } else if (region.gridType === 'hex') {
      drawHexGrid(ctx, region);
    }
    
    ctx.restore();
  };

  // Function to draw highlighted grids
  const drawHighlightedGrids = (ctx: CanvasRenderingContext2D) => {
    if (highlightedGrids.length === 0) return;
    
    ctx.save();
    
    highlightedGrids.forEach(regionHighlight => {
      const region = regions.find(r => r.id === regionHighlight.regionId);
      if (!region) return;
      
      // Skip highlights for region being dragged
      if (isDraggingRegion && draggedRegionId === region.id) return;
      
      // Draw highlighted hexes
      regionHighlight.hexes.forEach(hex => {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Yellow highlight
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 3 / transform.zoom;
        
        // Draw filled hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          // Flat-top hexagon: start at right point and go clockwise (same as drawHexagon)
          const angle = (i * Math.PI) / 3;
          const x = hex.hexX + hex.radius * Math.cos(angle);
          const y = hex.hexY + hex.radius * Math.sin(angle);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      
      // Draw highlighted squares
      regionHighlight.squares.forEach(square => {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Yellow highlight
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 3 / transform.zoom;
        
        // Draw filled square centered on grid cell
        const halfSize = square.size / 2;
        ctx.fillRect(square.gridX - halfSize, square.gridY - halfSize, square.size, square.size);
        ctx.strokeRect(square.gridX - halfSize, square.gridY - halfSize, square.size, square.size);
      });
    });
    
    ctx.restore();
  };

  // Function to draw square grid within region
  const drawSquareGrid = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    const gridSize = region.gridSize;
    
    // Save context for local transformations
    ctx.save();
    
    // Apply rotation if present (same as region rotation logic)
    const effectiveRotation = (region.rotation || 0) + (tempRegionRotation[region.id] || 0);
    if (effectiveRotation !== 0) {
      const centerX = region.x + region.width / 2;
      const centerY = region.y + region.height / 2;
      const angle = (effectiveRotation * Math.PI) / 180;
      
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.translate(-centerX, -centerY);
    }
    
    // Calculate grid lines in local region space (starting from region origin)
    const cols = Math.ceil(region.width / gridSize);
    const rows = Math.ceil(region.height / gridSize);
    
    // Draw vertical lines
    for (let col = 0; col <= cols; col++) {
      const x = region.x + col * gridSize;
      if (x <= region.x + region.width) {
        ctx.beginPath();
        ctx.moveTo(x, region.y);
        ctx.lineTo(x, region.y + region.height);
        ctx.stroke();
      }
    }
    
    // Draw horizontal lines
    for (let row = 0; row <= rows; row++) {
      const y = region.y + row * gridSize;
      if (y <= region.y + region.height) {
        ctx.beginPath();
        ctx.moveTo(region.x, y);
        ctx.lineTo(region.x + region.width, y);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  };

  // Function to draw hex grid within region
  const drawHexGrid = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    const hexRadius = region.gridSize / 2;
    const hexWidth = hexRadius * 2;
    const hexHeight = hexRadius * Math.sqrt(3);
    
    // Calculate number of hexes that fit
    const cols = Math.ceil(region.width / (hexWidth * 0.75)) + 1;
    const rows = Math.ceil(region.height / hexHeight) + 1;
    
    // Starting position aligned to region
    const startX = region.x;
    const startY = region.y;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate hex center position
        const hexX = startX + col * (hexWidth * 0.75) + hexRadius;
        const hexY = startY + row * hexHeight + hexRadius + (col % 2) * (hexHeight / 2);
        
        // Only draw if hex center is within or near region bounds
        if (hexX >= region.x - hexRadius && hexX <= region.x + region.width + hexRadius &&
            hexY >= region.y - hexRadius && hexY <= region.y + region.height + hexRadius) {
          drawHexagon(ctx, hexX, hexY, hexRadius);
        }
      }
    }
  };

  // Function to draw a single hexagon (flat-top orientation)
  const drawHexagon = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      // Flat-top hexagon: start at right point and go clockwise
      const angle = (i * Math.PI) / 3;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  };

  // Function to draw region resize handles (for rectangle regions)
  const drawRegionHandles = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    const handleSize = 12 / transform.zoom;
    const { x, y, width, height } = region;
    
    ctx.fillStyle = '#4f46e5';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / transform.zoom;
    
    // Draw resize handles at corners and edges
    const handles = [
      { x: x, y: y }, // top-left
      { x: x + width / 2, y: y }, // top-center
      { x: x + width, y: y }, // top-right
      { x: x + width, y: y + height / 2 }, // right-center
      { x: x + width, y: y + height }, // bottom-right
      { x: x + width / 2, y: y + height }, // bottom-center
      { x: x, y: y + height }, // bottom-left
      { x: x, y: y + height / 2 }, // left-center
    ];
    
    handles.forEach(handle => {
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });
    
    // Draw rotation handle - positioned above the region
    const rotationHandleDistance = 30 / transform.zoom;
    const rotationX = x + width / 2;
    const rotationY = y - rotationHandleDistance;
    
    // Draw connection line from region to rotation handle
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2 / transform.zoom;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(rotationX, rotationY);
    ctx.stroke();
    
    // Draw rotation handle (circular)
    ctx.fillStyle = '#10b981'; // Different color for rotation handle
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rotationX, rotationY, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // Function to draw path control handles (for path regions)
  const calculateAngle = (centerX: number, centerY: number, pointX: number, pointY: number) => {
    return Math.atan2(pointY - centerY, pointX - centerX) * (180 / Math.PI);
  };

  // Helper function to rotate a point around a center
  const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
    const cos = Math.cos(angle * Math.PI / 180);
    const sin = Math.sin(angle * Math.PI / 180);
    const nx = (cos * (px - cx)) + (sin * (py - cy)) + cx;
    const ny = (cos * (py - cy)) - (sin * (px - cx)) + cy;
    return { x: nx, y: ny };
  };

  // Function to check if mouse is over rotation handle
  const isOverRotationHandle = (mouseX: number, mouseY: number, region: CanvasRegion) => {
    const handleSize = 30 / transform.zoom; // Further increased hitbox size
    const rotationHandleDistance = 30 / transform.zoom;
    const rotationX = region.x + region.width / 2;
    const rotationY = region.y - rotationHandleDistance;
    
    const distance = Math.sqrt((mouseX - rotationX) ** 2 + (mouseY - rotationY) ** 2);
    return distance <= handleSize;
  };

  // Function to draw path control nodes (for path regions)
  const drawPathHandles = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    if (!region.pathPoints || region.pathPoints.length === 0) return;
    
    const handleSize = 12 / transform.zoom;
    
    // Draw Bezier control handles if they exist
    if (region.bezierControlPoints && region.bezierControlPoints.length > 0) {
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1 / transform.zoom;
      ctx.setLineDash([3 / transform.zoom, 3 / transform.zoom]);
      
      // Draw control handle lines and control points
      region.pathPoints.forEach((point, index) => {
        if (index < region.bezierControlPoints!.length) {
          const controls = region.bezierControlPoints![index];
          
          // Draw lines from anchor to control points
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(controls.cp1.x, controls.cp1.y);
          ctx.stroke();
          
          if (index < region.pathPoints!.length - 1) {
            const nextPoint = region.pathPoints![index + 1];
            ctx.beginPath();
            ctx.moveTo(nextPoint.x, nextPoint.y);
            ctx.lineTo(controls.cp2.x, controls.cp2.y);
            ctx.stroke();
          }
          
          // Draw control point handles (small circles)
          ctx.setLineDash([]);
          ctx.fillStyle = '#4ecdc4';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 / transform.zoom;
          
          ctx.beginPath();
          ctx.arc(controls.cp1.x, controls.cp1.y, handleSize / 3, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
          
          if (index < region.pathPoints!.length - 1) {
            ctx.beginPath();
            ctx.arc(controls.cp2.x, controls.cp2.y, handleSize / 3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
          }
          
          ctx.setLineDash([3 / transform.zoom, 3 / transform.zoom]);
        }
      });
      
      ctx.setLineDash([]);
    }
    
    // Draw anchor points
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / transform.zoom;
    
    region.pathPoints.forEach((point, index) => {
      // Draw control node as circle
      ctx.beginPath();
      ctx.arc(point.x, point.y, handleSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Draw node index for clarity
      ctx.fillStyle = '#ffffff';
      ctx.font = `${8 / transform.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index.toString(), point.x, point.y);
      
      // Reset fill style for next node
      ctx.fillStyle = '#ff6b6b';
    });
  };

  // Function to add a new region
  const addNewRegion = () => {
    const regionId = `region-${Date.now()}`;
    
    // Get canvas dimensions to calculate viewport center
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const viewportCenterX = (canvas.width / 2 - transform.x) / transform.zoom;
    const viewportCenterY = (canvas.height / 2 - transform.y) / transform.zoom;
    
    // Create region with reasonable size (200x200 units) centered in viewport
    const regionSize = 200;
    
    const newRegion: CanvasRegion = {
      id: regionId,
      x: viewportCenterX - regionSize / 2,
      y: viewportCenterY - regionSize / 2,
      width: regionSize,
      height: regionSize,
      selected: false,
      color: 'rgba(100, 150, 200, 0.3)',
      gridType: 'free',
      gridSize: 40,  // Match main canvas grid size
      gridScale: 1.0, // Default scale
      gridSnapping: false, // Default to disabled per-region
      gridVisible: true, // Default to visible
      regionType: 'rectangle' // Default to rectangle
    };
    
    addRegion(newRegion);
    toast.success('Region added to viewport center');
  };

  // Function to start path drawing mode
  const startPathDrawing = (type: 'polygon' | 'freehand' = 'polygon') => {
    setPathDrawingMode('drawing');
    setPathDrawingType(type);
    setCurrentPath([]);
    if (type === 'polygon') {
      toast.info('Click to add points. Double-click to finish.');
    } else {
      toast.info('Click and drag to draw freehand. Release to finish.');
    }
  };

  // Function to finish path drawing and create region
  const finishPathDrawing = () => {
    if (currentPath.length < 3) {
      toast.error('Path must have at least 3 points');
      setPathDrawingMode('none');
      setCurrentPath([]);
      setIsFreehandDrawing(false);
      setLastFreehandPoint(null);
      return;
    }

    // Simplify the path if it's freehand
    let finalPath = currentPath;
    if (pathDrawingType === 'freehand') {
      // Aggressively simplify to get key anchor points (increased from 15.0 to 25.0)
      finalPath = simplifyPath(currentPath, 25.0);
      
      // Enforce maximum point limit to prevent storage overflow
      const MAX_POINTS = 100;
      if (finalPath.length > MAX_POINTS) {
        // Apply even more aggressive simplification
        const targetEpsilon = 25.0 * (finalPath.length / MAX_POINTS);
        finalPath = simplifyPath(currentPath, targetEpsilon);
      }
    }
    
    // Limit polygon paths too
    const MAX_POLYGON_POINTS = 200;
    if (finalPath.length > MAX_POLYGON_POINTS) {
      finalPath = simplifyPath(finalPath, 10.0);
    }
    
    // Generate Bezier control points for smooth curves (only in freehand mode)
    const bezierControls = pathDrawingType === 'freehand' ? generateBezierControlPoints(finalPath) : undefined;
    const bounds = bezierControls ? getBezierBounds(finalPath, bezierControls) : getPolygonBounds(finalPath);
    const newRegion: CanvasRegion = {
      id: `path-region-${Date.now()}`,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      selected: false,
      color: 'rgba(100, 150, 200, 0.3)',
      gridType: 'free',
      gridSize: 40,
      gridScale: 1.0,
      gridSnapping: false,
      gridVisible: true,
      regionType: 'path',
      pathPoints: [...finalPath],
      bezierControlPoints: bezierControls,
      smoothing: bezierControls ? true : undefined // Enable smoothing for freehand paths with curves
    };

    addRegion(newRegion);
    setPathDrawingMode('none');
    setPathDrawingType('polygon');
    setCurrentPath([]);
    setIsFreehandDrawing(false);
    setLastFreehandPoint(null);
    toast.success('Path region created');
  };

  // Function to check if point is in any region (supports both rect and path)
  const isPointInRegion = (x: number, y: number, region: CanvasRegion): boolean => {
    if (region.regionType === 'path' && region.pathPoints) {
      return isPointInPolygon({ x, y }, region.pathPoints);
    } else if (region.rotation && region.rotation !== 0) {
      // Handle rotated rectangle regions by converting to rotated corners
      const centerX = region.x + region.width / 2;
      const centerY = region.y + region.height / 2;
      const angle = (region.rotation * Math.PI) / 180;
      
      // Create corner points of the rectangle
      const corners = [
        { x: region.x, y: region.y },
        { x: region.x + region.width, y: region.y },
        { x: region.x + region.width, y: region.y + region.height },
        { x: region.x, y: region.y + region.height }
      ];
      
      // Rotate corners around center
      const rotatedCorners = corners.map(corner => ({
        x: centerX + (corner.x - centerX) * Math.cos(angle) - (corner.y - centerY) * Math.sin(angle),
        y: centerY + (corner.x - centerX) * Math.sin(angle) + (corner.y - centerY) * Math.cos(angle)
      }));
      
      return isPointInPolygon({ x, y }, rotatedCorners);
    } else {
      // Rectangle region (default behavior)
      return x >= region.x && x <= region.x + region.width && 
             y >= region.y && y <= region.y + region.height;
    }
  };

  const drawToken = (ctx: CanvasRenderingContext2D, token: any) => {
    const baseTokenSize = 40; // Base size for 1x1 token
    // Use the larger dimension for circular token radius
    const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
    const radius = tokenSize / 2;
    const isSelected = selectedTokenIds.includes(token.id);
    
    // Draw selection highlight
    if (isSelected) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius + 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Draw token circle
    ctx.fillStyle = token.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw token border
    ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
    ctx.lineWidth = (isSelected ? 3 : 2) / transform.zoom;
    ctx.stroke();
    
    // Draw token label
    if (token.label) {
      ctx.fillStyle = '#000000';
      ctx.font = `${12 / transform.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.label, token.x, token.y);
    }
  };

  // Function to draw off-screen token indicator
  const drawOffScreenIndicator = (
    ctx: CanvasRenderingContext2D, 
    token: any, 
    viewX: number, 
    viewY: number, 
    viewWidth: number, 
    viewHeight: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const margin = 10; // Distance from edge
    const indicatorSize = 8;
    const indicatorLength = 20;
    
    // Transform token position to screen coordinates
    const tokenScreenX = token.x * transform.zoom + transform.x;
    const tokenScreenY = token.y * transform.zoom + transform.y;
    
    // Calculate center of viewport
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Calculate direction vector from viewport center to token
    const dirX = tokenScreenX - centerX;
    const dirY = tokenScreenY - centerY;
    const distance = Math.sqrt(dirX * dirX + dirY * dirY);
    
    if (distance === 0) return;
    
    // Normalize direction
    const normalizedX = dirX / distance;
    const normalizedY = dirY / distance;
    
    // Find intersection with viewport edge
    let edgeX, edgeY;
    
    // Calculate intersection with viewport boundaries
    const leftDist = Math.abs(centerX - margin) / Math.abs(normalizedX);
    const rightDist = Math.abs(canvas.width - centerX - margin) / Math.abs(normalizedX);
    const topDist = Math.abs(centerY - margin) / Math.abs(normalizedY);
    const bottomDist = Math.abs(canvas.height - centerY - margin) / Math.abs(normalizedY);
    
    const minDist = Math.min(
      normalizedX < 0 ? leftDist : rightDist,
      normalizedY < 0 ? topDist : bottomDist
    );
    
    edgeX = centerX + normalizedX * minDist;
    edgeY = centerY + normalizedY * minDist;
    
    // Clamp to viewport bounds
    edgeX = Math.max(margin, Math.min(canvas.width - margin, edgeX));
    edgeY = Math.max(margin, Math.min(canvas.height - margin, edgeY));
    
    // Draw indicator rectangle
    ctx.fillStyle = token.color || '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    
    // Calculate angle for pointing
    const angle = Math.atan2(normalizedY, normalizedX);
    
    ctx.save();
    ctx.translate(edgeX, edgeY);
    ctx.rotate(angle);
    
    // Draw pointing rectangle
    ctx.fillRect(-indicatorLength / 2, -indicatorSize / 2, indicatorLength, indicatorSize);
    ctx.strokeRect(-indicatorLength / 2, -indicatorSize / 2, indicatorLength, indicatorSize);
    
    // Draw arrow tip
    ctx.beginPath();
    ctx.moveTo(indicatorLength / 2, 0);
    ctx.lineTo(indicatorLength / 2 + 6, -4);
    ctx.lineTo(indicatorLength / 2 + 6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 80;

    // Initial draw
    redrawCanvas();

    toast.success('Pan/Zoom Tabletop Ready! Controls: Left-click=select, Shift+click=add token, Right-click=pan, Scroll=zoom, Right-click token=menu');

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 80;
      redrawCanvas();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Redraw when transform, tokens, regions, or path changes
  useEffect(() => {
    redrawCanvas();
  }, [transform, tokens, regions, currentPath]);

  // Add click handler to place tokens or select them
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 && !isPanning && !isDraggingToken) { // Left click and not panning/dragging
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // Convert screen coordinates to world coordinates
      const worldPos = screenToWorld(clickX, clickY);
      
      // Check if we clicked on a token first (tokens are on top)
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      const clickedRegion = getRegionAtPosition(worldPos.x, worldPos.y);
      
      if (clickedToken) {
        // Token selection logic
        if (e.ctrlKey || e.metaKey) {
          // Ctrl+click: toggle selection
          setSelectedTokenIds(prev => 
            prev.includes(clickedToken.id)
              ? prev.filter(id => id !== clickedToken.id)
              : [...prev, clickedToken.id]
          );
        } else {
          // Normal click: select only this token
          setSelectedTokenIds([clickedToken.id]);
        }
      } else if (clickedRegion) {
        // Only allow region selection in edit mode
        if (renderingMode === 'edit') {
          // Check if clicking on rotation handle of an already selected region
          if (clickedRegion.selected && isOverRotationHandle(worldPos.x, worldPos.y, clickedRegion)) {
            // Don't deselect if clicking on rotation handle - let it handle rotation
            return;
          }
          
          // Region selection logic
          clearSelection();
          selectRegion(clickedRegion.id);
          setSelectedRegionId(clickedRegion.id);
          setSelectedTokenIds([]); // Deselect tokens when selecting region
        }
        // In play mode, clicking regions does nothing
      } else {
        // Clicked on empty space: deselect all or add token
        if (e.shiftKey) {
          // Shift+click: add token at clicked position
          addTokenToCanvas('', worldPos.x, worldPos.y);
        } else {
          // Normal click: deselect all
          setSelectedTokenIds([]);
          clearSelection();
          setSelectedRegionId(null);
        }
      }
    }
  };

  // Handle right-click context menu for tokens and regions
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const worldPos = screenToWorld(clickX, clickY);
    
    // Check if we right-clicked on a token first (tokens are on top)
    const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
    const clickedRegion = getRegionAtPosition(worldPos.x, worldPos.y);
    
    if (clickedToken) {
      // Dispatch custom event for TokenContextManager
      const event = new CustomEvent('showTokenContextMenu', {
        detail: {
          tokenId: clickedToken.id,
          x: e.clientX,
          y: e.clientY
        }
      });
      window.dispatchEvent(event);
    } else if (clickedRegion) {
      // Show region context menu
      showRegionContextMenu(e.clientX, e.clientY, clickedRegion);
    }
  };

  // Function to show region context menu
  const showRegionContextMenu = (x: number, y: number, region: CanvasRegion) => {
    // Remove any existing context menu safely
    const existingMenu = document.querySelector('.region-context-menu');
    if (existingMenu && document.body.contains(existingMenu)) {
      document.body.removeChild(existingMenu);
    }
    
    const menu = document.createElement('div');
    menu.className = 'region-context-menu fixed z-50 bg-popover border border-border rounded-md shadow-lg p-1';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    const menuItems = [
      { 
        label: 'Edit Background', 
        icon: '🖼️', 
        action: () => {
          setSelectedRegionForEdit(region);
          setIsRegionBackgroundModalOpen(true);
        }
      },
      { 
        label: 'Free Grid', 
        icon: '📐', 
        action: () => setRegionGridType(region.id, 'free'),
        active: region.gridType === 'free'
      },
      { 
        label: 'Square Grid', 
        icon: '⬜', 
        action: () => setRegionGridType(region.id, 'square'),
        active: region.gridType === 'square'
      },
      { 
        label: 'Hex Grid', 
        icon: '⬢', 
        action: () => setRegionGridType(region.id, 'hex'),
        active: region.gridType === 'hex'
      },
      { 
        label: 'Delete Region', 
        icon: '🗑️', 
        action: () => deleteSelectedRegion(region.id), 
        danger: true 
      }
    ];
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = `px-3 py-2 text-sm cursor-pointer hover:bg-accent rounded flex items-center gap-2 ${
        item.danger ? 'text-destructive' : ''
      } ${item.active ? 'bg-accent font-medium' : ''}`;
      menuItem.innerHTML = `<span>${item.icon}</span> ${item.label}${item.active ? ' ✓' : ''}`;
      menuItem.onclick = () => {
        item.action();
        // Safe menu removal
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
      };
      menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // Remove menu when clicking outside
    const removeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        // Safe menu removal
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener('click', removeMenu);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 100);
  };

  // Function to set region grid type
  const setRegionGridType = (regionId: string, gridType: 'square' | 'hex' | 'free') => {
    updateRegion(regionId, { gridType });
    toast.success(`Region grid set to ${gridType}`);
  };

  // Function to toggle region snapping
  const toggleRegionSnapping = (regionId: string) => {
    const targetRegion = regions.find(r => r.id === regionId);
    if (targetRegion) {
      const newState = !targetRegion.gridSnapping;
      updateRegion(regionId, { gridSnapping: newState });
      toast.success(`Region snapping ${newState ? 'enabled' : 'disabled'}`);
    }
  };

  // Function to toggle region grid visibility
  const toggleRegionGridVisibility = (regionId: string) => {
    const targetRegion = regions.find(r => r.id === regionId);
    if (targetRegion) {
      const newState = !targetRegion.gridVisible;
      updateRegion(regionId, { gridVisible: newState });
      toast.success(`Region grid ${newState ? 'shown' : 'hidden'}`);
    }
  };

  // Function to delete region
  const deleteSelectedRegion = (regionId: string) => {
    removeRegion(regionId);
    if (selectedRegionId === regionId) {
      setSelectedRegionId(null);
    }
    toast.success('Region deleted');
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);
    
    // Early exit if in play mode and clicking on a region
    if (renderingMode === 'play') {
      const clickedRegion = getRegionAtPosition(worldPos.x, worldPos.y);
      if (clickedRegion) {
        // Don't allow region interaction in play mode
        return;
      }
    }
    
    if (e.button === 2) { // Right click
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0) { // Left click
      // Handle path drawing mode
      if (pathDrawingMode === 'drawing') {
        if (pathDrawingType === 'polygon') {
          // Polygon mode: Add point on click
          setCurrentPath(prev => [...prev, { x: worldPos.x, y: worldPos.y }]);
          return;
        } else {
          // Freehand mode: Start drawing on mouse down
          setIsFreehandDrawing(true);
          setCurrentPath([{ x: worldPos.x, y: worldPos.y }]);
          return;
        }
      }
      
      // Handle path editing mode
      if (pathDrawingMode === 'editing' && selectedRegionId) {
        const selectedRegion = regions.find(r => r.id === selectedRegionId);
        if (selectedRegion && selectedRegion.regionType === 'path' && selectedRegion.pathPoints) {
          // Check if clicking on a Bezier control point first
          if (selectedRegion.bezierControlPoints) {
            const tolerance = 15 / transform.zoom;
            for (let i = 0; i < selectedRegion.bezierControlPoints.length; i++) {
              const controls = selectedRegion.bezierControlPoints[i];
              
              // Check first control point
              const distCp1 = Math.sqrt(
                (worldPos.x - controls.cp1.x) ** 2 + (worldPos.y - controls.cp1.y) ** 2
              );
              if (distCp1 <= tolerance) {
                setEditingControlPointIndex({ segmentIndex: i, isFirst: true });
                redrawCanvas();
                return;
              }
              
              // Check second control point
              if (i < selectedRegion.pathPoints.length - 1) {
                const distCp2 = Math.sqrt(
                  (worldPos.x - controls.cp2.x) ** 2 + (worldPos.y - controls.cp2.y) ** 2
                );
                if (distCp2 <= tolerance) {
                  setEditingControlPointIndex({ segmentIndex: i, isFirst: false });
                  redrawCanvas();
                  return;
                }
              }
            }
          }
          
          // Check if clicking on an anchor point
          const vertexIndex = findNearestVertex(worldPos, selectedRegion.pathPoints);
          if (vertexIndex !== null) {
            setEditingVertexIndex(vertexIndex);
            redrawCanvas();
            return;
          }
        }
      }
      
      // PRIORITY 1: Check for ANY handle on selected region first
      // This prevents deselection when clicking handles outside the shape boundary
      if (selectedRegionId) {
        const selectedRegion = regions.find(r => r.id === selectedRegionId && r.selected);
        if (selectedRegion) {
          // Check for resize/anchor/bezier handles
          const handle = getResizeHandle(selectedRegion, worldPos.x, worldPos.y);
          if (handle) {
            // All handles (node, cp, and resize) use the same resizing mechanism
            setIsResizingRegion(true);
            setResizeHandle(handle);
            setDraggedRegionId(selectedRegion.id);
            return;
          }
          
          // Check for rotation handle
          if (isOverRotationHandle(worldPos.x, worldPos.y, selectedRegion)) {
            setIsRotatingRegion(true);
            setDraggedRegionId(selectedRegion.id);
            const centerX = selectedRegion.x + selectedRegion.width / 2;
            const centerY = selectedRegion.y + selectedRegion.height / 2;
            setRotationStartAngle(calculateAngle(centerX, centerY, worldPos.x, worldPos.y));
            
            // Group tokens for rotation
            const tokensInRegion: {tokenId: string, startX: number, startY: number}[] = [];
            tokens.forEach(token => {
              if (isPointInRegion(token.x, token.y, selectedRegion)) {
                tokensInRegion.push({
                  tokenId: token.id,
                  startX: token.x,
                  startY: token.y
                });
              }
            });
            setGroupedTokens(tokensInRegion);
            return;
          }
        }
      }
      
      // PRIORITY 2: Check for transformation handles on selected regions
      if (selectedRegionId && transformMode !== 'move') {
        const selectedRegion = regions.find(r => r.id === selectedRegionId && r.selected);
        if (selectedRegion) {
          if (transformMode === 'scale') {
            const handles = generateTransformHandles(selectedRegion);
            const scaleHandles = handles.filter(h => h.type !== 'rotate');
            const hitHandle = hitTestTransformHandle(worldPos, scaleHandles);
            
            if (hitHandle) {
              setIsTransforming(true);
              setTransformHandle(hitHandle.type);
              setDraggedRegionId(selectedRegion.id);
              setRegionDragOffset({ x: worldPos.x, y: worldPos.y });
              return;
            }
          } else if (transformMode === 'rotate') {
            const handles = generateTransformHandles(selectedRegion);
            const rotateHandle = handles.find(h => h.type === 'rotate');
            const centerHandle = getRotationCenterHandle(selectedRegion, rotationCenter);
            
            if (rotateHandle && hitTestTransformHandle(worldPos, [rotateHandle])) {
              setIsTransforming(true);
              setTransformHandle('rotate');
              setDraggedRegionId(selectedRegion.id);
              setRegionDragOffset({ x: worldPos.x, y: worldPos.y });
              return;
            } else if (hitTestTransformHandle(worldPos, [centerHandle])) {
              setIsTransforming(true);
              setTransformHandle('center');
              setDraggedRegionId(selectedRegion.id);
              setRegionDragOffset({ x: worldPos.x, y: worldPos.y });
              return;
            }
          }
        }
      }
      
      // PRIORITY 2: Check what we're clicking on for dragging (tokens first, then regions)
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      const clickedRegion = getRegionAtPosition(worldPos.x, worldPos.y);
      
      if (clickedToken) {
        setIsDraggingToken(true);
        setDraggedTokenId(clickedToken.id);
        setDragOffset({
          x: worldPos.x - clickedToken.x,
          y: worldPos.y - clickedToken.y
        });
        
        // Store original position for ghost and path
        setDragStartPos({ x: clickedToken.x, y: clickedToken.y });
        setDragPath([{ x: clickedToken.x, y: clickedToken.y }]);
        
        // If token not selected, select it
        if (!selectedTokenIds.includes(clickedToken.id)) {
          setSelectedTokenIds([clickedToken.id]);
        }
      } else if (clickedRegion && clickedRegion.selected) {
        // Check if we're clicking on a rotation handle first
        if (isOverRotationHandle(worldPos.x, worldPos.y, clickedRegion)) {
          setIsRotatingRegion(true);
          setDraggedRegionId(clickedRegion.id);
          
          // Calculate starting angle from region center to mouse
          const centerX = clickedRegion.x + clickedRegion.width / 2;
          const centerY = clickedRegion.y + clickedRegion.height / 2;
          setRotationStartAngle(calculateAngle(centerX, centerY, worldPos.x, worldPos.y));
          
          // Group tokens inside the region for rotation
          const tokensInRegion: {tokenId: string, startX: number, startY: number}[] = [];
          tokens.forEach(token => {
            if (isPointInRegion(token.x, token.y, clickedRegion)) {
              tokensInRegion.push({
                tokenId: token.id,
                startX: token.x,
                startY: token.y
              });
            }
          });
          
          setGroupedTokens(tokensInRegion);
        }
        // Check if we're clicking on a resize handle
        else {
          const handle = getResizeHandle(clickedRegion, worldPos.x, worldPos.y);
        
        if (handle) {
          setIsResizingRegion(true);
          setResizeHandle(handle);
          setDraggedRegionId(clickedRegion.id);
        } else {
          // Start dragging the region - group tokens for smooth movement
          setIsDraggingRegion(true);
          setDraggedRegionId(clickedRegion.id);
          
          if (clickedRegion.regionType === 'path' && clickedRegion.pathPoints) {
            // For path regions, use the bounding box origin as reference
            setRegionDragOffset({
              x: worldPos.x - clickedRegion.x,
              y: worldPos.y - clickedRegion.y
            });
          } else {
            // For rectangle regions, use the top-left corner
            setRegionDragOffset({
              x: worldPos.x - clickedRegion.x,
              y: worldPos.y - clickedRegion.y
            });
          }
          
          // Group tokens inside the region for smooth dragging
          const tokensInRegion: {tokenId: string, startX: number, startY: number}[] = [];
          tokens.forEach(token => {
            if (isPointInRegion(token.x, token.y, clickedRegion)) {
              tokensInRegion.push({
                tokenId: token.id,
                startX: token.x,
                startY: token.y
              });
            }
          });
          
          setGroupedTokens(tokensInRegion);
          setTokensMovedByRegion(tokensInRegion.map(t => t.tokenId));
        }
        }
      } else {
        handleCanvasClick(e);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Handle freehand drawing with throttling to reduce points
    if (isFreehandDrawing && pathDrawingMode === 'drawing' && pathDrawingType === 'freehand') {
      const worldPos = screenToWorld(mouseX, mouseY);
      
      // Only add point if it's far enough from the last point (throttling)
      const minDistance = 5; // Minimum distance between points in world coordinates
      if (!lastFreehandPoint || 
          Math.sqrt((worldPos.x - lastFreehandPoint.x) ** 2 + (worldPos.y - lastFreehandPoint.y) ** 2) >= minDistance) {
        
        // Limit max points during drawing to prevent memory issues
        setCurrentPath(prev => {
          const MAX_DRAWING_POINTS = 500;
          if (prev.length >= MAX_DRAWING_POINTS) {
            // Apply live simplification when hitting limit
            const simplified = simplifyPath(prev, 10.0);
            return [...simplified, { x: worldPos.x, y: worldPos.y }];
          }
          return [...prev, { x: worldPos.x, y: worldPos.y }];
        });
        setLastFreehandPoint(worldPos);
      }
      return;
    }
    
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (isDraggingToken && draggedTokenId) {
      // Token dragging
      const worldPos = screenToWorld(mouseX, mouseY);
      const newX = worldPos.x - dragOffset.x;
      const newY = worldPos.y - dragOffset.y;
      
      // Get the dragged token to access its size
      const draggedToken = tokens.find(t => t.id === draggedTokenId);
      const tokenGridWidth = draggedToken?.gridWidth || 1;
      const tokenGridHeight = draggedToken?.gridHeight || 1;
      
      // Update grid highlights based on token position and size
      updateGridHighlights(newX, newY, tokenGridWidth, tokenGridHeight);
      
      // Add point to drag path (sample every few pixels for smoother path)
      const lastPoint = dragPath[dragPath.length - 1];
      const distance = Math.sqrt((newX - lastPoint.x) ** 2 + (newY - lastPoint.y) ** 2);
      if (distance > 10) { // Sample every 10 world units
        setDragPath(prev => [...prev, { x: newX, y: newY }]);
      }
      
      // Update token position in store
      updateTokenPosition(draggedTokenId, newX, newY);
      
      // Force immediate redraw for smooth dragging feedback
      redrawCanvas();
    } else if (isDraggingRegion && draggedRegionId) {
      // Region dragging - move tokens in real-time for smooth preview
      const worldPos = screenToWorld(mouseX, mouseY);
      const newX = worldPos.x - regionDragOffset.x;
      const newY = worldPos.y - regionDragOffset.y;
      
      // Find the region being dragged
      const draggedRegion = regions.find(r => r.id === draggedRegionId);
      if (draggedRegion) {
        // Calculate movement delta from original region position
        const deltaX = newX - draggedRegion.x;
        const deltaY = newY - draggedRegion.y;
        
        // Update temporary positions for preview (avoid store updates during drag)
        const newTempPositions: {[tokenId: string]: {x: number, y: number}} = {};
        groupedTokens.forEach(groupedToken => {
          const newTokenX = groupedToken.startX + deltaX;
          const newTokenY = groupedToken.startY + deltaY;
          newTempPositions[groupedToken.tokenId] = { x: newTokenX, y: newTokenY };
        });
        setTempTokenPositions(newTempPositions);
        
        if (draggedRegion.regionType === 'path' && draggedRegion.pathPoints) {
          // Update path points for preview
          const newPathPoints = draggedRegion.pathPoints.map(point => ({
            x: point.x + deltaX,
            y: point.y + deltaY
          }));
          
          // Also update bezier control points if they exist
          let newBezierControls = draggedRegion.bezierControlPoints;
          if (draggedRegion.bezierControlPoints) {
            newBezierControls = draggedRegion.bezierControlPoints.map(control => ({
              cp1: {
                x: control.cp1.x + deltaX,
                y: control.cp1.y + deltaY
              },
              cp2: {
                x: control.cp2.x + deltaX,
                y: control.cp2.y + deltaY
              }
            }));
          }
          
          const newBounds = newBezierControls ? 
            getBezierBounds(newPathPoints, newBezierControls) : 
            getPolygonBounds(newPathPoints);
          
          setDragPreview({
            regionId: draggedRegionId,
            pathPoints: newPathPoints,
            bezierControlPoints: newBezierControls,
            x: newBounds.x,
            y: newBounds.y,
            width: newBounds.width,
            height: newBounds.height
          });
        } else {
          // Update rectangle preview
          setDragPreview({
            regionId: draggedRegionId,
            x: newX,
            y: newY,
            width: draggedRegion.width,
            height: draggedRegion.height
          });
        }
      }
      
      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => redrawCanvas());
    } else if (isRotatingRegion && draggedRegionId) {
      // Region rotation - rotate tokens around region center
      const worldPos = screenToWorld(mouseX, mouseY);
      
      // Find the region being rotated
      const draggedRegion = regions.find(r => r.id === draggedRegionId);
      if (draggedRegion) {
        const centerX = draggedRegion.x + draggedRegion.width / 2;
        const centerY = draggedRegion.y + draggedRegion.height / 2;
        
        // Calculate current angle from center to mouse
        const currentAngle = calculateAngle(centerX, centerY, worldPos.x, worldPos.y);
        const rotationDelta = currentAngle - rotationStartAngle;
        
        // Update temporary region rotation
        setTempRegionRotation({ [draggedRegionId]: rotationDelta });
        
        // Create drag preview for the region to maintain visibility during rotation
        setDragPreview({
          regionId: draggedRegionId,
          x: draggedRegion.x,
          y: draggedRegion.y,
          width: draggedRegion.width,
          height: draggedRegion.height,
          pathPoints: draggedRegion.pathPoints,
          bezierControlPoints: draggedRegion.bezierControlPoints
        });
        
        // Rotate all grouped tokens around region center
        const newTempPositions: {[tokenId: string]: {x: number, y: number}} = {};
        groupedTokens.forEach(groupedToken => {
          const rotatedPos = rotatePoint(
            groupedToken.startX, 
            groupedToken.startY, 
            centerX, 
            centerY, 
            rotationDelta
          );
          newTempPositions[groupedToken.tokenId] = { x: rotatedPos.x, y: rotatedPos.y };
        });
        setTempTokenPositions(newTempPositions);
      }
      
      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => redrawCanvas());
    } else if (isTransforming && draggedRegionId && transformHandle) {
      // Handle transformation operations
      const worldPos = screenToWorld(mouseX, mouseY);
      const targetRegion = regions.find(r => r.id === draggedRegionId);
      
      if (targetRegion) {
        if (transformMode === 'scale' && transformHandle !== 'rotate' && transformHandle !== 'center') {
          // Calculate scale transformation
          const bounds = getRegionBounds(targetRegion);
          const dragStart = regionDragOffset;
          const dragDelta = {
            x: worldPos.x - dragStart.x,
            y: worldPos.y - dragStart.y
          };
          
          const { scaleX, scaleY, anchor } = calculateScaleFromDrag(
            { x: 0, y: 0, type: transformHandle as any, size: 8 },
            dragDelta,
            bounds
          );
          
          const scaleUpdates = scaleRegion(targetRegion, scaleX, scaleY, anchor);
          
          // Update preview
          setDragPreview({
            regionId: draggedRegionId,
            ...scaleUpdates
          });
          
        } else if (transformMode === 'rotate') {
          if (transformHandle === 'center') {
            // Moving rotation center
            setRotationCenter({ x: worldPos.x, y: worldPos.y });
          } else if (transformHandle === 'rotate') {
            // Rotating around center
            const center = rotationCenter || getRegionBounds(targetRegion);
            const dragStart = regionDragOffset;
            
            const rotationAngle = calculateRotationFromDrag(
              center,
              worldPos,
              { x: dragStart.x, y: dragStart.y }
            );
            
            const rotateUpdates = rotateRegion(targetRegion, rotationAngle, center);
            
            // Update preview
            setDragPreview({
              regionId: draggedRegionId,
              ...rotateUpdates
            });
          }
        }
      }
      
      requestAnimationFrame(() => redrawCanvas());
    } else if (isResizingRegion && draggedRegionId && resizeHandle) {
      // Region resizing or path node editing - use preview for smooth updates
      const worldPos = screenToWorld(mouseX, mouseY);
      
      const targetRegion = regions.find(r => r.id === draggedRegionId);
      if (targetRegion) {
        if (targetRegion.regionType === 'path' && resizeHandle.startsWith('node-') && targetRegion.pathPoints) {
          // Handle path node editing preview
          const nodeIndex = parseInt(resizeHandle.split('-')[1]);
          if (nodeIndex >= 0 && nodeIndex < targetRegion.pathPoints.length) {
            const newPathPoints = [...targetRegion.pathPoints];
            const oldPoint = targetRegion.pathPoints[nodeIndex];
            newPathPoints[nodeIndex] = { x: worldPos.x, y: worldPos.y };
            
            // Calculate delta for moving control points
            const deltaX = worldPos.x - oldPoint.x;
            const deltaY = worldPos.y - oldPoint.y;
            
            let newBezierControls = targetRegion.bezierControlPoints;
            
            // If smoothing is enabled (default), recalculate smoothing
            if (targetRegion.smoothing !== false) {
              newBezierControls = generateBezierControlPoints(newPathPoints);
            } 
            // If smoothing is disabled, move associated control points with the anchor
            else if (targetRegion.bezierControlPoints) {
              newBezierControls = [...targetRegion.bezierControlPoints];
              
              // Move control points associated with this anchor
              // For node i: update cp1 of segment i and cp2 of segment i-1
              if (nodeIndex < newBezierControls.length) {
                // Update cp1 of the segment starting at this node
                newBezierControls[nodeIndex] = {
                  ...newBezierControls[nodeIndex],
                  cp1: {
                    x: newBezierControls[nodeIndex].cp1.x + deltaX,
                    y: newBezierControls[nodeIndex].cp1.y + deltaY
                  }
                };
              }
              
              if (nodeIndex > 0 && nodeIndex - 1 < newBezierControls.length) {
                // Update cp2 of the segment ending at this node
                newBezierControls[nodeIndex - 1] = {
                  ...newBezierControls[nodeIndex - 1],
                  cp2: {
                    x: newBezierControls[nodeIndex - 1].cp2.x + deltaX,
                    y: newBezierControls[nodeIndex - 1].cp2.y + deltaY
                  }
                };
              }
            }
            
            // Update preview with new path points
            const newBounds = newBezierControls ? getBezierBounds(newPathPoints, newBezierControls) : getPolygonBounds(newPathPoints);
            setDragPreview({
              regionId: draggedRegionId,
              pathPoints: newPathPoints,
              bezierControlPoints: newBezierControls,
              x: newBounds.x,
              y: newBounds.y,
              width: newBounds.width,
              height: newBounds.height
            });
          }
        } else if (targetRegion.regionType === 'path' && resizeHandle.startsWith('cp-') && targetRegion.bezierControlPoints) {
          // Handle Bezier control point editing
          const parts = resizeHandle.split('-');
          const segmentIndex = parseInt(parts[1]);
          const isFirst = parts[2] === '1';
          
          if (segmentIndex >= 0 && segmentIndex < targetRegion.bezierControlPoints.length) {
            const newBezierControls = [...targetRegion.bezierControlPoints];
            if (isFirst) {
              newBezierControls[segmentIndex] = {
                ...newBezierControls[segmentIndex],
                cp1: { x: worldPos.x, y: worldPos.y }
              };
            } else {
              newBezierControls[segmentIndex] = {
                ...newBezierControls[segmentIndex],
                cp2: { x: worldPos.x, y: worldPos.y }
              };
            }
            
            // Update preview with new control points
            const newBounds = getBezierBounds(targetRegion.pathPoints!, newBezierControls);
            setDragPreview({
              regionId: draggedRegionId,
              pathPoints: targetRegion.pathPoints,
              bezierControlPoints: newBezierControls,
              x: newBounds.x,
              y: newBounds.y,
              width: newBounds.width,
              height: newBounds.height
            });
          }
        } else {
          // Handle rectangle region resizing preview
          const { x, y, width, height } = targetRegion;
          let updates: Partial<CanvasRegion> = {};
          
          switch (resizeHandle) {
            case 'nw':
              updates.x = worldPos.x;
              updates.y = worldPos.y;
              updates.width = width + (x - worldPos.x);
              updates.height = height + (y - worldPos.y);
              break;
            case 'ne':
              updates.y = worldPos.y;
              updates.width = worldPos.x - x;
              updates.height = height + (y - worldPos.y);
              break;
            case 'sw':
              updates.x = worldPos.x;
              updates.width = width + (x - worldPos.x);
              updates.height = worldPos.y - y;
              break;
            case 'se':
              updates.width = worldPos.x - x;
              updates.height = worldPos.y - y;
              break;
            case 'n':
              updates.y = worldPos.y;
              updates.height = height + (y - worldPos.y);
              break;
            case 'e':
              updates.width = worldPos.x - x;
              break;
            case 's':
              updates.height = worldPos.y - y;
              break;
            case 'w':
              updates.x = worldPos.x;
              updates.width = width + (x - worldPos.x);
              break;
          }
          
          // Ensure minimum size
          if (updates.width !== undefined) updates.width = Math.max(10, updates.width);
          if (updates.height !== undefined) updates.height = Math.max(10, updates.height);
          
          // Update preview state
          setDragPreview({
            regionId: draggedRegionId,
            x: updates.x ?? targetRegion.x,
            y: updates.y ?? targetRegion.y,
            width: updates.width ?? targetRegion.width,
            height: updates.height ?? targetRegion.height
          });
        }
      }
      
      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => redrawCanvas());
    } else {
      // Mouse hover - show grid highlights for potential token placement
      const worldPos = screenToWorld(mouseX, mouseY);
      
      // Only show highlights if Shift key is held (indicating token placement mode)
      if (e.shiftKey) {
        // Use default 1x1 size for new token placement, or get size from active token in toolbar
        // For now, use 1x1 as default
        updateGridHighlights(worldPos.x, worldPos.y, 1, 1);
      } else {
        // Clear highlights when not in placement mode
        setHighlightedGrids([]);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle freehand drawing completion
    if (isFreehandDrawing && pathDrawingMode === 'drawing' && pathDrawingType === 'freehand') {
      setIsFreehandDrawing(false);
      finishPathDrawing();
      return;
    }

    if (e.button === 2) { // Right click
      setIsPanning(false);
    } else if (e.button === 0) { // Left click
      // Handle token snapping on drag end
      if (isDraggingToken && draggedTokenId && !tokensMovedByRegion.includes(draggedTokenId)) {
        const token = tokens.find(t => t.id === draggedTokenId);
        if (token) {
          // Find local region at token position (our local regions in SimpleTabletop)
          const localRegion = regions.find(r => isPointInRegion(token.x, token.y, r));
          
          // Priority 1: Local region snapping (if region exists and has snapping enabled)
          if (localRegion && localRegion.gridSnapping && localRegion.gridType !== 'free') {
            // Convert local region to map region format for snapping
            let regionPoints: Array<{ x: number; y: number }>;
            
            if (localRegion.regionType === 'path' && localRegion.pathPoints) {
              regionPoints = localRegion.pathPoints;
            } else {
              // Rectangle region
              regionPoints = [
                { x: localRegion.x, y: localRegion.y },
                { x: localRegion.x + localRegion.width, y: localRegion.y },
                { x: localRegion.x + localRegion.width, y: localRegion.y + localRegion.height },
                { x: localRegion.x, y: localRegion.y + localRegion.height }
              ];
            }
            
            const regionForSnap = {
              map: {} as any, // Not used in snapping logic
              region: {
                gridType: localRegion.gridType,
                gridSize: localRegion.gridSize * localRegion.gridScale,
                points: regionPoints
              } as any
            };
            const snappedPos = snapToMapGrid(token.x, token.y, regionForSnap);
            updateTokenPosition(draggedTokenId, snappedPos.x, snappedPos.y);
          }
          // Priority 2: World space snapping (only if not in a region and world snapping is enabled)
          else if (isGridSnappingEnabled && !localRegion) {
            // World space uses the background grid (40 unit grid)
            const worldGridSize = 40;
            const snappedX = Math.round(token.x / worldGridSize) * worldGridSize;
            const snappedY = Math.round(token.y / worldGridSize) * worldGridSize;
            updateTokenPosition(draggedTokenId, snappedX, snappedY);
          }
          // No snapping applied if:
          // - Token is in a region but region snapping is disabled
          // - Token is in world space but world snapping is disabled
          // - Token is in a 'free' grid region
        }
      }
      
      setIsDraggingToken(false);
      setDraggedTokenId(null);
      setDragOffset({ x: 0, y: 0 });
      setDragStartPos({ x: 0, y: 0 });
      setDragPath([]);
      
      // Update highlights for all tokens after drag ends
      updateAllTokenHighlights();
      
      // Apply final positions and cleanup grouped dragging
      if (dragPreview && draggedRegionId) {
        const draggedRegion = regions.find(r => r.id === draggedRegionId);
        if (draggedRegion) {
          // Update region in store with recalculated bounds for grid
          if (draggedRegion.regionType === 'path' && dragPreview.pathPoints) {
            // Recalculate bounds to ensure grid is properly updated
            const finalBounds = dragPreview.bezierControlPoints 
              ? getBezierBounds(dragPreview.pathPoints, dragPreview.bezierControlPoints)
              : getPolygonBounds(dragPreview.pathPoints);
            
            updateRegion(draggedRegionId, {
              x: finalBounds.x,
              y: finalBounds.y,
              width: finalBounds.width,
              height: finalBounds.height,
              pathPoints: dragPreview.pathPoints,
              bezierControlPoints: dragPreview.bezierControlPoints,
              // Preserve rotation when dragging
              rotation: draggedRegion.rotation
            });
          } else {
            updateRegion(draggedRegionId, {
              x: dragPreview.x,
              y: dragPreview.y,
              width: dragPreview.width,
              height: dragPreview.height,
              // Preserve rotation when dragging
              rotation: draggedRegion.rotation
            });
          }
        }
      }
      
      // Apply final token positions to store (only once at the end)
      if (tempTokenPositions) {
        Object.entries(tempTokenPositions).forEach(([tokenId, position]) => {
          updateTokenPosition(tokenId, position.x, position.y);
        });
      }
      
      // Clear grouped tokens and temp positions
      setGroupedTokens([]);
      setTempTokenPositions(undefined);
    }
    
    // Handle rotation completion
    if (isRotatingRegion && draggedRegionId) {
      // Apply final rotation to region and tokens
      if (tempRegionRotation[draggedRegionId]) {
        const rotationDelta = tempRegionRotation[draggedRegionId];
        updateRegion(draggedRegionId, { 
          rotation: (regions.find(r => r.id === draggedRegionId)?.rotation || 0) + rotationDelta 
        });
      }
      
      // Clear rotation state
      setIsRotatingRegion(false);
      setTempRegionRotation({});
    }
    
    // Handle transformation end
    if (isTransforming && draggedRegionId && dragPreview) {
      // Apply the transformation to the actual region
      const targetRegion = regions.find(r => r.id === draggedRegionId);
      if (targetRegion) {
        // Recalculate final bounds to ensure grid alignment is correct
        let finalBounds = {
          x: dragPreview.x,
          y: dragPreview.y,
          width: dragPreview.width,
          height: dragPreview.height
        };
        
        if (dragPreview.pathPoints) {
          finalBounds = dragPreview.bezierControlPoints 
            ? getBezierBounds(dragPreview.pathPoints, dragPreview.bezierControlPoints)
            : getPolygonBounds(dragPreview.pathPoints);
        }
        
        const updates = {
          x: finalBounds.x,
          y: finalBounds.y,
          width: finalBounds.width,
          height: finalBounds.height,
          pathPoints: dragPreview.pathPoints,
          bezierControlPoints: dragPreview.bezierControlPoints,
          ...(dragPreview.pathPoints ? { regionType: 'path' as const } : {}),
          // Preserve all other existing properties
          rotation: targetRegion.rotation,
          gridScale: targetRegion.gridScale,
          gridSnapping: targetRegion.gridSnapping,
          gridVisible: targetRegion.gridVisible,
          backgroundImage: targetRegion.backgroundImage,
          backgroundRepeat: targetRegion.backgroundRepeat,
          backgroundOffsetX: targetRegion.backgroundOffsetX,
          backgroundOffsetY: targetRegion.backgroundOffsetY,
          rotationCenter: targetRegion.rotationCenter
        };
        
        updateRegion(draggedRegionId, updates);
      }
      
      // Clear transformation state
      setIsTransforming(false);
      setTransformHandle(null);
      setDragPreview(null);
      setDraggedRegionId(null);
      
      toast.success(`Region ${transformMode}d successfully`);
    }
    
    // Reset all region drag states (runs for normal drag, rotation, and transformation)
    if (isDraggingRegion || isRotatingRegion || isResizingRegion || isTransforming) {
      setIsDraggingRegion(false);
      setIsResizingRegion(false);
      setIsTransforming(false);
      setTransformHandle(null);
      setDraggedRegionId(null);
      setRegionDragOffset({ x: 0, y: 0 });
      setResizeHandle(null);
      setDragPreview(null);
      
      // Clear tokens moved by region tracking
      setTokensMovedByRegion([]);
      
      // Redraw canvas to clear ghost token and path
      redrawCanvas();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, transform.zoom * zoomFactor));
    
    // Zoom towards mouse position
    const zoomRatio = newZoom / transform.zoom;
    const newX = mouseX - (mouseX - transform.x) * zoomRatio;
    const newY = mouseY - (mouseY - transform.y) * zoomRatio;
    
    setTransform({
      x: newX,
      y: newY,
      zoom: newZoom
    });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasContextMenu(e);
  };

  // Token manipulation functions for FloatingMenu
  const handleTokenColorChange = (tokenId: string, color: string) => {
    updateTokenColor(tokenId, color);
    toast.success('Token color updated');
  };

  const handleCanvasUpdate = () => {
    // Canvas automatically redraws when tokens change
  };

  const addTokenToCanvas = async (imageUrl: string, x?: number, y?: number, gridWidth: number = 1, gridHeight: number = 1, color?: string) => {
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use provided coordinates or default to center of viewport
    let tokenX = x ?? (-transform.x / transform.zoom);
    let tokenY = y ?? (-transform.y / transform.zoom);
    
    // Apply grid snapping for new tokens based on world and region settings
    console.log('Adding new token at:', tokenX, tokenY);
    const activeRegion = getActiveRegionAt(tokenX, tokenY);
    console.log('Active region for new token:', activeRegion);
    
    // Find local region at token position for region-specific snapping
    const localRegion = regions.find(r => 
      isPointInRegion(tokenX, tokenY, r) && r.gridType !== 'free'
    );
    
    if (localRegion && localRegion.gridSnapping) {
      console.log('Applying local region snapping for new token, grid type:', localRegion.gridType);
      // Convert local region to map region format for snapping
      let regionPoints: Array<{ x: number; y: number }>;
      
      if (localRegion.regionType === 'path' && localRegion.pathPoints) {
        regionPoints = localRegion.pathPoints;
      } else {
        // Rectangle region
        regionPoints = [
          { x: localRegion.x, y: localRegion.y },
          { x: localRegion.x + localRegion.width, y: localRegion.y },
          { x: localRegion.x + localRegion.width, y: localRegion.y + localRegion.height },
          { x: localRegion.x, y: localRegion.y + localRegion.height }
        ];
      }
      const regionForSnap = {
        map: {} as any, // Not used in snapping logic
        region: {
          gridType: localRegion.gridType,
          gridSize: localRegion.gridSize * localRegion.gridScale,
          points: regionPoints
        } as any
      };
      const snappedPos = snapToMapGrid(tokenX, tokenY, regionForSnap);
      console.log('New token snapped to local region:', snappedPos);
      tokenX = snappedPos.x;
      tokenY = snappedPos.y;
    } else if (isGridSnappingEnabled && activeRegion && activeRegion.region.gridType !== 'none') {
      console.log('Applying world snapping for new token, grid type:', activeRegion.region.gridType);
      const snappedPos = snapToMapGrid(tokenX, tokenY, activeRegion);
      console.log('New token snapped position:', snappedPos);
      tokenX = snappedPos.x;
      tokenY = snappedPos.y;
    } else {
      console.log('No snapping for new token');
    }
    
    // Use provided color or generate a random one
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const tokenColor = color || colors[Math.floor(Math.random() * colors.length)];
    
    try {
      // Add to store
      addToken({
        id: tokenId,
        imageUrl,
        x: tokenX,
        y: tokenY,
        name: `Token ${tokenId.slice(-8)}`,
        gridWidth: gridWidth,
        gridHeight: gridHeight,
        label: `T${tokenId.slice(-4)}`,
        ownerId: currentPlayerId,
        color: tokenColor
      });

      toast.success('Token added to map');
    } catch (error) {
      console.error('Failed to add token:', error);
      toast.error('Failed to add token');
    }
  };

  return (
    <div className="w-full h-screen bg-surface flex flex-col relative">
      {/* Toolbar */}
      <Toolbar 
        sessionId={sessionId} 
        addTokenToCanvas={addTokenToCanvas}
      />
      
      {/* Map Manager Button */}
      <div className="absolute top-20 right-4 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowMapManager(true)}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Maps
        </Button>
      </div>

      {/* Add Region Button */}
      <div className="absolute top-32 right-4 z-10">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={addNewRegion}
            className="flex items-center gap-2"
          >
            <Square className="w-4 h-4" />
            Add Region
          </Button>
          <Button
            variant={pathDrawingMode === 'drawing' && pathDrawingType === 'polygon' ? "default" : "outline"}
            size="sm"
            onClick={() => pathDrawingMode === 'drawing' && pathDrawingType === 'polygon' ? finishPathDrawing() : startPathDrawing('polygon')}
            className="flex items-center gap-2"
            disabled={pathDrawingMode === 'drawing' && pathDrawingType === 'freehand'}
          >
            <Pen className="w-4 h-4" />
            {pathDrawingMode === 'drawing' && pathDrawingType === 'polygon' ? 'Finish Polygon' : 'Draw Polygon'}
          </Button>
          <Button
            variant={pathDrawingMode === 'drawing' && pathDrawingType === 'freehand' ? "default" : "outline"}
            size="sm"
            onClick={() => startPathDrawing('freehand')}
            className="flex items-center gap-2"
            disabled={pathDrawingMode === 'drawing' && pathDrawingType === 'polygon'}
          >
            <Pen className="w-4 h-4" />
            Draw Freehand
          </Button>
        </div>
      </div>

      {/* Grid Snapping Toggle */}
      <div className="absolute top-44 right-4 z-10">
        <Button
          variant={isGridSnappingEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => setIsGridSnappingEnabled(!isGridSnappingEnabled)}
          className="flex items-center gap-2"
        >
          <Grid3X3 className="w-4 h-4" />
          World Snap {isGridSnappingEnabled ? 'On' : 'Off'}
        </Button>
      </div>

      {/* Per-Region Snap Button (shows when region is selected) - REMOVED */}
      
      {/* Region Control Panel - only show in edit mode */}
      {renderingMode === 'edit' && selectedRegionId && (() => {
        const selectedRegion = regions.find(r => r.id === selectedRegionId);
        if (!selectedRegion) return null;
        
        return (
          <RegionControlPanel
            region={selectedRegion}
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onUpdateRegion={updateRegion}
            onDeleteRegion={deleteSelectedRegion}
            onClose={() => setSelectedRegionId(null)}
            onToggleSnapping={toggleRegionSnapping}
            onToggleGridVisibility={toggleRegionGridVisibility}
          />
        );
      })()}

      {/* Main Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
         <canvas
           ref={canvasRef}
           className="absolute inset-0 w-full h-full"
           style={{ 
             background: 'hsl(var(--canvas-background))',
             cursor: isPanning ? 'grabbing' : isDraggingToken ? 'move' : pathDrawingMode === 'drawing' ? 'crosshair' : 'auto'
           }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={() => pathDrawingMode === 'drawing' && pathDrawingType === 'polygon' && finishPathDrawing()}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
        />
      </div>

      {/* Floating Menu */}
      <FloatingMenu
        fabricCanvas={null}
        gridColor="#333"
        gridOpacity={80}
        onGridColorChange={() => {}}
        onGridOpacityChange={() => {}}
        onAddToken={addTokenToCanvas}
        onColorChange={handleTokenColorChange}
        onUpdateCanvas={handleCanvasUpdate}
      />

      {/* Token Context Manager */}
      <TokenContextManager
        fabricCanvas={null}
        onColorChange={handleTokenColorChange}
        onUpdateCanvas={handleCanvasUpdate}
      />

      {/* Map Manager Modal */}
      {showMapManager && (
        <MapManager onClose={() => setShowMapManager(false)} />
      )}

      {/* Region Background Modal */}
      <RegionBackgroundModal
        open={isRegionBackgroundModalOpen}
        onOpenChange={setIsRegionBackgroundModalOpen}
        region={selectedRegionForEdit}
        onUpdateRegion={updateRegion}
      />
    </div>
  );
};

export default SimpleTabletop;