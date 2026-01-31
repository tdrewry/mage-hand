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

import React, { useEffect, useRef, useState, useCallback } from "react";
import { MapManager } from "./MapManager";
import { TokenContextManager } from "./TokenContextManager";
import { CardManager } from "./CardManager";
import { CircularButtonBar } from "./CircularButtonBar";
import { VerticalToolbar } from "./VerticalToolbar";
import { InitiativePanel } from "./InitiativePanel";
import { BulkOperationsToolbar } from "./BulkOperationsToolbar";
import { MovementLockIndicator } from "./MovementLockIndicator";
import { useSessionStore, type Token } from "../stores/sessionStore";
import { useMapStore } from "../stores/mapStore";
import { useRegionStore, type CanvasRegion } from "../stores/regionStore";
import { useDungeonStore } from "../stores/dungeonStore";
import { useInitiativeStore } from "../stores/initiativeStore";
import { useCardStore } from "../stores/cardStore";
import { CardType } from "@/types/cardTypes";
import {
  renderDoors,
  renderAnnotations,
  renderTerrainFeatures,
  renderDungeonMapRegions,
  renderDungeonMapDoors,
} from "../lib/dungeonRenderer";
import { generateNegativeSpaceRegion } from "../lib/wallGeometry";
import {
  applyHatchingPattern,
  applyStipplingPattern,
  applyWoodGrainPattern,
  getVariedLineWidth,
  getRegionEdgePoints,
  EDGE_STYLES,
  type WallEdgeStyle,
} from "../lib/wallTexturePatterns";
import { snapToMapGrid } from "../lib/mapGridSystem";
import {
  HexCoordinate,
  HexLayout,
  POINTY_TOP,
  createHexLayout,
  pixelToHex,
  hexToPixel,
  hexRound,
  hexCorners,
} from "../lib/hexCoordinates";
import { isPointInPolygon, getPolygonBounds, isPointNearPolygonEdge, findNearestVertex } from "../utils/pathUtils";
import { simplifyPath } from "../utils/pathSimplification";
import { generateBezierControlPoints, getBezierBounds } from "../utils/bezierUtils";
import { computeIllumination, renderShadows, renderLightSources, notifyObstaclesChanged } from "../lib/lightSystem";
import { useLightStore } from "../stores/lightStore";
import { clearVisibilityCache, computeVisibilityFromSegments, visibilityPolygonToPath2D } from "../lib/visibilityEngine";
import { throttle } from "../lib/throttle";
import { computeTokenVisibilityPaper } from "../lib/fogOfWar";
import { addVisibleToExplored, computeFogMasks, cleanupFogGeometry, paperPathToPath2D, isPointInRevealedArea, isPointInVisibleArea } from "../lib/fogGeometry";
import { serializeFogGeometry, deserializeFogGeometry } from "../lib/fogSerializer";
import { renderFogLayers } from "../lib/fogRenderer";
import { useVisionProfileStore } from "../stores/visionProfileStore";
import { useRoleStore } from "../stores/roleStore";
import { useUiModeStore, type DmFogVisibility } from "../stores/uiModeStore";
import { getTokensForVisionCalculation } from "../lib/visionPermissions";
import { canControlToken, getTokenRelationship } from "../lib/rolePermissions";
import paper from "paper";
import { useFogStore } from "../stores/fogStore";
import { usePostProcessing } from "../hooks/usePostProcessing";
import { useRegionEdgeProcessing } from "../hooks/useRegionEdgeProcessing";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useUndoableActions } from "../hooks/useUndoableActions";
import { useTextureLoader } from "../hooks/useTextureLoader";
import { TextureDownloadProgress } from "./TextureDownloadProgress";
import { texturePatternCache } from "../lib/texturePatternCache";
import { isInViewport, ViewportBounds } from "../lib/renderOptimizer";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Settings, Grid3X3, Eye, Pen, Square, Settings2, X, Lightbulb, CloudFog } from "lucide-react";
import { RegionBackgroundModal } from "./modals/RegionBackgroundModal";
import { RoleSelectionModal } from "./modals/RoleSelectionModal";
import { RegionControlBar } from "./RegionControlBar";
import { SelectionModeIndicator } from "./SelectionModeIndicator";
import { Z_INDEX } from "../lib/zIndex";

export const SimpleTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // For UI elements above fog post-processing
  const [showMapManager, setShowMapManager] = useState(false);
  const [isRegionBackgroundModalOpen, setIsRegionBackgroundModalOpen] = useState(false);

  // Helper function to capture full region transform state for undo/redo
  const captureRegionTransformState = (region: CanvasRegion): Partial<CanvasRegion> => ({
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    rotation: region.rotation || 0,
    pathPoints: region.pathPoints ? [...region.pathPoints] : undefined,
    bezierControlPoints: region.bezierControlPoints ? [...region.bezierControlPoints] : undefined,
  });

  // Helper function to check if transform state has changed
  const hasTransformChanged = (
    initial: Partial<CanvasRegion>, 
    current: Partial<CanvasRegion>
  ): boolean => {
    return (
      initial.x !== current.x ||
      initial.y !== current.y ||
      initial.width !== current.width ||
      initial.height !== current.height ||
      initial.rotation !== current.rotation ||
      JSON.stringify(initial.pathPoints) !== JSON.stringify(current.pathPoints) ||
      JSON.stringify(initial.bezierControlPoints) !== JSON.stringify(current.bezierControlPoints)
    );
  };
  const [selectedRegionForEdit, setSelectedRegionForEdit] = useState<CanvasRegion | null>(null);
  const [showRegions, setShowRegions] = useState(true); // Debug toggle for testing wall-based light blocking
  const [gridColor, setGridColor] = useState("#333");
  const [gridOpacity, setGridOpacity] = useState(80);
  
  // Canvas dimensions for post-processing
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // Pan and zoom state - initialize from session store
  const selectedMapId = useMapStore((state) => state.selectedMapId);
  const viewportTransforms = useSessionStore((state) => state.viewportTransforms);
  const setViewportTransform = useSessionStore((state) => state.setViewportTransform);
  
  const [transform, setTransformState] = useState(() => {
    // Try to restore from session store on initial load
    if (selectedMapId && viewportTransforms[selectedMapId]) {
      return viewportTransforms[selectedMapId];
    }
    return { x: 0, y: 0, zoom: 1 };
  });
  
  // Wrapper that saves to session store
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const setTransform = useCallback((updater: React.SetStateAction<{ x: number; y: number; zoom: number }>) => {
    setTransformState(prev => {
      const newTransform = typeof updater === 'function' ? updater(prev) : updater;
      
      // Save to session store (throttled)
      if (selectedMapId) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          setViewportTransform(selectedMapId, newTransform);
        }, 300);
      }
      
      return newTransform;
    });
  }, [selectedMapId, setViewportTransform]);
  
  // Restore transform when map changes or on hydration
  const lastMapIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedMapId && viewportTransforms[selectedMapId]) {
      const persisted = viewportTransforms[selectedMapId];
      // Only restore if map changed or this is initial hydration with data
      if (selectedMapId !== lastMapIdRef.current || 
          (persisted.x !== 0 || persisted.y !== 0 || persisted.zoom !== 1)) {
        lastMapIdRef.current = selectedMapId;
        setTransformState(persisted);
      }
    }
  }, [selectedMapId, viewportTransforms]);
  
  // Keep a ref to track the latest transform for animation loops
  // This prevents stale closure issues when wheel zoom occurs during animation
  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Token interaction state
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [isDraggingToken, setIsDraggingToken] = useState(false);
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragPath, setDragPath] = useState<{ x: number; y: number }[]>([]);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  // Grid snapping toggle (default disabled)
  const [isGridSnappingEnabled, setIsGridSnappingEnabled] = useState(false);

  // Selected annotation for flavor text display
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Active region for Region Controls card
  const [activeRegionControlId, setActiveRegionControlId] = useState<string | null>(null);

  // Wall decoration cache to avoid regenerating on every pan/zoom
  const wallDecorationCacheRef = useRef<{
    cacheKey: string;
    canvas: HTMLCanvasElement;
    shadowCanvas: HTMLCanvasElement; // Separate canvas for shadows
    wallGeometry: any;
    bounds: { x: number; y: number; width: number; height: number };
    shadowBounds: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // Store wall geometry separately for fog computation
  const wallGeometryRef = useRef<any>(null);

  // Grid highlighting state for token movement (supports both hex and square grids)
  const [highlightedGrids, setHighlightedGrids] = useState<
    {
      regionId: string;
      hexes: { hexX: number; hexY: number; radius: number }[];
      squares: { gridX: number; gridY: number; size: number }[];
    }[]
  >([]);

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
    getSelectedRegions,
  } = useRegionStore();

  // Dungeon features store
  const {
    doors,
    annotations,
    terrainFeatures,
    renderingMode,
    setRenderingMode,
    watabouStyle,
    wallEdgeStyle,
    wallThickness,
    textureScale,
  } = useDungeonStore();

  // Light system store
  const { lights, addLight, updateLight, removeLight, globalAmbientLight, shadowIntensity } = useLightStore();

  // Light placement mode
  const [lightPlacementMode, setLightPlacementMode] = useState(false);

  // Fog of war store
  const {
    enabled: fogEnabled,
    revealAll: fogRevealAll,
    visionRange: fogVisionRange,
    fogOpacity,
    exploredOpacity,
    serializedExploredAreas,
    setSerializedExploredAreas,
    setEnabled: setFogEnabled,
    setRevealAll: setFogRevealAll,
    effectSettings,
    realtimeVisionDuringDrag,
    realtimeVisionThrottleMs,
  } = useFogStore();
  
  // Post-processing hook for fog effects
  const { applyEffects: applyPostProcessingEffects, isReady: isPostProcessingReady } = usePostProcessing({
    containerRef: canvasContainerRef,
    enabled: renderingMode === 'play' && fogEnabled && effectSettings.postProcessingEnabled,
    width: canvasDimensions.width,
    height: canvasDimensions.height,
  });

  // Region edge hatching post-processing hook
  const { applyEffects: applyRegionEdgeEffects, isReady: isRegionEdgeReady } = useRegionEdgeProcessing({
    containerRef: canvasContainerRef,
    enabled: showRegions,
    width: canvasDimensions.width,
    height: canvasDimensions.height,
  });

  // Vision profiles store
  const { getProfile } = useVisionProfileStore();

  // Role store
  const { roles } = useRoleStore();
  
  // Enable undo/redo with keyboard shortcuts
  useUndoRedo(true);
  
  // Undoable actions
  const { moveTokenUndoable, moveRegionUndoable, transformRegionUndoable } = useUndoableActions();
  
  // Texture loader for persistent region backgrounds
  useTextureLoader();

  // Track explored areas (accumulated visibility) using paper.js
  const exploredAreaRef = useRef<paper.CompoundPath | null>(null);
  const currentVisibilityRef = useRef<paper.Path | null>(null); // Current visibility for interaction checks
  const stableVisibilityRef = useRef<paper.Path | null>(null); // Snapshot of visibility for stable checks during drag
  const fogScopeRef = useRef<paper.PaperScope | null>(null);
  
  // Real-time vision preview during drag
  const dragPreviewVisibilityRef = useRef<Path2D | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; y: number; range: number } | null>(null);

  // Pre-computed fog masks (updated outside render loop)
  const fogMasksRef = useRef<{
    unexploredMask: Path2D;
    exploredOnlyMask: Path2D;
    visibleMask: Path2D;
  } | null>(null);

  // Store individual token visibility data for rendering
  const tokenVisibilityDataRef = useRef<
    Array<{
      position: { x: number; y: number };
      visionRange: number;
      visibilityPath: Path2D;
      isLightSource?: boolean; // Light sources get two-zone gradient in post-processing
      tokenIllumination?: Token['illuminationSources']; // Token's custom illumination settings
    }>
  >([]);

  // Cache individual token visibility shapes to avoid recomputing unchanged tokens
  const tokenVisibilityCacheRef = useRef<
    Map<
      string,
      {
        position: { x: number; y: number };
        visionPath: any; // paper.js Path
      }
    >
  >(new Map());

  // Track previous token positions to detect changes
  const prevTokenPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Performance optimization: Cache for token drawing to reduce redundant renders
  const tokenDrawCache = useRef<Map<string, { lastDrawn: number; data: any }>>(new Map());

  // Track if fog needs recomputation
  const [fogNeedsUpdate, setFogNeedsUpdate] = useState(false);
  
  // Counter to force re-render when images load
  const [imageLoadCounter, setImageLoadCounter] = useState(0);

  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
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
  const [pathDrawingMode, setPathDrawingMode] = useState<"none" | "drawing" | "editing">("none");
  const [pathDrawingType, setPathDrawingType] = useState<"polygon" | "freehand">("polygon");
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [editingVertexIndex, setEditingVertexIndex] = useState<number | null>(null);
  const [editingControlPointIndex, setEditingControlPointIndex] = useState<{
    segmentIndex: number;
    isFirst: boolean;
  } | null>(null);
  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);
  const [lastFreehandPoint, setLastFreehandPoint] = useState<{ x: number; y: number } | null>(null);

  // Track tokens moved by region drag to prevent individual snapping
  const [tokensMovedByRegion, setTokensMovedByRegion] = useState<string[]>([]);

  // Grouped dragging state - simpler approach without Paper.js
  const [groupedTokens, setGroupedTokens] = useState<{ tokenId: string; startX: number; startY: number }[]>([]);

  // Temporary token positions during region drag to avoid store updates
  const [tempTokenPositions, setTempTokenPositions] = useState<{ [tokenId: string]: { x: number; y: number } }>();

  // Rotation state
  const [isRotatingRegion, setIsRotatingRegion] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);
  const [tempRegionRotation, setTempRegionRotation] = useState<{ [regionId: string]: number }>({});
  
  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const [marqueeMode, setMarqueeMode] = useState<'regions' | 'tokens' | 'both'>('both');
  
  // Undo/Redo: Track initial states before transformations
  const [initialTokenState, setInitialTokenState] = useState<{ id: string; x: number; y: number } | null>(null);
  const [initialRegionState, setInitialRegionState] = useState<Partial<CanvasRegion> | null>(null);
  const [transformingRegionId, setTransformingRegionId] = useState<string | null>(null);

  const {
    sessionId,
    tokens,
    addToken,
    updateTokenPosition,
    updateTokenLabel,
    updateTokenColor,
    removeToken,
    currentPlayerId,
    players,
  } = useSessionStore();

  // Check if current user is a DM (bypasses fog visibility restrictions)
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isDM = currentPlayer?.roleIds?.includes('dm') || false;
  
  // Get DM fog visibility preference
  const { dmFogVisibility } = useUiModeStore();

  const { maps, getVisibleMaps, getActiveRegionAt } = useMapStore();

  const { isInCombat, currentTurnIndex, initiativeOrder, restrictMovement } = useInitiativeStore();

  const registerCard = useCardStore((state) => state.registerCard);
  const getCardByType = useCardStore((state) => state.getCardByType);
  const setVisibility = useCardStore((state) => state.setVisibility);
  const bringToFront = useCardStore((state) => state.bringToFront);
  const cards = useCardStore((state) => state.cards);

  // Register MENU, TOOLS, and MAP cards on mount (only once)
  useEffect(() => {
    // Small delay to ensure layout is loaded first
    const timer = setTimeout(() => {
      // Register MENU card if it doesn't exist
      if (!getCardByType(CardType.MENU)) {
        registerCard({
          type: CardType.MENU,
          title: "Menu",
          defaultPosition: { x: 20, y: 20 },
          defaultSize: { width: 280, height: 500 },
          minSize: { width: 250, height: 400 },
          isResizable: true,
          isClosable: false,
          defaultVisible: true,
        });
      }

      // TOOLS card removed - replaced by VerticalToolbar component
      // MAP card removed - deprecated Player View panel
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Cards now managed independently - no automatic visibility control needed

  // Global mouseup listener to ensure drag states are always reset
  useEffect(() => {
    if (isDraggingToken || isDraggingRegion || isPanning) {
      const handleGlobalMouseUp = () => {
        // Reset all drag states
        if (isDraggingToken) {
          setIsDraggingToken(false);
          setDraggedTokenId(null);
          setDragOffset({ x: 0, y: 0 });
          setDragStartPos({ x: 0, y: 0 });
          setDragPath([]);
          setGroupedTokens([]);
          setTempTokenPositions(undefined);
          // Clear real-time vision preview
          dragPreviewVisibilityRef.current = null;
          setDragPreviewPosition(null);
        }
        if (isDraggingRegion) {
          setIsDraggingRegion(false);
          setDraggedRegionId(null);
          setDragPreview(null);
        }
        if (isPanning) {
          setIsPanning(false);
        }
        if (isRotatingRegion) {
          setIsRotatingRegion(false);
          setTempRegionRotation({});
        }
      };

      window.addEventListener("mouseup", handleGlobalMouseUp);
      return () => {
        window.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDraggingToken, isDraggingRegion, isPanning, isRotatingRegion]);

  // Update highlights whenever tokens or regions change (but not during drag - handled separately)
  useEffect(() => {
    // Skip during drag - updateGridHighlights handles the dragged token specifically
    if (isDraggingToken || isDraggingRegion) return;
    updateAllTokenHighlights();
  }, [tokens, regions, isDraggingToken, isDraggingRegion]); // Re-run when tokens positions change or regions change

  // Listen for center on token events
  useEffect(() => {
    const handleCenterOnToken = (e: CustomEvent) => {
      const { tokenId } = e.detail;
      const token = tokens.find((t) => t.id === tokenId);
      if (token && canvasRef.current) {
        const canvas = canvasRef.current;
        // Center the viewport on the token
        setTransform({
          x: canvas.width / 2 - token.x * transform.zoom,
          y: canvas.height / 2 - token.y * transform.zoom,
          zoom: transform.zoom,
        });
      }
    };

    window.addEventListener("centerOnToken", handleCenterOnToken as EventListener);
    return () => {
      window.removeEventListener("centerOnToken", handleCenterOnToken as EventListener);
    };
  }, [tokens, transform.zoom]);

  // Keyboard zoom with + and - keys, and panning with arrow keys/WASD
  useEffect(() => {
    const PAN_SPEED = 50; // Pixels to pan per keypress
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // + or = (with or without shift) to zoom in
      if (e.key === '+' || e.key === '=' || (e.key === '=' && e.shiftKey)) {
        e.preventDefault();
        const zoomFactor = 1.15;
        const newZoom = Math.max(0.1, Math.min(5, transform.zoom * zoomFactor));
        
        // Zoom towards center of viewport
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const zoomRatio = newZoom / transform.zoom;
        
        setTransform({
          x: centerX - (centerX - transform.x) * zoomRatio,
          y: centerY - (centerY - transform.y) * zoomRatio,
          zoom: newZoom,
        });
      }
      // - or _ to zoom out
      else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const zoomFactor = 0.87;
        const newZoom = Math.max(0.1, Math.min(5, transform.zoom * zoomFactor));
        
        // Zoom towards center of viewport
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const zoomRatio = newZoom / transform.zoom;
        
        setTransform({
          x: centerX - (centerX - transform.x) * zoomRatio,
          y: centerY - (centerY - transform.y) * zoomRatio,
          zoom: newZoom,
        });
      }
      // Arrow keys and WASD for panning
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setTransform(prev => ({ ...prev, y: prev.y + PAN_SPEED }));
      }
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setTransform(prev => ({ ...prev, y: prev.y - PAN_SPEED }));
      }
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setTransform(prev => ({ ...prev, x: prev.x + PAN_SPEED }));
      }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setTransform(prev => ({ ...prev, x: prev.x - PAN_SPEED }));
      }
      // Ctrl+A to select all regions (Edit mode only)
      else if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey) && renderingMode === 'edit') {
        e.preventDefault();
        if (regions.length > 0) {
          regions.forEach(region => selectRegion(region.id));
          setSelectedRegionIds(regions.map(r => r.id));
          setSelectedTokenIds([]); // Deselect tokens
          redrawCanvas();
          toast.success(`Selected all ${regions.length} region(s)`);
        }
      }
      // Escape to clear selection
      else if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedRegionIds.length > 0 || selectedTokenIds.length > 0) {
          selectedRegionIds.forEach(id => deselectRegion(id));
          setSelectedRegionIds([]);
          setSelectedTokenIds([]);
          clearSelection();
          redrawCanvas();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transform]);

  // Fit to View - calculates bounds of all content and zooms to fit
  const handleFitToView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate bounding box of all content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    // Include tokens with their illumination radius
    tokens.forEach(token => {
      hasContent = true;
      const tokenCenterX = token.x;
      const tokenCenterY = token.y;
      
      // Get illumination radius (use the largest one if multiple sources)
      let maxRadius = 0;
      if (token.illuminationSources && token.illuminationSources.length > 0) {
        token.illuminationSources.forEach(source => {
          if (source.enabled && source.range > maxRadius) {
            maxRadius = source.range;
          }
        });
      }
      // Also consider legacy visionRange
      if (token.visionRange && token.visionRange > maxRadius) {
        maxRadius = token.visionRange;
      }
      // Fallback to fog vision range
      if (maxRadius === 0 && token.hasVision) {
        maxRadius = fogVisionRange * 40; // Convert grid units to pixels
      }
      
      // Expand bounds by token size and illumination radius
      const tokenRadius = Math.max(token.gridWidth, token.gridHeight) * 20; // Approximate token size
      const totalRadius = tokenRadius + maxRadius;
      
      minX = Math.min(minX, tokenCenterX - totalRadius);
      minY = Math.min(minY, tokenCenterY - totalRadius);
      maxX = Math.max(maxX, tokenCenterX + totalRadius);
      maxY = Math.max(maxY, tokenCenterY + totalRadius);
    });

    // Include explored fog areas if available
    if (exploredAreaRef.current) {
      const bounds = exploredAreaRef.current.bounds;
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        hasContent = true;
        minX = Math.min(minX, bounds.left);
        minY = Math.min(minY, bounds.top);
        maxX = Math.max(maxX, bounds.right);
        maxY = Math.max(maxY, bounds.bottom);
      }
    }

    // Include visible regions
    regions.forEach(region => {
      hasContent = true;
      
      const regionX = region.x;
      const regionY = region.y;
      const regionW = region.width;
      const regionH = region.height;
      
      minX = Math.min(minX, regionX);
      minY = Math.min(minY, regionY);
      maxX = Math.max(maxX, regionX + regionW);
      maxY = Math.max(maxY, regionY + regionH);
    });

    if (!hasContent) {
      toast.info('No content to fit');
      return;
    }

    // Add padding (10% on each side)
    const padding = 0.1;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    minX -= contentWidth * padding;
    maxX += contentWidth * padding;
    minY -= contentHeight * padding;
    maxY += contentHeight * padding;

    const paddedWidth = maxX - minX;
    const paddedHeight = maxY - minY;

    // Calculate zoom to fit
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const zoomX = canvasWidth / paddedWidth;
    const zoomY = canvasHeight / paddedHeight;
    const newZoom = Math.min(zoomX, zoomY, 5); // Cap at max zoom of 5

    // Calculate center of content
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // Set transform to center on content at calculated zoom
    setTransform({
      x: canvasWidth / 2 - contentCenterX * newZoom,
      y: canvasHeight / 2 - contentCenterY * newZoom,
      zoom: Math.max(0.1, newZoom),
    });

    toast.success(`Fit to view (${Math.round(newZoom * 100)}%)`);
  }, [tokens, regions, fogVisionRange, setTransform]);

  // Canvas rendering now auto-updates via dependencies - no manual event listening needed

  // Initialize paper.js scope and load explored areas
  useEffect(() => {
    // Initialize paper.js scope
    if (!fogScopeRef.current) {
      fogScopeRef.current = new paper.PaperScope();
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      fogScopeRef.current.setup(canvas);
    }

    // Load serialized explored areas
    if (fogEnabled && serializedExploredAreas) {
      const scope = fogScopeRef.current;
      if (scope) {
        const deserialized = deserializeFogGeometry(serializedExploredAreas, scope);
        if (deserialized) {
          exploredAreaRef.current = deserialized;
        }
      }
    }

    return () => {
      // Cleanup on unmount
      cleanupFogGeometry();
      fogScopeRef.current = null;
    };
  }, []);

  // Clear explored areas when fog is disabled
  useEffect(() => {
    if (!fogEnabled) {
      exploredAreaRef.current = null;
      currentVisibilityRef.current = null;
      fogMasksRef.current = null;
      setSerializedExploredAreas("");
    }
  }, [fogEnabled, setSerializedExploredAreas]);

  // Redraw canvas when synced game objects change
  useEffect(() => {
    redrawCanvas();
  }, [tokens]);

  useEffect(() => {
    redrawCanvas();
  }, [regions]);

  useEffect(() => {
    redrawCanvas();
  }, [lights]);

  useEffect(() => {
    redrawCanvas();
  }, [maps]);

  useEffect(() => {
    redrawCanvas();
  }, [serializedExploredAreas]);

  // Compute fog of war masks when tokens move or fog settings change
  // Skip during dragging to prevent stuttering
  useEffect(() => {
    if (!fogEnabled || fogRevealAll || !wallGeometryRef.current || !fogScopeRef.current) {
      fogMasksRef.current = null;
      return;
    }

    // Skip fog computation while dragging tokens to prevent stuttering
    if (isDraggingToken) {
      return;
    }

    // Force fog computation when switching to play mode
    const isPlayMode = renderingMode === "play";

    const wallGeometry = wallGeometryRef.current;

    // Debounce fog computation to avoid excessive updates
    const timeoutId = setTimeout(() => {
      // Compute visibility asynchronously
      const computeFog = async () => {
        try {
          const paper = await import("paper");
          if (!fogScopeRef.current) return;
          fogScopeRef.current.activate();

          // Get current player to filter tokens by role permissions
          const currentPlayer = players.find((p) => p.id === currentPlayerId);
          if (!currentPlayer || !wallGeometry) return;

          // Filter tokens based on role permissions and hostility
          // This replaces simple ownership-based filtering with role-based logic
          const tokensForVision = getTokensForVisionCalculation(
            tokens,
            currentPlayer,
            roles,
            wallGeometry.wallSegments,
          );

          // Only consider tokens with vision enabled
          const tokensWithVision = tokensForVision.filter((t) => t.hasVision !== false);
          const movedTokens: typeof tokens = [];
          const currentTokenIds = new Set(tokensWithVision.map((t) => t.id));

          // Track tokens whose vision state changed
          let visionStateChanged = false;

          tokensWithVision.forEach((token) => {
            const prevPos = prevTokenPositionsRef.current.get(token.id);
            if (!prevPos || prevPos.x !== token.x || prevPos.y !== token.y) {
              movedTokens.push(token);
            }
          });

          // Remove cached visibility for tokens that no longer exist OR lost vision
          const cachedIds = Array.from(tokenVisibilityCacheRef.current.keys());
          cachedIds.forEach((id) => {
            if (!currentTokenIds.has(id)) {
              const cached = tokenVisibilityCacheRef.current.get(id);
              if (cached?.visionPath?.remove) cached.visionPath.remove();
              tokenVisibilityCacheRef.current.delete(id);
              prevTokenPositionsRef.current.delete(id);
              visionStateChanged = true; // Vision was disabled for this token
            }
          });

          // If no tokens moved and vision state didn't change, skip computation
          // Unless we're in play mode and don't have fog masks yet (initial render)
          if (
            movedTokens.length === 0 &&
            !visionStateChanged &&
            tokenVisibilityCacheRef.current.size === tokensWithVision.length &&
            fogMasksRef.current !== null
          ) {
            return;
          }

          // Compute visibility only for moved tokens
          for (const token of movedTokens) {
            // Find token's region to get grid size
            const tokenRegion = regions.find(
              (r) => token.x >= r.x && token.x <= r.x + r.width && token.y >= r.y && token.y <= r.y + r.height,
            );
            const gridSize = tokenRegion?.gridSize || 40;
            // Priority: per-token illumination range > token visionRange > global fogVisionRange
            // illuminationSources[0].range is in grid units
            const perTokenIlluminationRange = token.illuminationSources?.[0]?.range;
            const tokenVisionRange = perTokenIlluminationRange ?? token.visionRange ?? fogVisionRange;
            const visionRangePixels = tokenVisionRange * gridSize;

            // Remove old cached vision for this token
            const oldCached = tokenVisibilityCacheRef.current.get(token.id);
            if (oldCached?.visionPath?.remove) oldCached.visionPath.remove();

            // Compute new visibility for this token
            const tokenVision = await computeTokenVisibilityPaper(
              [token],
              wallGeometry.wallSegments,
              wallGeometry,
              visionRangePixels,
            );

            // Cache the new vision path
            tokenVisibilityCacheRef.current.set(token.id, {
              position: { x: token.x, y: token.y },
              visionPath: tokenVision,
            });

            // Update previous position
            prevTokenPositionsRef.current.set(token.id, { x: token.x, y: token.y });
          }

          // Merge all cached token visions
          let combinedVisibility: any = null;
          tokenVisibilityCacheRef.current.forEach((cached) => {
            if (!cached.visionPath) return;

            if (!combinedVisibility) {
              combinedVisibility = cached.visionPath.clone({ insert: false });
            } else {
              const united = combinedVisibility.unite(cached.visionPath, { insert: false });
              if (combinedVisibility.remove) combinedVisibility.remove();
              combinedVisibility = united;
            }
          });

          if (!combinedVisibility) return;

          // Store current visibility for interaction checks (clone before merging)
          if (currentVisibilityRef.current && currentVisibilityRef.current.remove) {
            currentVisibilityRef.current.remove();
          }
          currentVisibilityRef.current = combinedVisibility.clone({ insert: false }) as paper.Path;

          // Merge into explored areas
          exploredAreaRef.current = addVisibleToExplored(exploredAreaRef.current, combinedVisibility);

          // Clean up combined visibility
          if (combinedVisibility.remove) combinedVisibility.remove();

          // Serialize for persistence
          const serialized = serializeFogGeometry(exploredAreaRef.current);
          if (serialized) {
            setSerializedExploredAreas(serialized);
          }

          // Compute masks
          const canvas = canvasRef.current;
          if (!canvas) return;

          const worldBounds = {
            x: -transform.x / transform.zoom - 5000,
            y: -transform.y / transform.zoom - 5000,
            width: canvas.width / transform.zoom + 10000,
            height: canvas.height / transform.zoom + 10000,
          };

          // Recompute combined visibility for mask generation
          let visibilityForMask: any = null;
          tokenVisibilityCacheRef.current.forEach((cached) => {
            if (!cached.visionPath) return;

            if (!visibilityForMask) {
              visibilityForMask = cached.visionPath.clone({ insert: false });
            } else {
              const united = visibilityForMask.unite(cached.visionPath, { insert: false });
              if (visibilityForMask.remove) visibilityForMask.remove();
              visibilityForMask = united;
            }
          });

          if (!visibilityForMask) return;

          const masks = computeFogMasks(exploredAreaRef.current, visibilityForMask, worldBounds);

          // Store individual token visibility data for rendering
          const tokenVisData: Array<{
            position: { x: number; y: number };
            visionRange: number;
            visibilityPath: Path2D;
            isLightSource?: boolean;
            tokenIllumination?: typeof tokens[0]['illuminationSources'];
          }> = [];

          tokenVisibilityCacheRef.current.forEach((cached, tokenId) => {
            if (!cached.visionPath) return;

            // Find the token to get its vision range and gradient settings
            const token = tokens.find((t) => t.id === tokenId);
            if (!token) return;

            const tokenRegion = regions.find(
              (r) => token.x >= r.x && token.x <= r.x + r.width && token.y >= r.y && token.y <= r.y + r.height,
            );
            const gridSize = tokenRegion?.gridSize || 40;
            // Priority: per-token illumination range > token visionRange > global fogVisionRange
            const perTokenIlluminationRange = token.illuminationSources?.[0]?.range;
            const tokenVisionRange = perTokenIlluminationRange ?? token.visionRange ?? fogVisionRange;
            const visionRangePixels = tokenVisionRange * gridSize;

            // Convert paper.js path to Path2D using the existing helper
            const path2D = paperPathToPath2D(cached.visionPath);

            tokenVisData.push({
              position: cached.position,
              visionRange: visionRangePixels,
              visibilityPath: path2D,
              isLightSource: false, // Tokens are not light sources
              tokenIllumination: token.illuminationSources,
            });
          });

          // Add enabled light sources to fog revelation with two-zone gradients
          const enabledLights = lights.filter((l) => l.enabled);
          for (const light of enabledLights) {
            // Compute visibility for this light source using walls
            // Pass a mock token-like object with required properties
            const lightVision = await computeTokenVisibilityPaper(
              [{ x: light.position.x, y: light.position.y, id: light.id, gridWidth: 1, gridHeight: 1 }],
              wallGeometry.wallSegments,
              wallGeometry,
              light.radius,
            );

            if (lightVision) {
              const lightPath2D = paperPathToPath2D(lightVision);
              
              // Light sources get two-zone gradient rendering in post-processing
              // using the lightFalloff setting
              tokenVisData.push({
                position: light.position,
                visionRange: light.radius,
                visibilityPath: lightPath2D,
                isLightSource: true, // Mark as light source for gradient rendering
              });
              
              // Clean up paper.js path
              if (lightVision.remove) lightVision.remove();
            }
          }

          tokenVisibilityDataRef.current = tokenVisData;

          // Clean up
          if (visibilityForMask.remove) visibilityForMask.remove();

          // Store masks for rendering
          fogMasksRef.current = masks;

          // Trigger redraw only once
          requestAnimationFrame(() => {
            redrawCanvas();
          });
        } catch (error) {
          console.error("Fog computation error:", error);
        }
      };

      computeFog();
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [
    tokens,
    lights,
    fogEnabled,
    fogRevealAll,
    fogVisionRange,
    isDraggingToken,
    setSerializedExploredAreas,
    renderingMode,
    regions,
    transform.x,
    transform.y,
    transform.zoom,
    effectSettings.lightFalloff,
    exploredOpacity,
  ]);

  // Helper function to convert screen coordinates to world coordinates
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - transform.x) / transform.zoom,
      y: (screenY - transform.y) / transform.zoom,
    };
  };

  // Helper function to convert world coordinates to screen coordinates
  const worldToScreen = (worldX: number, worldY: number) => {
    return {
      x: worldX * transform.zoom + transform.x,
      y: worldY * transform.zoom + transform.y,
    };
  };

  // Hit test for tokens
  const getTokenAtPosition = (worldX: number, worldY: number): any | null => {
    const baseTokenSize = 40; // Base size for 1x1 token
    const isPlayMode = renderingMode === 'play';

    // Check tokens in reverse order (top to bottom)
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];
      // Calculate actual token size based on grid dimensions
      const tokenWidth = (token.gridWidth || 1) * baseTokenSize;
      const tokenHeight = (token.gridHeight || 1) * baseTokenSize;
      const baseRadius = Math.max(tokenWidth, tokenHeight) / 2;

      // Add extra tolerance for borders, selection highlights, and visual size
      // Scale tolerance inversely with zoom: more forgiving when zoomed out, tighter when zoomed in
      // At zoom=1: tolerance = 8px
      // At zoom=0.5 (zoomed out): tolerance = 16px (easier to click small tokens)
      // At zoom=2 (zoomed in): tolerance = 4px (tighter precision for large tokens)
      const baseBorderTolerance = 8;
      const zoomAdjustedTolerance = baseBorderTolerance / transform.zoom;
      const maxRadius = baseRadius + zoomAdjustedTolerance;

      const distance = Math.sqrt(Math.pow(worldX - token.x, 2) + Math.pow(worldY - token.y, 2));

      if (distance <= maxRadius) {
        // In play mode with fog enabled, only allow interaction with tokens in revealed areas
        // DM role can bypass based on dmFogVisibility setting
        if (isPlayMode && fogEnabled && !fogRevealAll) {
          const tokenPoint = { x: token.x, y: token.y };
          const isRevealed = isPointInRevealedArea(
            tokenPoint,
            exploredAreaRef.current,
            currentVisibilityRef.current
          );
          
          if (!isRevealed) {
            // Token is in fog - check if DM can interact based on visibility setting
            if (!isDM || dmFogVisibility === 'hidden') {
              continue; // Skip - either not DM, or DM wants hidden mode
            }
            // DM with 'semi-transparent' or 'full' mode can interact
          }
        }
        
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
  const calculateTokenHexOccupancy = (
    tokenX: number,
    tokenY: number,
    region: CanvasRegion,
    gridWidth: number = 1,
    gridHeight: number = 1,
  ): { hexX: number; hexY: number; radius: number }[] => {
    if (region.gridType !== "hex") return [];

    const hexRadius = region.gridSize / 2;
    const hexWidth = hexRadius * 2;
    const hexHeight = hexRadius * Math.sqrt(3);

    // Calculate number of hexes that fit (same as drawHexGrid)
    const cols = Math.ceil(region.width / (hexWidth * 0.75)) + 1;
    const rows = Math.ceil(region.height / hexHeight) + 1;

    // Starting position aligned to region (same as drawHexGrid)
    const startX = region.x;
    const startY = region.y;

    let centerHex: { hexX: number; hexY: number; radius: number; col: number; row: number } | null = null;
    let closestDistance = Infinity;

    // Find the closest hex center to the token position
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate hex center position (same formula as drawHexGrid)
        const hexX = startX + col * (hexWidth * 0.75) + hexRadius;
        const hexY = startY + row * hexHeight + hexRadius + (col % 2) * (hexHeight / 2);

        // Only check hexes within or near region bounds
        if (
          hexX >= region.x - hexRadius &&
          hexX <= region.x + region.width + hexRadius &&
          hexY >= region.y - hexRadius &&
          hexY <= region.y + region.height + hexRadius
        ) {
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

    const occupiedHexes: { hexX: number; hexY: number; radius: number }[] = [];

    // D&D hex patterns based on creature size
    if (gridWidth === 1 && gridHeight === 1) {
      // Small/Medium (1x1): Single hex
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });
    } else if (gridWidth === 2 && gridHeight === 2) {
      // Large (2x2): EXACTLY 3 hexes total according to D&D rules
      console.log("Calculating 2x2 hex pattern - should be exactly 3 hexes");

      // Center hex
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });

      // For a Large creature, add exactly 2 specific adjacent hexes
      // Pattern should be center + 2 adjacent forming a triangle
      const largeCreatureOffsets = [
        [1, 0], // Right neighbor
        [-1, 1], // Bottom-left neighbor (creates proper triangle)
      ];

      largeCreatureOffsets.forEach(([dCol, dRow]) => {
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
          console.log(`Added Large creature hex at col:${neighborCol}, row:${neighborRow}`);
        }
      });

      console.log(`Large creature total hexes: ${occupiedHexes.length} (should be 3)`);
    } else if (gridWidth === 3 && gridHeight === 3) {
      // Huge (3x3): Center + all 6 neighbors (7 total)
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });

      // All 6 hex neighbors
      const allNeighbors = [
        [1, 0],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [0, -1],
        [1, -1],
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
      // Gargantuan (4x4): Center + 6 neighbors + 6 more hexes (19 total in flower pattern)
      occupiedHexes.push({ hexX: centerHex.hexX, hexY: centerHex.hexY, radius: hexRadius });

      // First ring: 6 neighbors
      const firstRing = [
        [1, 0],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [0, -1],
        [1, -1],
      ];
      // Second ring: additional hexes for gargantuan
      const secondRing = [
        [2, 0],
        [1, 1],
        [-1, 2],
        [-2, 1],
        [-1, -1],
        [1, -2],
        [2, -1],
        [0, 2],
        [-2, 0],
        [0, -2],
        [1, 2],
        [-1, -2],
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

  // Calculate which square grid cells a token occupies
  const calculateTokenSquareOccupancy = (
    tokenX: number,
    tokenY: number,
    region: CanvasRegion,
    gridWidth: number = 1,
    gridHeight: number = 1,
  ): { gridX: number; gridY: number; size: number }[] => {
    if (region.gridType !== "square") return [];

    const gridSize = region.gridSize;
    const occupiedSquares: { gridX: number; gridY: number; size: number }[] = [];

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

  // Update highlighted grids based on token position and size
  const updateGridHighlights = (tokenX: number, tokenY: number, gridWidth: number = 1, gridHeight: number = 1) => {
    const newHighlights: {
      regionId: string;
      hexes: { hexX: number; hexY: number; radius: number }[];
      squares: { gridX: number; gridY: number; size: number }[];
    }[] = [];

    regions.forEach((region) => {
      if (region.gridType === "hex" || region.gridType === "square") {
        // Check if token is within this region (use proper shape detection)
        if (isPointInRegion(tokenX, tokenY, region)) {
          const occupiedHexes =
            region.gridType === "hex" ? calculateTokenHexOccupancy(tokenX, tokenY, region, gridWidth, gridHeight) : [];
          const occupiedSquares =
            region.gridType === "square"
              ? calculateTokenSquareOccupancy(tokenX, tokenY, region, gridWidth, gridHeight)
              : [];

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
    const newHighlights: {
      regionId: string;
      hexes: { hexX: number; hexY: number; radius: number }[];
      squares: { gridX: number; gridY: number; size: number }[];
    }[] = [];

    // Determine if we're in play mode with fog active
    const isPlayMode = renderingMode === "play";

    // Check each token against each region
    tokens.forEach((token) => {
      // Skip tokens that aren't visible to the current player (same logic as token rendering)
      if (isPlayMode && fogEnabled && !fogRevealAll) {
        const tokenPoint = { x: token.x, y: token.y };
        
        // Use stable visibility snapshot during drag to prevent flashing
        const visibilityToCheck = (isDraggingToken || isDraggingRegion) && stableVisibilityRef.current
          ? stableVisibilityRef.current
          : currentVisibilityRef.current;
        
        const isCurrentlyIlluminated = isPointInVisibleArea(tokenPoint, visibilityToCheck);
        
        // Check token ownership - friendly tokens always visible to their owner
        const tokenPlayer = players.find((p) => p.id === currentPlayerId);
        const relationship = tokenPlayer ? getTokenRelationship(token, tokenPlayer, roles) : 'neutral';
        const isFriendlyToken = relationship === 'friendly';
        
        if (!isCurrentlyIlluminated) {
          if (!isDM) {
            // Players don't see grid highlights for hidden non-friendly tokens
            if (!isFriendlyToken) {
              return; // Skip this token
            }
          } else {
            // DM visibility modes
            if (dmFogVisibility === 'hidden') {
              return; // Skip this token
            }
            // 'semi-transparent' and 'full' modes: continue to show highlight
          }
        }
      }

      regions.forEach((region) => {
        if (region.gridType === "hex" || region.gridType === "square") {
          // Always calculate token highlights for grid regions
          // Check if token is within this region (use proper shape detection)
          if (isPointInRegion(token.x, token.y, region)) {
            const occupiedHexes = region.gridType === "hex" ? calculateTokenHexOccupancy(token.x, token.y, region) : [];
            const occupiedSquares =
              region.gridType === "square" ? calculateTokenSquareOccupancy(token.x, token.y, region) : [];

            if (occupiedHexes.length > 0 || occupiedSquares.length > 0) {
              // Check if this region already has highlights
              const existingRegionHighlight = newHighlights.find((h) => h.regionId === region.id);
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
    if (region.regionType === "path" && region.pathPoints) {
      const handleSize = 20 / transform.zoom; // Increased hitbox size

      // Check Bezier control points first (smaller, higher priority)
      if (region.bezierControlPoints) {
        for (let i = 0; i < region.bezierControlPoints.length; i++) {
          const controls = region.bezierControlPoints[i];

          // Check first control point
          const distCp1 = Math.sqrt(Math.pow(worldX - controls.cp1.x, 2) + Math.pow(worldY - controls.cp1.y, 2));
          if (distCp1 <= handleSize / 3) {
            return `cp-${i}-1`;
          }

          // Check second control point
          if (i < region.pathPoints.length - 1) {
            const distCp2 = Math.sqrt(Math.pow(worldX - controls.cp2.x, 2) + Math.pow(worldY - controls.cp2.y, 2));
            if (distCp2 <= handleSize / 3) {
              return `cp-${i}-2`;
            }
          }
        }
      }

      // Then check anchor points
      for (let i = 0; i < region.pathPoints.length; i++) {
        const point = region.pathPoints[i];
        const distance = Math.sqrt(Math.pow(worldX - point.x, 2) + Math.pow(worldY - point.y, 2));

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
      if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - y) <= handleSize) return "nw";
      if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - y) <= handleSize) return "ne";
      if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return "sw";
      if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return "se";

      // Check edge handles
      if (Math.abs(worldX - (x + width / 2)) <= handleSize && Math.abs(worldY - y) <= handleSize) return "n";
      if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - (y + height / 2)) <= handleSize) return "e";
      if (Math.abs(worldX - (x + width / 2)) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return "s";
      if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - (y + height / 2)) <= handleSize) return "w";

      return null;
    }
  };

  // Image cache to prevent re-loading images on every redraw
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Helper to get or load a cached image (must be defined before redrawCanvas)
  const getCachedImage = (url: string): HTMLImageElement | null => {
    if (!url) return null;
    
    let img = imageCache.current.get(url);
    
    if (!img) {
      img = new Image();
      img.crossOrigin = "anonymous";
      imageCache.current.set(url, img);
      
      img.onload = () => {
        // Increment counter to trigger re-render when image loads
        setImageLoadCounter(c => c + 1);
      };
      
      img.src = url;
      return null; // Image not ready yet
    }
    
    if (!img.complete || img.naturalHeight === 0) return null;
    return img;
  };

  const redrawCanvas = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
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
    const isPlayMode = renderingMode === "play";
    const isEditMode = renderingMode === "edit";

    // TODO: Future enhancement - apply Watabou styling in Play Mode
    // For now, both modes use the same VTT rendering style

    // Draw background
    if (isPlayMode) {
      // Play mode: Eventually will use Watabou styling, for now same as edit
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(viewX - 1000, viewY - 1000, viewWidth + 2000, viewHeight + 2000);
    } else {
      // Edit mode: VTT dark background
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(viewX - 1000, viewY - 1000, viewWidth + 2000, viewHeight + 2000);
    }

    // Draw world grid (only in edit mode)
    if (renderingMode === "edit") {
      ctx.strokeStyle = "#333";
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

    tokens.forEach((token) => {
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
      if (
        tokenRight >= viewX &&
        tokenLeft <= viewX + viewWidth &&
        tokenBottom >= viewY &&
        tokenTop <= viewY + viewHeight
      ) {
        visibleTokens.push(checkToken);
      } else {
        offScreenTokens.push(checkToken);
      }
    });

    // 1. First render terrain features (water, debris, etc.) - BELOW walls
    renderTerrainFeatures(ctx, terrainFeatures, transform.zoom, isPlayMode, watabouStyle, regions);

    // 2. First render floor regions - ABOVE terrain features
    // Skip region strokes since decorative walls will handle the edges
    // Use viewport culling for performance optimization
    const viewport: ViewportBounds = { x: viewX, y: viewY, width: viewWidth, height: viewHeight };
    
    if (showRegions) {
      regions.forEach((region) => {
        // Get region bounds for viewport culling
        let regionBounds: { x: number; y: number; width: number; height: number };
        if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 0) {
          const xs = region.pathPoints.map(p => p.x);
          const ys = region.pathPoints.map(p => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          regionBounds = {
            x: minX,
            y: minY,
            width: Math.max(...xs) - minX,
            height: Math.max(...ys) - minY
          };
        } else {
          regionBounds = { x: region.x, y: region.y, width: region.width, height: region.height };
        }
        
        // Skip rendering if region is outside viewport (with margin for textures)
        if (!isInViewport(regionBounds, viewport, 200)) {
          return;
        }
        
        drawRegion(ctx, region, true); // skipStroke = true for both modes
      });
      
      // Apply GPU-accelerated edge hatching if enabled
      if (isRegionEdgeReady) {
        applyRegionEdgeEffects(regions, transform);
      }
    }

    // 3. Then render walls (negative space) on top - ABOVE regions
    // This ensures walls cover/overlap floor regions properly
    const minGridSize = regions.reduce((min, r) => Math.min(min, r.gridSize), Infinity);
    const margin = minGridSize !== Infinity ? minGridSize * 2 : 80; // Default to 80 if no regions

    // Generate cache key
    const cacheKey = generateWallDecorationCacheKey(
      regions,
      wallEdgeStyle,
      wallThickness,
      textureScale,
      isPlayMode,
      lights.length,
    );

    // Check if we can use cached decorations
    let wallGeometry: any;
    let cachedCanvas: HTMLCanvasElement | null = null;
    let cachedShadowCanvas: HTMLCanvasElement | null = null;

    if (wallDecorationCacheRef.current && wallDecorationCacheRef.current.cacheKey === cacheKey) {
      // Use cached data
      wallGeometry = wallDecorationCacheRef.current.wallGeometry;
      wallGeometryRef.current = wallGeometry; // Update ref for fog computation
      cachedCanvas = wallDecorationCacheRef.current.canvas;
      cachedShadowCanvas = wallDecorationCacheRef.current.shadowCanvas;
    } else {
      // Generate new decorations and cache them
      const negativeSpace = generateNegativeSpaceRegion(regions, 15, margin);
      if (negativeSpace) {
        wallGeometry = negativeSpace.wallGeometry;

        // Create offscreen canvas for decorations
        const offscreenCanvas = document.createElement("canvas");
        const bounds = wallGeometry.bounds;
        const padding = 50; // Extra padding for thick walls
        offscreenCanvas.width = Math.ceil(bounds.width + padding * 2);
        offscreenCanvas.height = Math.ceil(bounds.height + padding * 2);

        const offscreenCtx = offscreenCanvas.getContext("2d");
        if (offscreenCtx) {
          // Translate to account for bounds offset and padding
          offscreenCtx.translate(-bounds.x + padding, -bounds.y + padding);

          // Draw wall fill with texture in play mode - REMOVED
          // We only want edge decoration, not a full texture fill
          offscreenCtx.save();
          if (!isPlayMode) {
            // Edit mode: show subtle dark fill
            offscreenCtx.fillStyle = "#333333";
            offscreenCtx.globalAlpha = 0.25;
            offscreenCtx.fill(wallGeometry.wallPath, "evenodd");
          }
          offscreenCtx.restore();

          // Draw decorative edges to offscreen canvas
          offscreenCtx.save();
          offscreenCtx.clip(wallGeometry.wallPath, "evenodd");
          drawDecorativeEdgesToContext(offscreenCtx, wallGeometry, regions, wallEdgeStyle, wallThickness, textureScale);
          offscreenCtx.restore();

          cachedCanvas = offscreenCanvas;
        }

        // Create shadow canvas (only for play mode) - DISABLED
        // The old shadow system was drawing shadows in the wrong place (on walls not regions)
        // New shadow system draws shadows directly on regions in the main render loop
        let shadowCanvas: HTMLCanvasElement | null = null;
        cachedShadowCanvas = null;

        // Cache the result
        wallDecorationCacheRef.current = {
          cacheKey,
          canvas: cachedCanvas!,
          shadowCanvas: cachedShadowCanvas!,
          wallGeometry,
          bounds: {
            x: bounds.x - padding,
            y: bounds.y - padding,
            width: offscreenCanvas!.width,
            height: offscreenCanvas!.height,
          },
          shadowBounds: cachedShadowCanvas
            ? { x: bounds.x - 30, y: bounds.y - 30, width: cachedShadowCanvas.width, height: cachedShadowCanvas.height }
            : { x: 0, y: 0, width: 0, height: 0 },
        };

        // Store in separate ref for fog computation
        wallGeometryRef.current = wallGeometry;
      }
    }

    // Old shadow system disabled - shadows now drawn directly on regions
    // Draw shadows first (under walls) - DISABLED
    // if (isPlayMode && cachedShadowCanvas && wallDecorationCacheRef.current) {
    //   const shadowBounds = wallDecorationCacheRef.current.shadowBounds;
    //   ctx.globalAlpha = 0.6;
    //   ctx.drawImage(cachedShadowCanvas, shadowBounds.x, shadowBounds.y);
    //   ctx.globalAlpha = 1.0;
    // }

    // Draw the base wall with red outline in edit mode only
    if (wallGeometry && !isPlayMode) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 2 / transform.zoom;
      const bounds = wallGeometry.bounds;
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.restore();
    }

    // Draw cached wall with texture and decorations
    if (cachedCanvas && wallDecorationCacheRef.current) {
      const cacheBounds = wallDecorationCacheRef.current.bounds;
      ctx.drawImage(cachedCanvas, cacheBounds.x, cacheBounds.y);
    }

    // NEW: Render shadows using visibility polygon system
    if (isPlayMode && lights.length > 0 && wallGeometry) {
      const illumination = computeIllumination(lights, wallGeometry.wallSegments, wallGeometry);
      renderShadows(ctx, regions, illumination, shadowIntensity, globalAmbientLight);
    }

    // 4. Then render doors - ABOVE walls (only in edit mode for now)
    if (renderingMode === "edit") {
      renderDoors(ctx, doors, transform.zoom);
    }

    // Draw highlighted grids (if any) - below tokens in z-order
    drawHighlightedGrids(ctx);
    
    // Draw marquee selection rectangle (in edit mode only)
    if (isMarqueeSelecting && marqueeStart && marqueeEnd && renderingMode === 'edit') {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const width = Math.abs(marqueeEnd.x - marqueeStart.x);
      const height = Math.abs(marqueeEnd.y - marqueeStart.y);
      
      ctx.save();
      // Draw filled background
      ctx.fillStyle = 'rgba(79, 70, 229, 0.15)'; // Indigo with transparency
      ctx.fillRect(minX, minY, width, height);
      
      // Draw dashed border
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2 / transform.zoom;
      ctx.setLineDash([6 / transform.zoom, 4 / transform.zoom]);
      ctx.strokeRect(minX, minY, width, height);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Helper to draw annotations to a given context (with world-space transform applied)
    const drawAnnotationsToContext = (targetCtx: CanvasRenderingContext2D) => {
      const isPlayModeForAnnotations = renderingMode === 'play';
      annotations.forEach((annotation) => {
        const { x, y } = annotation.position;
        
        // Check if annotation is in revealed area (for visibility and DM effects)
        let isInFog = false;
        if (isPlayModeForAnnotations && fogEnabled && !fogRevealAll) {
          const annotationPoint = { x, y };
          const isRevealed = isPointInRevealedArea(
            annotationPoint,
            exploredAreaRef.current,
            currentVisibilityRef.current
          );
          if (!isRevealed) {
            if (!isDM) {
              return; // Skip rendering - non-DM can't see fog-hidden annotations
            }
            // DM visibility modes
            if (dmFogVisibility === 'hidden') {
              return; // DM chose to hide fog-hidden elements
            }
            isInFog = dmFogVisibility === 'semi-transparent'; // Only fade if semi-transparent mode
          }
        }
        
        targetCtx.save();
        
        // Apply semi-transparency for DM viewing fog-covered annotations (only in semi-transparent mode)
        if (isInFog) {
          targetCtx.globalAlpha = 0.4;
        }
        
        const radius = 12 / transform.zoom;
        const fontSize = 10 / transform.zoom;
        const isSelected = selectedAnnotationId === annotation.id;

        // Draw selection ring if selected
        if (isSelected) {
          targetCtx.strokeStyle = "#fbbf24";
          targetCtx.lineWidth = 3 / transform.zoom;
          targetCtx.beginPath();
          targetCtx.arc(x, y, radius + 4 / transform.zoom, 0, 2 * Math.PI);
          targetCtx.stroke();
        }

        // Draw circle background
        targetCtx.fillStyle = "#3b82f6";
        targetCtx.beginPath();
        targetCtx.arc(x, y, radius, 0, 2 * Math.PI);
        targetCtx.fill();

        // Draw white border
        targetCtx.strokeStyle = "#ffffff";
        targetCtx.lineWidth = 2 / transform.zoom;
        targetCtx.stroke();

        // Draw reference number
        targetCtx.fillStyle = "#ffffff";
        targetCtx.font = `bold ${fontSize}px Arial`;
        targetCtx.textAlign = "center";
        targetCtx.textBaseline = "middle";
        targetCtx.fillText(annotation.reference, x, y);

        targetCtx.restore();
      });
    };

    // Helper to draw tokens to a given context (with world-space transform applied)
    const drawTokensToContext = (targetCtx: CanvasRenderingContext2D) => {
      visibleTokens.forEach((token) => {
        // Use temporary position if available (during region drag)
        const tempPos = tempTokenPositions?.[token.id];
        const renderToken = tempPos ? { ...token, x: tempPos.x, y: tempPos.y } : token;
        
        // Check if token is in fog (for DM visibility modes)
        // "Darkness returns" rule: tokens require active illumination to be visible
        // Exception: players always see their own (friendly) tokens
        let tokenInFog = false;
        let shouldSkipToken = false;
        if (isPlayMode && fogEnabled && !fogRevealAll) {
          const tokenPoint = { x: renderToken.x, y: renderToken.y };
          
          // Use stable visibility snapshot during drag to prevent flashing
          // The stable snapshot is captured at drag start and doesn't change during movement
          const visibilityToCheck = (isDraggingToken || isDraggingRegion) && stableVisibilityRef.current
            ? stableVisibilityRef.current
            : currentVisibilityRef.current;
          
          // Check if token is currently illuminated (in active light/vision)
          const isCurrentlyIlluminated = isPointInVisibleArea(
            tokenPoint,
            visibilityToCheck
          );
          
          // Check token ownership - friendly tokens always visible to their owner
          const tokenPlayer = players.find((p) => p.id === currentPlayerId);
          const relationship = tokenPlayer ? getTokenRelationship(renderToken, tokenPlayer, roles) : 'neutral';
          const isFriendlyToken = relationship === 'friendly';
          
          if (!isCurrentlyIlluminated) {
            if (!isDM) {
              // Players always see their own (friendly) tokens, even in darkness
              if (!isFriendlyToken) {
                shouldSkipToken = true; // Non-friendly tokens hidden in darkness
              }
            } else {
              // DM visibility modes
              if (dmFogVisibility === 'hidden') {
                shouldSkipToken = true; // DM chose to hide fog-hidden elements
              } else if (dmFogVisibility === 'semi-transparent') {
                tokenInFog = true; // Show with semi-transparency
              }
              // 'full' mode: tokenInFog stays false, token renders normally
            }
          }
        }
        
        if (shouldSkipToken) return;
        
        // Draw token - need to use drawToken with correct context
        drawTokenToContext(targetCtx, renderToken, tokenInFog);
      });
    };

    // Helper to draw a single token to a specific context
    const drawTokenToContext = (targetCtx: CanvasRenderingContext2D, token: any, isInFog: boolean = false) => {
      const baseTokenSize = 40;
      const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
      const radius = tokenSize / 2;
      const isSelected = selectedTokenIds.includes(token.id);
      const isHovered = hoveredTokenId === token.id;

      const tokenPlayer = players.find((p) => p.id === currentPlayerId);
      const isControllable = tokenPlayer ? canControlToken(token, tokenPlayer, roles) : false;
      const relationship = tokenPlayer ? getTokenRelationship(token, tokenPlayer, roles) : "neutral";
      const isHostile = relationship === "hostile";
      const role = roles.find((r) => r.id === token.roleId);
      const roleBorderColor = role?.color || "#000000";
      const currentEntry = initiativeOrder[currentTurnIndex];
      const isActiveInCombat = isInCombat && currentEntry?.tokenId === token.id;

      targetCtx.save();
      if (isInFog) {
        targetCtx.globalAlpha = 0.4;
      }

      // Draw hostile pulsing indicator
      if (isHostile && !isInFog) {
        const pulseTime = Date.now() / 500;
        const pulseIntensity = (Math.sin(pulseTime) + 1) / 2;
        targetCtx.save();
        targetCtx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulseIntensity * 0.4})`;
        targetCtx.lineWidth = (5 + pulseIntensity * 2) / transform.zoom;
        targetCtx.beginPath();
        targetCtx.arc(token.x, token.y, radius + 5, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.restore();
      }

      // Draw active combat highlight
      if (isActiveInCombat && !isInFog) {
        targetCtx.save();
        targetCtx.strokeStyle = "rgba(255, 215, 0, 0.6)";
        targetCtx.lineWidth = 6 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.arc(token.x, token.y, radius + 6, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.strokeStyle = "rgba(255, 215, 0, 0.8)";
        targetCtx.lineWidth = 3 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.arc(token.x, token.y, radius + 3, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.restore();
      }

      // Draw controllability hover glow
      if (isHovered && isControllable && !isDraggingToken && !isInFog) {
        targetCtx.save();
        targetCtx.strokeStyle = "rgba(34, 197, 94, 0.6)";
        targetCtx.lineWidth = 4 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.arc(token.x, token.y, radius + 4, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.restore();
      }

      // Draw selection highlight
      if (isSelected) {
        targetCtx.shadowColor = "#fbbf24";
        targetCtx.shadowBlur = 15 / transform.zoom;
        targetCtx.strokeStyle = "#fbbf24";
        targetCtx.lineWidth = 3 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.arc(token.x, token.y, radius + 3 / transform.zoom, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.shadowBlur = 0;
      }

      // Draw main token (image or color fill)
      const tokenImg = token.imageUrl ? getCachedImage(token.imageUrl) : null;
      
      if (tokenImg) {
        // Draw circular clipped image
        targetCtx.save();
        targetCtx.beginPath();
        targetCtx.arc(token.x, token.y, radius, 0, 2 * Math.PI);
        targetCtx.clip();
        
        // Draw image centered and scaled to fit
        const size = radius * 2;
        targetCtx.drawImage(tokenImg, token.x - radius, token.y - radius, size, size);
        targetCtx.restore();
        
        // Draw border on top
        targetCtx.strokeStyle = roleBorderColor;
        targetCtx.lineWidth = 3 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.arc(token.x, token.y, radius, 0, 2 * Math.PI);
        targetCtx.stroke();
      } else {
        // Fallback to color fill
        targetCtx.fillStyle = token.color || "#ffffff";
        targetCtx.beginPath();
        targetCtx.arc(token.x, token.y, radius, 0, 2 * Math.PI);
        targetCtx.fill();

        // Draw role border
        targetCtx.strokeStyle = roleBorderColor;
        targetCtx.lineWidth = 3 / transform.zoom;
        targetCtx.stroke();
      }

      // Draw token label based on position setting
      const displayText = token.label || token.name;
      if (displayText) {
        const labelPos = token.labelPosition || 'below';
        targetCtx.fillStyle = "#000000";
        targetCtx.font = `${12 / transform.zoom}px Arial`;
        targetCtx.textAlign = "center";
        
        if (labelPos === 'center') {
          targetCtx.textBaseline = "middle";
          targetCtx.fillText(displayText, token.x, token.y);
        } else if (labelPos === 'above') {
          targetCtx.textBaseline = "bottom";
          targetCtx.fillText(displayText, token.x, token.y - radius - 4 / transform.zoom);
        } else {
          // below (default)
          targetCtx.textBaseline = "top";
          targetCtx.fillText(displayText, token.x, token.y + radius + 4 / transform.zoom);
        }
      }

      targetCtx.restore();
    };

    // Determine if we should use the overlay canvas for tokens/annotations
    const useOverlayForTokens = isPostProcessingReady && effectSettings.postProcessingEnabled && fogEnabled;

    // If NOT using post-processing (or fog disabled), draw annotations and tokens to main canvas here
    if (!useOverlayForTokens) {
      // Draw annotations (markers) below tokens so tokens are visible
      drawAnnotationsToContext(ctx);
    }

    // Draw light sources in edit mode using new system
    if (renderingMode === "edit" && lights.length > 0) {
      renderLightSources(ctx, lights, transform);
    }

    // Draw current path being drawn
    if (pathDrawingMode === "drawing" && currentPath.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 2 / transform.zoom;
      ctx.setLineDash([5, 5]);

      if (currentPath.length === 1) {
        // Draw first point
        ctx.fillStyle = "#ff6b6b";
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
        ctx.fillStyle = "#ff6b6b";
        currentPath.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4 / transform.zoom, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
      ctx.restore();
    }

    // NOTE: Drag ghost and path is drawn AFTER fog (see below) to ensure it appears on top

    // Render fog of war BEFORE tokens (in world coordinate space)
    // Use pre-computed masks from useEffect
    if (isPlayMode && fogEnabled && !fogRevealAll && fogMasksRef.current) {
      // Check if we should use PixiJS post-processing instead of main canvas fog
      const usePostProcessing = isPostProcessingReady && effectSettings.postProcessingEnabled;

      // Only render fog on main canvas if post-processing is disabled
      // When post-processing is enabled, PixiJS layer renders the blurred fog
      if (!usePostProcessing) {
        // IMPORTANT: Render fog to an offscreen canvas first, then composite onto main canvas.
        // This prevents destination-out from cutting through the floor textures beneath fog.
        // Without this, destination-out would make holes through the ENTIRE canvas (including regions).
        
        // Create or reuse offscreen fog canvas
        let fogOffscreenCanvas = (window as any).__fogOffscreenCanvas as HTMLCanvasElement | undefined;
        if (!fogOffscreenCanvas || fogOffscreenCanvas.width !== canvas.width || fogOffscreenCanvas.height !== canvas.height) {
          fogOffscreenCanvas = document.createElement('canvas');
          fogOffscreenCanvas.width = canvas.width;
          fogOffscreenCanvas.height = canvas.height;
          (window as any).__fogOffscreenCanvas = fogOffscreenCanvas;
        }
        
        const fogCtx = fogOffscreenCanvas.getContext('2d');
        if (fogCtx) {
          // Clear the offscreen fog canvas
          fogCtx.clearRect(0, 0, fogOffscreenCanvas.width, fogOffscreenCanvas.height);
          
          // Apply the same transform as main canvas
          fogCtx.save();
          fogCtx.translate(transform.x, transform.y);
          fogCtx.scale(transform.zoom, transform.zoom);
          
          // Render base fog layers to offscreen canvas
          fogCtx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
          fogCtx.fill(fogMasksRef.current.unexploredMask);

          fogCtx.fillStyle = `rgba(0, 0, 0, ${exploredOpacity})`;
          fogCtx.fill(fogMasksRef.current.exploredOnlyMask);

          // Cut out visibility areas from fog using destination-out
          // This only affects the fog canvas, not the main canvas with regions
          if (tokenVisibilityDataRef.current.length > 0 || dragPreviewVisibilityRef.current) {
            fogCtx.globalCompositeOperation = "destination-out";

            tokenVisibilityDataRef.current.forEach(({ visibilityPath }) => {
              fogCtx.fillStyle = "rgba(255, 255, 255, 1)";
              fogCtx.fill(visibilityPath);
            });
            
            // Composite real-time drag preview visibility (when feature enabled)
            if (isDraggingToken && realtimeVisionDuringDrag && dragPreviewVisibilityRef.current) {
              fogCtx.fillStyle = "rgba(255, 255, 255, 1)";
              fogCtx.fill(dragPreviewVisibilityRef.current);
            }

            fogCtx.globalCompositeOperation = "source-over";
          }
          
          fogCtx.restore();
          
          // Now composite the fog canvas onto the main canvas
          // The main canvas still has regions/textures intact; we're just overlaying fog with transparent holes
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to draw fog canvas at screen coordinates
          ctx.drawImage(fogOffscreenCanvas, 0, 0);
          ctx.restore();
        }
      } else {
        // Apply PixiJS post-processing effects to fog (blur, light falloff gradients)
        // Convert old token visibility data to new IlluminationSource format for GPU rendering
        const illuminationSources = tokenVisibilityDataRef.current.map((t, idx) => {
          // Use token's custom illumination settings if available, otherwise use global defaults
          const tokenSettings = t.tokenIllumination?.[0];
          
          // IMPORTANT: Always use t.visionRange which was computed with the correct
          // per-token gridSize when the visibility polygon was created. This ensures
          // the color gradient matches the visibility polygon exactly.
          const rangePixels = t.visionRange;
          
          return {
            id: `vis-${idx}`,
            name: t.isLightSource ? 'Light' : 'Vision',
            enabled: true,
            position: t.position,
            range: rangePixels, // Already in pixels - no further conversion needed
            brightZone: tokenSettings?.brightZone ?? effectSettings.lightFalloff, // Use token setting or global
            brightIntensity: tokenSettings?.brightIntensity ?? 1.0,
            dimIntensity: tokenSettings?.dimIntensity ?? (t.isLightSource ? 0.4 : 0.0),
            color: tokenSettings?.color ?? (t.isLightSource ? '#FFD700' : '#FFFFFF'),
            colorEnabled: tokenSettings?.colorEnabled ?? false,
            colorIntensity: tokenSettings?.colorIntensity ?? 0.5,
            softEdge: tokenSettings?.softEdge ?? true,
            softEdgeRadius: tokenSettings?.softEdgeRadius ?? 8,
            animation: tokenSettings?.animation ?? 'none',
            animationSpeed: tokenSettings?.animationSpeed ?? 1.0,
            animationIntensity: tokenSettings?.animationIntensity ?? 0.3,
            visibilityPolygon: t.visibilityPath,
          };
        });
        
        // Add real-time drag preview as an additional illumination source
        if (isDraggingToken && realtimeVisionDuringDrag && dragPreviewVisibilityRef.current && dragPreviewPosition && draggedTokenId) {
          const draggedToken = tokens.find(t => t.id === draggedTokenId);
          if (draggedToken) {
            const tokenSettings = draggedToken.illuminationSources?.[0];
            
            illuminationSources.push({
              id: 'drag-preview',
              name: 'Drag Preview',
              enabled: true,
              position: {
                x: dragPreviewPosition.x,
                y: dragPreviewPosition.y,
              },
              range: dragPreviewPosition.range,
              brightZone: tokenSettings?.brightZone ?? effectSettings.lightFalloff,
              brightIntensity: tokenSettings?.brightIntensity ?? 1.0,
              dimIntensity: tokenSettings?.dimIntensity ?? 0.0,
              color: tokenSettings?.color ?? '#FFFFFF',
              colorEnabled: tokenSettings?.colorEnabled ?? false,
              colorIntensity: tokenSettings?.colorIntensity ?? 0.5,
              softEdge: tokenSettings?.softEdge ?? true,
              softEdgeRadius: tokenSettings?.softEdgeRadius ?? 8,
              animation: 'none',
              animationSpeed: 1.0,
              animationIntensity: 0.3,
              visibilityPolygon: dragPreviewVisibilityRef.current,
            });
          }
        }
        
        applyPostProcessingEffects(
          ctx,
          fogMasksRef.current,
          fogOpacity,
          exploredOpacity,
          transform,
          {
            sources: illuminationSources,
            gridSize: 1, // Range is already in pixels, so gridSize multiplier is 1
            transform,
          }
        );
      }
    }

    // Draw visible tokens AFTER fog - but only if NOT using overlay canvas
    // When post-processing is enabled with fog, tokens are drawn to overlay canvas to appear above PixiJS
    if (!useOverlayForTokens) {
      drawTokensToContext(ctx);
      
      // Draw drag ghost and path on top of tokens (only for non-overlay mode)
      if (isDraggingToken && draggedTokenId) {
        drawDragGhostAndPath(ctx);
      }
    }

    // Restore context after all world-space rendering
    ctx.restore();

    // Draw off-screen token indicators and overlay content
    // When post-processing is enabled with fog, also draw tokens/annotations to overlay canvas
    const usePostProcessing = isPostProcessingReady && effectSettings.postProcessingEnabled;
    const overlayCanvas = overlayCanvasRef.current;
    
    if (overlayCanvas) {
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        // Clear overlay canvas
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        if (usePostProcessing) {
          // Draw off-screen indicators to overlay
          offScreenTokens.forEach((token) => {
            drawOffScreenIndicator(overlayCtx, token, viewX, viewY, viewWidth, viewHeight);
          });
          
          // When fog is enabled with post-processing, draw tokens/annotations to overlay
          // so they appear above the PixiJS fog layer
          if (fogEnabled) {
            // Apply world-space transform for tokens/annotations
            overlayCtx.save();
            overlayCtx.translate(transform.x, transform.y);
            overlayCtx.scale(transform.zoom, transform.zoom);
            
            // Draw annotations first (below tokens)
            drawAnnotationsToContext(overlayCtx);
            
            // Draw tokens on top
            drawTokensToContext(overlayCtx);
            
            // Draw drag ghost and path on overlay so it appears above fog
            if (isDraggingToken && draggedTokenId) {
              drawDragGhostAndPath(overlayCtx);
            }
            
            overlayCtx.restore();
          }
        } else {
          // Not using post-processing - draw indicators to main canvas
          offScreenTokens.forEach((token) => {
            drawOffScreenIndicator(ctx, token, viewX, viewY, viewWidth, viewHeight);
          });
        }
      }
    } else if (!usePostProcessing) {
      // No overlay canvas, draw indicators to main canvas
      offScreenTokens.forEach((token) => {
        drawOffScreenIndicator(ctx, token, viewX, viewY, viewWidth, viewHeight);
      });
    }
  };

  // Function to draw drag ghost and path
  const drawDragGhostAndPath = (ctx: CanvasRenderingContext2D) => {
    if (!draggedTokenId) return;

    const draggedToken = tokens.find((t) => t.id === draggedTokenId);
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
    ctx.fillStyle = token.color || "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Draw ghost border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 / transform.zoom;
    ctx.setLineDash([5 / transform.zoom, 5 / transform.zoom]); // Dashed border
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Draw ghost label
    if (token.label) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `${12 / transform.zoom}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
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
    ctx.strokeStyle = token.color || "#ffffff";
    ctx.lineWidth = 3 / transform.zoom;
    ctx.globalAlpha = 0.6;

    // Simple straight line for free movement
    ctx.beginPath();
    ctx.moveTo(dragStartPos.x, dragStartPos.y);
    ctx.lineTo(token.x, token.y);
    ctx.stroke();

    // Draw distance text at midpoint of line
    if (distancePixels > 10) {
      // Only show if line is long enough
      const midX = (dragStartPos.x + token.x) / 2;
      const midY = (dragStartPos.y + token.y) / 2;

      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.9;
      ctx.font = `${14 / transform.zoom}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Add background to text for better readability
      const textMetrics = ctx.measureText(`${distanceGridUnits} units`);
      const textWidth = textMetrics.width;
      const textHeight = 14 / transform.zoom;

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(
        midX - textWidth / 2 - 4 / transform.zoom,
        midY - textHeight / 2,
        textWidth + 8 / transform.zoom,
        textHeight,
      );

      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${distanceGridUnits} units`, midX, midY);
    }

    // Draw path points if we have a detailed path
    if (dragPath.length > 1) {
      ctx.fillStyle = token.color || "#ffffff";
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

        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.9;
        ctx.font = `${12 / transform.zoom}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Add background to text for better readability
        const pathText = `Path: ${pathDistanceGridUnits}`;
        const textMetrics = ctx.measureText(pathText);
        const textWidth = textMetrics.width;
        const textHeight = 12 / transform.zoom;

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(
          textX - textWidth / 2 - 3 / transform.zoom,
          textY - textHeight / 2,
          textWidth + 6 / transform.zoom,
          textHeight,
        );

        ctx.fillStyle = token.color || "#ffffff";
        ctx.fillText(pathText, textX, textY);
      }
    }

    // Draw direction arrow at current position
    drawDirectionArrow(ctx, dragStartPos, { x: token.x, y: token.y }, token.color || "#ffffff");

    ctx.restore();
  };

  // Function to draw direction arrow
  const drawDirectionArrow = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
  ) => {
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

  // Helper to draw decorative edges to any context (for caching)
  const drawDecorativeEdgesToContext = (
    ctx: CanvasRenderingContext2D,
    wallGeometry: any,
    regions: CanvasRegion[],
    style: WallEdgeStyle,
    wallThickness: number,
    textureScale: number,
  ) => {
    const config = EDGE_STYLES[style];

    ctx.save();

    // Only decorate the inner boundaries (region edges), not the outer bounding box
    regions.forEach((region) => {
      const points = getRegionEdgePoints(region);

      // Calculate total path length for variation
      let totalLength = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }

      // Apply rotation for rectangle regions
      const needsRotation = region.regionType !== "path" && region.rotation;
      if (needsRotation) {
        const centerX = region.x + region.width / 2;
        const centerY = region.y + region.height / 2;
        const angle = (region.rotation! * Math.PI) / 180;
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        ctx.translate(-centerX, -centerY);
      }

      // Draw base edge with varied thickness
      ctx.strokeStyle = config.baseColor;
      ctx.globalAlpha = config.alpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (region.regionType === "path" && region.pathPoints && region.pathPoints.length > 2) {
        // Draw path regions with bezier curves
        let currentPos = 0;

        ctx.beginPath();
        ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);

        if (region.bezierControlPoints && region.smoothing !== false) {
          for (let i = 0; i < region.pathPoints.length - 1; i++) {
            const segmentDx = region.pathPoints[i + 1].x - region.pathPoints[i].x;
            const segmentDy = region.pathPoints[i + 1].y - region.pathPoints[i].y;
            const segmentLength = Math.sqrt(segmentDx * segmentDx + segmentDy * segmentDy);

            ctx.lineWidth = getVariedLineWidth(config.baseWidth * wallThickness, currentPos, totalLength);
            currentPos += segmentLength;

            const cp = region.bezierControlPoints[i];
            if (cp) {
              ctx.bezierCurveTo(
                cp.cp1.x,
                cp.cp1.y,
                cp.cp2.x,
                cp.cp2.y,
                region.pathPoints[i + 1].x,
                region.pathPoints[i + 1].y,
              );
            } else {
              ctx.lineTo(region.pathPoints[i + 1].x, region.pathPoints[i + 1].y);
            }
          }

          const lastCp = region.bezierControlPoints[region.pathPoints.length - 1];
          if (lastCp) {
            ctx.bezierCurveTo(
              lastCp.cp1.x,
              lastCp.cp1.y,
              lastCp.cp2.x,
              lastCp.cp2.y,
              region.pathPoints[0].x,
              region.pathPoints[0].y,
            );
          } else {
            ctx.closePath();
          }
        } else {
          for (let i = 1; i < region.pathPoints.length; i++) {
            ctx.lineWidth = getVariedLineWidth(config.baseWidth * wallThickness, currentPos, totalLength);
            ctx.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
            const dx = region.pathPoints[i].x - region.pathPoints[i - 1].x;
            const dy = region.pathPoints[i].y - region.pathPoints[i - 1].y;
            currentPos += Math.sqrt(dx * dx + dy * dy);
          }
          ctx.closePath();
        }

        ctx.stroke();

        // Draw shadow layer
        ctx.strokeStyle = config.shadowColor;
        ctx.lineWidth = config.shadowWidth * wallThickness;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
      } else {
        // Draw rectangle with varied thickness
        const segments = [
          { x1: region.x, y1: region.y, x2: region.x + region.width, y2: region.y },
          { x1: region.x + region.width, y1: region.y, x2: region.x + region.width, y2: region.y + region.height },
          { x1: region.x + region.width, y1: region.y + region.height, x2: region.x, y2: region.y + region.height },
          { x1: region.x, y1: region.y + region.height, x2: region.x, y2: region.y },
        ];

        let currentPos = 0;
        segments.forEach((seg) => {
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineWidth = getVariedLineWidth(config.baseWidth * wallThickness, currentPos, totalLength);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();

          const dx = seg.x2 - seg.x1;
          const dy = seg.y2 - seg.y1;
          currentPos += Math.sqrt(dx * dx + dy * dy);
        });

        // Draw shadow layer
        ctx.strokeStyle = config.shadowColor;
        ctx.lineWidth = config.shadowWidth * wallThickness;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(region.x, region.y, region.width, region.height);
      }

      // Apply texture patterns
      if (config.textureEnabled) {
        if (style === "stone") {
          applyHatchingPattern(ctx, points, style, textureScale);
          applyStipplingPattern(ctx, points, style, textureScale);
        } else if (style === "wood") {
          applyWoodGrainPattern(ctx, points, textureScale);
          applyStipplingPattern(ctx, points, style, textureScale);
        } else if (style === "metal") {
          applyHatchingPattern(ctx, points, style, textureScale);
        }
      }

      if (needsRotation) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    });

    ctx.restore();
  };

  // Helper to draw ambient occlusion at wall corners
  const drawAmbientOcclusion = (ctx: CanvasRenderingContext2D, regions: CanvasRegion[], wallGeometry: any) => {
    ctx.save();
    ctx.clip(wallGeometry.wallPath, "evenodd");

    // Find corners where walls meet
    regions.forEach((region) => {
      const points = getRegionEdgePoints(region);

      // Draw darkening at each corner
      points.forEach((point, i) => {
        const prevPoint = points[i === 0 ? points.length - 1 : i - 1];
        const nextPoint = points[(i + 1) % points.length];

        // Calculate angle between edges
        const v1 = { x: prevPoint.x - point.x, y: prevPoint.y - point.y };
        const v2 = { x: nextPoint.x - point.x, y: nextPoint.y - point.y };
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        if (len1 > 0 && len2 > 0) {
          v1.x /= len1;
          v1.y /= len1;
          v2.x /= len2;
          v2.y /= len2;

          const dot = v1.x * v2.x + v1.y * v2.y;
          const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

          // Stronger darkening for sharper corners
          if (angle > Math.PI / 6) {
            // More than 30 degrees
            const occlusionRadius = 15;
            const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, occlusionRadius);

            // Intensity based on corner sharpness
            const intensity = Math.min(0.6, (angle / Math.PI) * 0.8);
            gradient.addColorStop(0, `rgba(0, 0, 0, ${intensity})`);
            gradient.addColorStop(0.5, `rgba(0, 0, 0, ${intensity * 0.4})`);
            gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(point.x, point.y, occlusionRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    });

    ctx.restore();
  };

  // Helper to create wall texture pattern
  const createWallTexturePattern = (
    ctx: CanvasRenderingContext2D,
    style: WallEdgeStyle,
    width: number,
    height: number,
  ): CanvasPattern | null => {
    const patternCanvas = document.createElement("canvas");
    const patternSize = 64;
    patternCanvas.width = patternSize;
    patternCanvas.height = patternSize;
    const patternCtx = patternCanvas.getContext("2d");
    if (!patternCtx) return null;

    // Base color
    patternCtx.fillStyle = "#2a2a2a";
    patternCtx.fillRect(0, 0, patternSize, patternSize);

    if (style === "stone") {
      // Stone texture - irregular blocks
      patternCtx.strokeStyle = "#1a1a1a";
      patternCtx.lineWidth = 1;

      // Draw irregular stone pattern
      const stones = [
        [0, 0, 32, 20],
        [32, 0, 32, 24],
        [0, 20, 24, 22],
        [24, 20, 40, 22],
        [0, 42, 28, 22],
        [28, 42, 36, 22],
      ];

      stones.forEach(([x, y, w, h]) => {
        patternCtx.strokeRect(x, y, w, h);
        // Add some variation
        patternCtx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`;
        patternCtx.fillRect(x, y, w, h);
      });

      // Add some dots for texture
      for (let i = 0; i < 15; i++) {
        patternCtx.fillStyle = `rgba(${50 + Math.random() * 30}, ${50 + Math.random() * 30}, ${50 + Math.random() * 30}, 0.3)`;
        patternCtx.fillRect(Math.random() * patternSize, Math.random() * patternSize, 2, 2);
      }
    } else if (style === "metal") {
      // Metal texture - riveted panels
      patternCtx.strokeStyle = "#3a3a3a";
      patternCtx.lineWidth = 2;

      // Panel lines
      patternCtx.beginPath();
      patternCtx.moveTo(0, patternSize / 2);
      patternCtx.lineTo(patternSize, patternSize / 2);
      patternCtx.moveTo(patternSize / 2, 0);
      patternCtx.lineTo(patternSize / 2, patternSize);
      patternCtx.stroke();

      // Rivets
      const rivetPositions = [
        [8, 8],
        [56, 8],
        [8, 56],
        [56, 56],
        [32, 32],
      ];
      rivetPositions.forEach(([x, y]) => {
        patternCtx.fillStyle = "#444";
        patternCtx.beginPath();
        patternCtx.arc(x, y, 3, 0, Math.PI * 2);
        patternCtx.fill();
        patternCtx.strokeStyle = "#1a1a1a";
        patternCtx.lineWidth = 1;
        patternCtx.stroke();
      });

      // Scratches
      patternCtx.strokeStyle = "rgba(60, 60, 60, 0.5)";
      patternCtx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = Math.random() * patternSize;
        patternCtx.beginPath();
        patternCtx.moveTo(0, y);
        patternCtx.lineTo(patternSize, y + (Math.random() - 0.5) * 10);
        patternCtx.stroke();
      }
    } else if (style === "wood") {
      // Wood grain texture
      patternCtx.fillStyle = "#3d2f1f";
      patternCtx.fillRect(0, 0, patternSize, patternSize);

      // Wood planks
      const plankHeight = patternSize / 3;
      for (let i = 0; i < 3; i++) {
        const y = i * plankHeight;
        patternCtx.strokeStyle = "#2a1f10";
        patternCtx.lineWidth = 2;
        patternCtx.strokeRect(0, y, patternSize, plankHeight);

        // Grain lines
        patternCtx.strokeStyle = "rgba(42, 31, 16, 0.5)";
        patternCtx.lineWidth = 1;
        for (let j = 0; j < 3; j++) {
          const grainY = y + 5 + j * (plankHeight / 4);
          patternCtx.beginPath();
          patternCtx.moveTo(0, grainY);
          patternCtx.bezierCurveTo(
            patternSize / 4,
            grainY + (Math.random() - 0.5) * 3,
            (patternSize * 3) / 4,
            grainY + (Math.random() - 0.5) * 3,
            patternSize,
            grainY,
          );
          patternCtx.stroke();
        }

        // Knots
        if (Math.random() > 0.5) {
          const knotX = patternSize * 0.3 + Math.random() * patternSize * 0.4;
          const knotY = y + plankHeight / 2;
          patternCtx.fillStyle = "rgba(20, 10, 5, 0.4)";
          patternCtx.beginPath();
          patternCtx.ellipse(knotX, knotY, 4, 3, Math.random() * Math.PI, 0, Math.PI * 2);
          patternCtx.fill();
        }
      }
    } else {
      // Simple texture for 'simple' style
      patternCtx.fillStyle = "#333";
      patternCtx.fillRect(0, 0, patternSize, patternSize);
    }

    return ctx.createPattern(patternCanvas, "repeat");
  };

  // Generate cache key for wall decorations
  const generateWallDecorationCacheKey = (
    regions: CanvasRegion[],
    wallEdgeStyle: WallEdgeStyle,
    wallThickness: number,
    textureScale: number,
    isPlayMode: boolean,
    numLights: number,
  ): string => {
    const regionData = regions
      .map((r) => {
        if (r.regionType === "path" && r.pathPoints) {
          return `${r.id}-${r.pathPoints.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(";")}`;
        }
        return `${r.id}-${r.x.toFixed(0)},${r.y.toFixed(0)},${r.width.toFixed(0)},${r.height.toFixed(0)},${r.rotation || 0}`;
      })
      .join("|");
    return `${regionData}-${wallEdgeStyle}-${wallThickness}-${textureScale}-${isPlayMode ? "play" : "edit"}-${numLights}`;
  };

  // Function to draw regions
  const drawRegion = (ctx: CanvasRenderingContext2D, region: CanvasRegion, skipStroke: boolean = false) => {
    const isSelected = region.selected;

    // Check if this region has a drag preview
    const preview = dragPreview?.regionId === region.id ? dragPreview : null;

    // Use preview data if available, otherwise use region data
    const effectiveRegion = preview
      ? {
          ...region,
          x: preview.x ?? region.x,
          y: preview.y ?? region.y,
          width: preview.width ?? region.width,
          height: preview.height ?? region.height,
          pathPoints: preview.pathPoints ?? region.pathPoints,
          bezierControlPoints: preview.bezierControlPoints ?? region.bezierControlPoints,
        }
      : region;

    if (effectiveRegion.regionType === "path" && effectiveRegion.pathPoints && effectiveRegion.pathPoints.length > 2) {
      // Handle path region rendering
      drawPathRegion(ctx, effectiveRegion, isSelected, skipStroke);
    } else {
      // Handle rectangle region rendering
      drawRectangleRegion(ctx, effectiveRegion, isSelected, skipStroke);
    }

    // Only show handles and selection in edit mode
    if (isSelected && renderingMode === "edit") {
      if (region.regionType === "path") {
        drawPathHandles(ctx, region);
      } else {
        drawRegionHandles(ctx, region);
      }
    }
  };

  // Function to draw path regions
  const drawPathRegion = (
    ctx: CanvasRenderingContext2D,
    region: CanvasRegion,
    isSelected: boolean,
    skipStroke: boolean = false,
  ) => {
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
            ctx.bezierCurveTo(controls.cp1.x, controls.cp1.y, controls.cp2.x, controls.cp2.y, p2.x, p2.y);
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
              ctx.bezierCurveTo(controls.cp1.x, controls.cp1.y, controls.cp2.x, controls.cp2.y, p2.x, p2.y);
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
      ctx.fillStyle = region.backgroundColor || region.color || "rgba(100, 100, 100, 0.3)";
      ctx.fill();
    }

    // Draw path outline (skip in edit mode when negative space handles it)
    if (!skipStroke) {
      ctx.strokeStyle = isSelected ? "#ffffff" : "#666666";
      ctx.lineWidth = (isSelected ? 3 : 2) / transform.zoom;
      ctx.stroke();
    }

    ctx.restore();

    // Draw region-specific grid (only if visible)
    if (region.gridType !== "free" && region.gridVisible) {
      drawRegionGrid(ctx, region);
    }

    // Draw transformation handles based on mode (handles themselves drawn in parent)
    if (isSelected) {
      // Transform handles removed - now using classic resize/rotate handles only
    }

  };

  // Function to draw rectangle regions
  const drawRectangleRegion = (
    ctx: CanvasRenderingContext2D,
    region: CanvasRegion,
    isSelected: boolean,
    skipStroke: boolean = false,
  ) => {
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
      ctx.fillStyle = region.backgroundColor || region.color || "rgba(100, 100, 100, 0.3)";
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
    if (region.gridType !== "free" && region.gridVisible) {
      drawRegionGrid(ctx, region);
    }

    // Draw region border (skip in edit mode when negative space handles it)
    if (!skipStroke) {
      ctx.strokeStyle = isSelected ? "#ffffff" : "#666666";
      ctx.lineWidth = (isSelected ? 2 : 1) / transform.zoom;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
    }


    ctx.restore();

    // Draw transformation handles based on mode (handles themselves drawn in parent)
    if (isSelected) {
      // Transform handles removed - now using classic resize/rotate handles only
    }
  };
  // Function to draw region background image (optimized with pattern caching)
  const drawRegionBackground = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    if (!region.backgroundImage) return;

    let img = imageCache.current.get(region.backgroundImage);

    if (!img) {
      // Create and cache new image
      img = new Image();
      img.crossOrigin = "anonymous";
      imageCache.current.set(region.backgroundImage, img);

      // Only set up onload for new images
      img.onload = () => {
        // Invalidate any cached patterns for this image since it just loaded
        texturePatternCache.invalidateImage(region.backgroundImage!);
        // Trigger re-render when image loads
        setImageLoadCounter(c => c + 1);
      };
      
      img.onerror = () => {
        console.warn('Failed to load region background image:', region.backgroundImage?.substring(0, 50));
      };

      img.src = region.backgroundImage;
      
      // Draw placeholder while loading (blue = loading)
      ctx.fillStyle = "rgba(100, 100, 200, 0.5)";
      ctx.fillRect(region.x, region.y, region.width, region.height);
      return;
    }

    // Only draw if image is fully loaded with valid dimensions
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      // Draw placeholder while loading (green = waiting for dimensions)
      ctx.fillStyle = "rgba(100, 200, 100, 0.5)";
      ctx.fillRect(region.x, region.y, region.width, region.height);
      return;
    }

    // Calculate bounds - for path regions use bounding box from pathPoints
    let x = region.x;
    let y = region.y;
    let width = region.width;
    let height = region.height;

    if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 0) {
      const xs = region.pathPoints.map(p => p.x);
      const ys = region.pathPoints.map(p => p.y);
      x = Math.min(...xs);
      y = Math.min(...ys);
      width = Math.max(...xs) - x;
      height = Math.max(...ys) - y;
    }

    const offsetX = region.backgroundOffsetX || 0;
    const offsetY = region.backgroundOffsetY || 0;
    const scale = region.backgroundScale || 1;
    const repeat = region.backgroundRepeat || "repeat";

    // Calculate scaled image dimensions
    const scaledWidth = Math.max(1, img.naturalWidth * scale);
    const scaledHeight = Math.max(1, img.naturalHeight * scale);

    if (repeat === "no-repeat") {
      // For no-repeat, draw the scaled image once at the offset position
      ctx.drawImage(img, x + offsetX, y + offsetY, scaledWidth, scaledHeight);
    } else {
      // Use cached pattern for repeat modes (major performance optimization)
      const pattern = texturePatternCache.getPattern(
        ctx,
        img,
        region.backgroundImage,
        scale,
        repeat
      );
      
      if (pattern) {
        // Apply world-space positioning for continuous texture tiling
        // offsetX/offsetY are pre-calculated to align with world origin (0,0)
        // This ensures textures appear continuous across multiple regions
        const matrix = new DOMMatrix();
        // Translate pattern to start at region's top-left with the calculated offset
        matrix.translateSelf(x + offsetX, y + offsetY);
        pattern.setTransform(matrix);

        ctx.fillStyle = pattern;
        // Fill the region area with enough padding for the offset
        ctx.fillRect(x - scaledWidth, y - scaledHeight, width + scaledWidth * 2, height + scaledHeight * 2);
      }
    }
  };

  // Function to draw grid within a region
  const drawRegionGrid = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    ctx.save();

    // Clip to region bounds - handle both rectangle and path regions
    if (region.regionType === "path" && region.pathPoints && region.pathPoints.length > 2) {
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
            ctx.bezierCurveTo(controls.cp1.x, controls.cp1.y, controls.cp2.x, controls.cp2.y, p2.x, p2.y);
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

    ctx.strokeStyle = region.gridType === "square" ? "#4f46e5" : "#06b6d4";
    ctx.lineWidth = 1 / transform.zoom;
    ctx.globalAlpha = 0.6;

    if (region.gridType === "square") {
      drawSquareGrid(ctx, region);
    } else if (region.gridType === "hex") {
      drawHexGrid(ctx, region);
    }

    ctx.restore();
  };

  // Function to draw highlighted grids
  const drawHighlightedGrids = (ctx: CanvasRenderingContext2D) => {
    if (highlightedGrids.length === 0) return;

    ctx.save();

    highlightedGrids.forEach((regionHighlight) => {
      const region = regions.find((r) => r.id === regionHighlight.regionId);
      if (!region) return;

      // Skip highlights for region being dragged
      if (isDraggingRegion && draggedRegionId === region.id) return;

      // Draw highlighted hexes
      regionHighlight.hexes.forEach((hex) => {
        ctx.fillStyle = "rgba(255, 255, 0, 0.3)"; // Yellow highlight
        ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
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
      regionHighlight.squares.forEach((square) => {
        ctx.fillStyle = "rgba(255, 255, 0, 0.3)"; // Yellow highlight
        ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
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
        if (
          hexX >= region.x - hexRadius &&
          hexX <= region.x + region.width + hexRadius &&
          hexY >= region.y - hexRadius &&
          hexY <= region.y + region.height + hexRadius
        ) {
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

    ctx.fillStyle = "#4f46e5";
    ctx.strokeStyle = "#ffffff";
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

    handles.forEach((handle) => {
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });

    // Draw rotation handle - positioned above the region
    const rotationHandleDistance = 30 / transform.zoom;
    const rotationX = x + width / 2;
    const rotationY = y - rotationHandleDistance;

    // Draw connection line from region to rotation handle
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 2 / transform.zoom;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(rotationX, rotationY);
    ctx.stroke();

    // Draw rotation handle (circular)
    ctx.fillStyle = "#10b981"; // Different color for rotation handle
    ctx.strokeStyle = "#ffffff";
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
    const cos = Math.cos((angle * Math.PI) / 180);
    const sin = Math.sin((angle * Math.PI) / 180);
    const nx = cos * (px - cx) + sin * (py - cy) + cx;
    const ny = cos * (py - cy) - sin * (px - cx) + cy;
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
      ctx.strokeStyle = "#666666";
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
          ctx.fillStyle = "#4ecdc4";
          ctx.strokeStyle = "#ffffff";
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
    ctx.fillStyle = "#ff6b6b";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 / transform.zoom;

    region.pathPoints.forEach((point, index) => {
      // Draw control node as circle
      ctx.beginPath();
      ctx.arc(point.x, point.y, handleSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw node index for clarity
      ctx.fillStyle = "#ffffff";
      ctx.font = `${8 / transform.zoom}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(index.toString(), point.x, point.y);

      // Reset fill style for next node
      ctx.fillStyle = "#ff6b6b";
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
      color: "rgba(100, 150, 200, 0.3)",
      gridType: "free",
      gridSize: 40, // Match main canvas grid size
      gridScale: 1.0, // Default scale
      gridSnapping: false, // Default to disabled per-region
      gridVisible: true, // Default to visible
      regionType: "rectangle", // Default to rectangle
    };

    addRegion(newRegion);
    toast.success("Region added to viewport center");
  };

  // Function to start path drawing mode
  const startPathDrawing = (type: "polygon" | "freehand" = "polygon") => {
    setPathDrawingMode("drawing");
    setPathDrawingType(type);
    setCurrentPath([]);
    if (type === "polygon") {
      toast.info("Click to add points. Double-click to finish.");
    } else {
      toast.info("Click and drag to draw freehand. Release to finish.");
    }
  };

  // Function to finish path drawing and create region
  const finishPathDrawing = () => {
    if (currentPath.length < 3) {
      toast.error("Path must have at least 3 points");
      setPathDrawingMode("none");
      setCurrentPath([]);
      setIsFreehandDrawing(false);
      setLastFreehandPoint(null);
      return;
    }

    // Simplify the path if it's freehand
    let finalPath = currentPath;
    if (pathDrawingType === "freehand") {
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
    const bezierControls = pathDrawingType === "freehand" ? generateBezierControlPoints(finalPath) : undefined;
    const bounds = bezierControls ? getBezierBounds(finalPath, bezierControls) : getPolygonBounds(finalPath);
    const newRegion: CanvasRegion = {
      id: `path-region-${Date.now()}`,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      selected: false,
      color: "rgba(100, 150, 200, 0.3)",
      gridType: "free",
      gridSize: 40,
      gridScale: 1.0,
      gridSnapping: false,
      gridVisible: true,
      regionType: "path",
      pathPoints: [...finalPath],
      bezierControlPoints: bezierControls,
      smoothing: bezierControls ? true : undefined, // Enable smoothing for freehand paths with curves
    };

    addRegion(newRegion);
    setPathDrawingMode("none");
    setPathDrawingType("polygon");
    setCurrentPath([]);
    setIsFreehandDrawing(false);
    setLastFreehandPoint(null);
    toast.success("Path region created");
  };

  // Function to check if point is in any region (supports both rect and path)
  const isPointInRegion = (x: number, y: number, region: CanvasRegion): boolean => {
    if (region.regionType === "path" && region.pathPoints) {
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
        { x: region.x, y: region.y + region.height },
      ];

      // Rotate corners around center
      const rotatedCorners = corners.map((corner) => ({
        x: centerX + (corner.x - centerX) * Math.cos(angle) - (corner.y - centerY) * Math.sin(angle),
        y: centerY + (corner.x - centerX) * Math.sin(angle) + (corner.y - centerY) * Math.cos(angle),
      }));

      return isPointInPolygon({ x, y }, rotatedCorners);
    } else {
      // Rectangle region (default behavior)
      return x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
    }
  };

  const drawToken = (ctx: CanvasRenderingContext2D, token: any, isInFog: boolean = false) => {
    const baseTokenSize = 40; // Base size for 1x1 token
    // Use the larger dimension for circular token radius
    const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
    const radius = tokenSize / 2;
    const isSelected = selectedTokenIds.includes(token.id);
    const isHovered = hoveredTokenId === token.id;

    // Performance optimization: Create a simple hash of token's visual state
    // If state hasn't changed, we can potentially skip some computations
    const visualStateHash = `${token.x},${token.y},${token.color},${isSelected},${isHovered},${token.roleId},${isInFog}`;
    const cached = tokenDrawCache.current.get(token.id);
    const now = Date.now();

    // Cache validity check (invalidate after 100ms to keep animations smooth)
    const isCacheValid = cached && cached.data === visualStateHash && now - cached.lastDrawn < 100;

    if (!isCacheValid) {
      tokenDrawCache.current.set(token.id, {
        lastDrawn: now,
        data: visualStateHash,
      });
    }

    // Get current player for permission checks
    const tokenPlayer = players.find((p) => p.id === currentPlayerId);

    // Check permissions and relationships
    const isControllable = tokenPlayer ? canControlToken(token, tokenPlayer, roles) : false;
    const relationship = tokenPlayer ? getTokenRelationship(token, tokenPlayer, roles) : "neutral";
    const isHostile = relationship === "hostile";

    // Get role color for border
    const role = roles.find((r) => r.id === token.roleId);
    const roleBorderColor = role?.color || "#000000";

    // Check if this is the active token in combat
    const currentEntry = initiativeOrder[currentTurnIndex];
    const isActiveInCombat = isInCombat && currentEntry?.tokenId === token.id;

    // Apply semi-transparency for DM viewing fog-covered tokens
    ctx.save();
    if (isInFog) {
      ctx.globalAlpha = 0.4;
    }

    // Draw hostile pulsing indicator (animated red border)
    if (isHostile && !isInFog) {
      const pulseTime = Date.now() / 500;
      const pulseIntensity = (Math.sin(pulseTime) + 1) / 2; // Oscillates between 0 and 1

      ctx.save();
      // Outer pulsing red glow
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 + pulseIntensity * 0.4})`; // Red with pulsing opacity
      ctx.lineWidth = (5 + pulseIntensity * 2) / transform.zoom;
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius + 5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Draw active combat highlight (pulsing gold glow)
    if (isActiveInCombat && !isInFog) {
      ctx.save();
      // Outer glow
      ctx.strokeStyle = "rgba(255, 215, 0, 0.6)"; // Gold
      ctx.lineWidth = 6 / transform.zoom;
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius + 6, 0, 2 * Math.PI);
      ctx.stroke();

      // Inner glow
      ctx.strokeStyle = "rgba(255, 215, 0, 0.8)";
      ctx.lineWidth = 3 / transform.zoom;
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius + 3, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Draw controllability hover glow (green/blue glow when hovering over controllable token)
    if (isHovered && isControllable && !isDraggingToken && !isInFog) {
      ctx.save();
      const glowColor = relationship === "friendly" ? "rgba(34, 197, 94, 0.6)" : "rgba(59, 130, 246, 0.6)"; // Green for friendly, blue for own
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 4 / transform.zoom;
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius + 4, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Draw selection highlight
    if (isSelected) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius + 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw main token (image or color fill)
    const tokenImg = token.imageUrl ? getCachedImage(token.imageUrl) : null;
    
    if (tokenImg) {
      // Draw circular clipped image
      ctx.save();
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius, 0, 2 * Math.PI);
      ctx.clip();
      
      // Draw image centered and scaled to fit
      const size = radius * 2;
      ctx.drawImage(tokenImg, token.x - radius, token.y - radius, size, size);
      ctx.restore();
      
      // Draw border on top
      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3 / transform.zoom;
      } else if (isHostile) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3 / transform.zoom;
      } else {
        ctx.strokeStyle = roleBorderColor;
        ctx.lineWidth = 2 / transform.zoom;
      }
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else {
      // Fallback to color fill
      ctx.fillStyle = token.color || "#ffffff";
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Draw token border with role color
      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3 / transform.zoom;
      } else if (isHostile) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3 / transform.zoom;
      } else {
        ctx.strokeStyle = roleBorderColor;
        ctx.lineWidth = 2 / transform.zoom;
      }
      ctx.stroke();
    }

    // Draw token label based on position setting
    const displayText = token.label || token.name;
    if (displayText) {
      const labelPos = token.labelPosition || 'below';
      ctx.fillStyle = "#000000";
      ctx.font = `${12 / transform.zoom}px Arial`;
      ctx.textAlign = "center";
      
      if (labelPos === 'center') {
        ctx.textBaseline = "middle";
        ctx.fillText(displayText, token.x, token.y);
      } else if (labelPos === 'above') {
        ctx.textBaseline = "bottom";
        ctx.fillText(displayText, token.x, token.y - radius - 4 / transform.zoom);
      } else {
        // below (default)
        ctx.textBaseline = "top";
        ctx.fillText(displayText, token.x, token.y + radius + 4 / transform.zoom);
      }
    }

    ctx.restore();
  };

  // Function to draw off-screen token indicator
  const drawOffScreenIndicator = (
    ctx: CanvasRenderingContext2D,
    token: any,
    viewX: number,
    viewY: number,
    viewWidth: number,
    viewHeight: number,
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

    const minDist = Math.min(normalizedX < 0 ? leftDist : rightDist, normalizedY < 0 ? topDist : bottomDist);

    edgeX = centerX + normalizedX * minDist;
    edgeY = centerY + normalizedY * minDist;

    // Clamp to viewport bounds
    edgeX = Math.max(margin, Math.min(canvas.width - margin, edgeX));
    edgeY = Math.max(margin, Math.min(canvas.height - margin, edgeY));

    // Draw indicator rectangle
    ctx.fillStyle = token.color || "#ffffff";
    ctx.strokeStyle = "#000000";
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
    const overlayCanvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (overlayCanvas) {
      overlayCanvas.width = rect.width;
      overlayCanvas.height = rect.height;
    }
    setCanvasDimensions({ width: rect.width, height: rect.height });

    // Initial draw
    redrawCanvas();

    toast.success(
      "Pan/Zoom Tabletop Ready! Controls: Left-click=select, Shift+click=add token, Right-click=pan, Scroll=zoom, Right-click token=menu",
    );

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      if (overlayCanvas) {
        overlayCanvas.width = rect.width;
        overlayCanvas.height = rect.height;
      }
      setCanvasDimensions({ width: rect.width, height: rect.height });
      redrawCanvas();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Redraw when transform, tokens, regions, path, or combat state changes
  useEffect(() => {
    redrawCanvas();
  }, [transform, tokens, regions, currentPath, isInCombat, currentTurnIndex, imageLoadCounter]);

  // Animation loop for hostile tokens, hover effects, and illumination animations
  const animationsPaused = useUiModeStore((state) => state.animationsPaused);
  
  useEffect(() => {
    // If animations are paused or in edit mode, don't run the loop
    // Edit mode needs stable rendering for region controls
    if (animationsPaused || renderingMode === 'edit') return;
    
    const currentPlayer = players.find((p) => p.id === currentPlayerId);

    // Check if there are any hostile tokens
    const hasHostileTokens = currentPlayer ? tokens.some((token) => {
      const relationship = getTokenRelationship(token, currentPlayer, roles);
      return relationship === "hostile";
    }) : false;
    
    // Check if there are any animated illumination sources (on tokens or standalone)
    const hasAnimatedIllumination = tokens.some((token) => 
      token.illuminationSources?.some((source) => source.animation && source.animation !== 'none')
    );

    // Only run animation loop if there's something to animate
    if (!hasHostileTokens && !hoveredTokenId && !hasAnimatedIllumination) return;

    // Set up throttled animation loop (limit to ~30 FPS)
    let animationId: number;
    let lastFrameTime = 0;
    const frameDelay = 1000 / 30; // ~30 FPS

    const animate = (currentTime: number) => {
      // Throttle to reduce CPU usage
      if (currentTime - lastFrameTime >= frameDelay) {
        redrawCanvas();
        lastFrameTime = currentTime;
      }
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
    // Include transform in dependencies so animation loop recreates with fresh transform values
    // This prevents stale closures causing "snap" zoom behavior when hovering over tokens
  }, [tokens, hoveredTokenId, players, currentPlayerId, roles, transform, animationsPaused, renderingMode]);

  // Add click handler to place tokens or select them
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 && !isPanning && !isDraggingToken) {
      // Left click and not panning/dragging
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
          setSelectedTokenIds((prev) =>
            prev.includes(clickedToken.id) ? prev.filter((id) => id !== clickedToken.id) : [...prev, clickedToken.id],
          );
        } else {
          // Normal click: select only this token
          setSelectedTokenIds([clickedToken.id]);
        }
      } else if (clickedRegion) {
        // Only allow region selection in edit mode
        if (renderingMode === "edit") {
          // Check if clicking on rotation handle of an already selected region
          if (clickedRegion.selected && isOverRotationHandle(worldPos.x, worldPos.y, clickedRegion)) {
            // Don't deselect if clicking on rotation handle - let it handle rotation
            return;
          }

          // Region selection logic - handle multi-select with shift key
          if (e.shiftKey) {
            // Shift+click: toggle region in selection
            if (selectedRegionIds.includes(clickedRegion.id)) {
              setSelectedRegionIds(prev => prev.filter(id => id !== clickedRegion.id));
              deselectRegion(clickedRegion.id);
            } else {
              setSelectedRegionIds(prev => [...prev, clickedRegion.id]);
              selectRegion(clickedRegion.id);
            }
          } else {
            // Normal click: single select, deselect others
            clearSelection();
            selectRegion(clickedRegion.id);
            setSelectedRegionIds([clickedRegion.id]);
          }
          setSelectedTokenIds([]); // Deselect tokens when selecting region
        }
        // In play mode, clicking regions does nothing
      } else {
        // Clicked on empty space
        if (e.shiftKey) {
          // Shift+click: add token at clicked position
          addTokenToCanvas("", worldPos.x, worldPos.y);
        } else if (renderingMode === 'edit') {
          // In edit mode: start marquee selection
          setIsMarqueeSelecting(true);
          setMarqueeStart(worldPos);
          setMarqueeEnd(worldPos);
          // Clear existing selection when starting new marquee
          selectedRegionIds.forEach(id => deselectRegion(id));
          setSelectedRegionIds([]);
          setSelectedTokenIds([]);
        } else {
          // Play mode: just deselect
          setSelectedTokenIds([]);
          clearSelection();
          setSelectedRegionIds([]);
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

    // In play mode with fog enabled, check visibility before showing context menus
    const isPlayMode = renderingMode === 'play';
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    
    if (isPlayMode && fogEnabled && currentPlayer) {
      // Check if player has DM-level permissions to bypass fog
      const hasFogBypass = roles.some(role => 
        currentPlayer.roleIds.includes(role.id) && role.permissions.canSeeAllFog
      );
      
      if (!hasFogBypass) {
        const point = { x: worldPos.x, y: worldPos.y };
        const isVisible = isPointInVisibleArea(point, currentVisibilityRef.current);
        const isExplored = exploredAreaRef.current 
          ? isPointInRevealedArea(point, exploredAreaRef.current, currentVisibilityRef.current)
          : false;
        
        // For tokens and regions hidden by fog, block context menu for players
        if (!isVisible && !isExplored) {
          return; // Block context menu entirely
        }
      }
    }

    if (clickedToken) {
      // Dispatch custom event for TokenContextManager
      const event = new CustomEvent("showTokenContextMenu", {
        detail: {
          tokenId: clickedToken.id,
          x: e.clientX,
          y: e.clientY,
        },
      });
      window.dispatchEvent(event);
    } else if (clickedRegion) {
      // Show region context menu
      showRegionContextMenu(e.clientX, e.clientY, clickedRegion);
    }
  };

  // Function to open Region Controls card for a specific region
  const openRegionControlsCard = (regionId: string) => {
    // Set the active region ID for the card
    setActiveRegionControlId(regionId);

    // Check if REGION_CONTROL card exists
    const existingCard = getCardByType(CardType.REGION_CONTROL);

    if (existingCard) {
      // If card exists, make it visible and bring to front
      setVisibility(existingCard.id, true);
      bringToFront(existingCard.id);
    } else {
      // Register a new REGION_CONTROL card
      registerCard({
        type: CardType.REGION_CONTROL,
        title: "Region Controls",
        defaultPosition: { x: window.innerWidth - 380, y: 100 },
        defaultSize: { width: 350, height: 600 },
        minSize: { width: 300, height: 400 },
        isResizable: true,
        isClosable: true,
        defaultVisible: true,
      });
    }
  };

  // Function to show region context menu
  const showRegionContextMenu = (x: number, y: number, region: CanvasRegion) => {
    // Remove any existing context menu safely
    const existingMenu = document.querySelector(".region-context-menu");
    if (existingMenu && document.body.contains(existingMenu)) {
      document.body.removeChild(existingMenu);
    }

    const menu = document.createElement("div");
    menu.className = "region-context-menu fixed bg-popover border border-border rounded-md shadow-lg p-1";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.zIndex = `${Z_INDEX.DROPDOWNS.MENU}`;

    const menuItems = [
      {
        label: "Edit Background",
        icon: "🖼️",
        action: () => {
          setSelectedRegionForEdit(region);
          setIsRegionBackgroundModalOpen(true);
        },
      },
      {
        label: "Region Controls",
        icon: "⚙️",
        action: () => openRegionControlsCard(region.id),
      },
      { type: "separator" },
      {
        label: "Free Grid",
        icon: "📐",
        action: () => setRegionGridType(region.id, "free"),
        active: region.gridType === "free",
      },
      {
        label: "Square Grid",
        icon: "⬜",
        action: () => setRegionGridType(region.id, "square"),
        active: region.gridType === "square",
      },
      {
        label: "Hex Grid",
        icon: "⬢",
        action: () => setRegionGridType(region.id, "hex"),
        active: region.gridType === "hex",
      },
      { type: "separator" },
      {
        label: "Delete Region",
        icon: "🗑️",
        action: () => deleteSelectedRegion(region.id),
        danger: true,
      },
    ] as const;

    menuItems.forEach((item) => {
      if ("type" in item && item.type === "separator") {
        const separator = document.createElement("div");
        separator.className = "my-1 h-px bg-border";
        menu.appendChild(separator);
        return;
      }

      const menuItem = document.createElement("div");
      menuItem.className = `px-3 py-2 text-sm cursor-pointer hover:bg-accent rounded flex items-center gap-2 ${
        "danger" in item && item.danger ? "text-destructive" : ""
      } ${"active" in item && item.active ? "bg-accent font-medium" : ""}`;
      menuItem.innerHTML = `<span>${"icon" in item ? item.icon : ""}</span> ${"label" in item ? item.label : ""}${"active" in item && item.active ? " ✓" : ""}`;
      menuItem.onclick = () => {
        if ("action" in item) item.action();
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
        document.removeEventListener("click", removeMenu);
      }
    };

    setTimeout(() => {
      document.addEventListener("click", removeMenu);
    }, 100);
  };

  // Function to set region grid type
  const setRegionGridType = (regionId: string, gridType: "square" | "hex" | "free") => {
    updateRegion(regionId, { gridType });
    toast.success(`Region grid set to ${gridType}`);
  };

  // Function to toggle region snapping
  const toggleRegionSnapping = (regionId: string) => {
    const targetRegion = regions.find((r) => r.id === regionId);
    if (targetRegion) {
      const newState = !targetRegion.gridSnapping;
      updateRegion(regionId, { gridSnapping: newState });
      toast.success(`Region snapping ${newState ? "enabled" : "disabled"}`);
    }
  };

  // Function to toggle region grid visibility
  const toggleRegionGridVisibility = (regionId: string) => {
    const targetRegion = regions.find((r) => r.id === regionId);
    if (targetRegion) {
      const newState = !targetRegion.gridVisible;
      updateRegion(regionId, { gridVisible: newState });
      toast.success(`Region grid ${newState ? "shown" : "hidden"}`);
    }
  };

  // Function to delete region
  const deleteSelectedRegion = (regionId: string) => {
    removeRegion(regionId);
    if (selectedRegionIds.includes(regionId)) {
      setSelectedRegionIds(prev => prev.filter(id => id !== regionId));
    }
    toast.success("Region deleted");
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);

    if (e.button === 2) {
      // Right click
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0) {
      // Left click
      // Handle path drawing mode
      if (pathDrawingMode === "drawing") {
        if (pathDrawingType === "polygon") {
          // Polygon mode: Add point on click
          setCurrentPath((prev) => [...prev, { x: worldPos.x, y: worldPos.y }]);
          return;
        } else {
          // Freehand mode: Start drawing on mouse down
          setIsFreehandDrawing(true);
          setCurrentPath([{ x: worldPos.x, y: worldPos.y }]);
          return;
        }
      }

      // Handle path editing mode - only for single selection
      if (pathDrawingMode === "editing" && selectedRegionIds.length === 1) {
        const selectedRegion = regions.find((r) => r.id === selectedRegionIds[0]);
        if (selectedRegion && selectedRegion.regionType === "path" && selectedRegion.pathPoints) {
          // Check if clicking on a Bezier control point first
          if (selectedRegion.bezierControlPoints) {
            const tolerance = 15 / transform.zoom;
            for (let i = 0; i < selectedRegion.bezierControlPoints.length; i++) {
              const controls = selectedRegion.bezierControlPoints[i];

              // Check first control point
              const distCp1 = Math.sqrt((worldPos.x - controls.cp1.x) ** 2 + (worldPos.y - controls.cp1.y) ** 2);
              if (distCp1 <= tolerance) {
                setEditingControlPointIndex({ segmentIndex: i, isFirst: true });
                redrawCanvas();
                return;
              }

              // Check second control point
              if (i < selectedRegion.pathPoints.length - 1) {
                const distCp2 = Math.sqrt((worldPos.x - controls.cp2.x) ** 2 + (worldPos.y - controls.cp2.y) ** 2);
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

      // PRIORITY 1: Check for annotation clicks (markers)
      // In play mode with fog, only allow clicking annotations in revealed areas
      const clickedAnnotation = annotations.find((ann) => {
        const dx = worldPos.x - ann.position.x;
        const dy = worldPos.y - ann.position.y;
        const radius = 12;
        if (Math.sqrt(dx * dx + dy * dy) > radius) return false;
        
        // In play mode with fog enabled, check if annotation is in revealed area
        // DM role can bypass based on dmFogVisibility setting
        if (renderingMode === 'play' && fogEnabled && !fogRevealAll) {
          const annotationPoint = { x: ann.position.x, y: ann.position.y };
          const isRevealed = isPointInRevealedArea(
            annotationPoint,
            exploredAreaRef.current,
            currentVisibilityRef.current
          );
          if (!isRevealed) {
            // Annotation is in fog - check DM visibility setting
            if (!isDM || dmFogVisibility === 'hidden') {
              return false; // Not DM, or DM chose hidden mode
            }
            // DM with 'semi-transparent' or 'full' mode can interact
          }
        }
        
        return true;
      });

      if (clickedAnnotation) {
        setSelectedAnnotationId(selectedAnnotationId === clickedAnnotation.id ? null : clickedAnnotation.id);
        setSelectedTokenIds([]);
        setSelectedRegionIds([]);
        return;
      }

      // PRIORITY 2: Check for ANY handle on selected region first
      // This prevents deselection when clicking handles outside the shape boundary
      // But only in edit mode - no region manipulation in play mode
      // Only works for single selection
      if (selectedRegionIds.length === 1 && renderingMode === "edit") {
        const selectedRegion = regions.find((r) => r.id === selectedRegionIds[0] && r.selected);
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
            const tokensInRegion: { tokenId: string; startX: number; startY: number }[] = [];
            tokens.forEach((token) => {
              if (isPointInRegion(token.x, token.y, selectedRegion)) {
                tokensInRegion.push({
                  tokenId: token.id,
                  startX: token.x,
                  startY: token.y,
                });
              }
            });
            setGroupedTokens(tokensInRegion);
            return;
          }
        }
      }


      // PRIORITY 2: Check what we're clicking on for dragging (tokens first, then regions)
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      const clickedRegion = getRegionAtPosition(worldPos.x, worldPos.y);

      if (clickedToken) {
        // Check if movement is restricted
        if (restrictMovement) {
          if (isInCombat) {
            // In combat: only active token can move
            const currentEntry = initiativeOrder[currentTurnIndex];
            if (currentEntry?.tokenId !== clickedToken.id) {
              toast.error("Can only move the active token during their turn");
              return;
            }
          } else {
            // Out of combat: no token movement allowed (GM only mode)
            toast.error("Token movement is locked. Unlock to move tokens.");
            return;
          }
        }

        setIsDraggingToken(true);
        setDraggedTokenId(clickedToken.id);
        setDragOffset({
          x: worldPos.x - clickedToken.x,
          y: worldPos.y - clickedToken.y,
        });

        // Store original position for ghost and path
        setDragStartPos({ x: clickedToken.x, y: clickedToken.y });
        setDragPath([{ x: clickedToken.x, y: clickedToken.y }]);
        
        // Capture stable visibility snapshot at drag start to prevent flashing
        if (currentVisibilityRef.current) {
          stableVisibilityRef.current = currentVisibilityRef.current.clone({ insert: false }) as paper.Path;
        }
        
        // Capture initial state for undo
        setInitialTokenState({ id: clickedToken.id, x: clickedToken.x, y: clickedToken.y });

        // If token not selected, select it
        if (!selectedTokenIds.includes(clickedToken.id)) {
          setSelectedTokenIds([clickedToken.id]);
        }
      } else if (clickedRegion && clickedRegion.selected && renderingMode === "edit") {
        // Only allow region manipulation in edit mode
        // Check if we're clicking on a rotation handle first
        if (isOverRotationHandle(worldPos.x, worldPos.y, clickedRegion)) {
          setIsRotatingRegion(true);
          setDraggedRegionId(clickedRegion.id);
          
          // Capture initial state for undo
          setInitialRegionState(captureRegionTransformState(clickedRegion));
          setTransformingRegionId(clickedRegion.id);

          // Calculate starting angle from region center to mouse
          const centerX = clickedRegion.x + clickedRegion.width / 2;
          const centerY = clickedRegion.y + clickedRegion.height / 2;
          setRotationStartAngle(calculateAngle(centerX, centerY, worldPos.x, worldPos.y));

          // Group tokens inside the region for rotation
          const tokensInRegion: { tokenId: string; startX: number; startY: number }[] = [];
          tokens.forEach((token) => {
            if (isPointInRegion(token.x, token.y, clickedRegion)) {
              tokensInRegion.push({
                tokenId: token.id,
                startX: token.x,
                startY: token.y,
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
            
            // Capture initial state for undo
            setInitialRegionState(captureRegionTransformState(clickedRegion));
            setTransformingRegionId(clickedRegion.id);
          } else {
            // Start dragging the region - group tokens for smooth movement
            setIsDraggingRegion(true);
            setDraggedRegionId(clickedRegion.id);
            
            // Capture stable visibility snapshot at drag start to prevent flashing
            if (currentVisibilityRef.current) {
              stableVisibilityRef.current = currentVisibilityRef.current.clone({ insert: false }) as paper.Path;
            }
            
            // Capture initial state for undo
            setInitialRegionState(captureRegionTransformState(clickedRegion));
            setTransformingRegionId(clickedRegion.id);

            if (clickedRegion.regionType === "path" && clickedRegion.pathPoints) {
              // For path regions, use the bounding box origin as reference
              setRegionDragOffset({
                x: worldPos.x - clickedRegion.x,
                y: worldPos.y - clickedRegion.y,
              });
            } else {
              // For rectangle regions, use the top-left corner
              setRegionDragOffset({
                x: worldPos.x - clickedRegion.x,
                y: worldPos.y - clickedRegion.y,
              });
            }

            // Group tokens inside the region for smooth dragging
            const tokensInRegion: { tokenId: string; startX: number; startY: number }[] = [];
            tokens.forEach((token) => {
              if (isPointInRegion(token.x, token.y, clickedRegion)) {
                tokensInRegion.push({
                  tokenId: token.id,
                  startX: token.x,
                  startY: token.y,
                });
              }
            });

            setGroupedTokens(tokensInRegion);
            setTokensMovedByRegion(tokensInRegion.map((t) => t.tokenId));
          }
        }
      } else if (lightPlacementMode && renderingMode === "edit") {
        // Light placement mode - add light source at click location
        const colors = ["#ffaa00", "#00ff88", "#0088ff", "#ff00ff", "#ffff00", "#ff0066"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        addLight({
          position: { x: worldPos.x, y: worldPos.y },
          color: randomColor,
          intensity: 0.8,
          radius: 200, // World space units
          enabled: true,
          label: `Light ${lights.length + 1}`,
        });

        toast.success("Light source placed");
        setLightPlacementMode(false);
      } else if (e.shiftKey && renderingMode === "edit") {
        // Shift+click to remove light sources in edit mode
        const clickedLight = lights.find((light) => {
          if (!light.enabled) return false;
          const dx = light.position.x - worldPos.x;
          const dy = light.position.y - worldPos.y;
          return Math.sqrt(dx * dx + dy * dy) < 20 / transform.zoom; // Click tolerance
        });

        if (clickedLight) {
          removeLight(clickedLight.id);
          toast.success("Light source removed");
        } else {
          // No light clicked, handle as normal shift+click (token creation)
          handleCanvasClick(e);
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
    if (isFreehandDrawing && pathDrawingMode === "drawing" && pathDrawingType === "freehand") {
      const worldPos = screenToWorld(mouseX, mouseY);

      // Only add point if it's far enough from the last point (throttling)
      const minDistance = 5; // Minimum distance between points in world coordinates
      if (
        !lastFreehandPoint ||
        Math.sqrt((worldPos.x - lastFreehandPoint.x) ** 2 + (worldPos.y - lastFreehandPoint.y) ** 2) >= minDistance
      ) {
        // Limit max points during drawing to prevent memory issues
        setCurrentPath((prev) => {
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

    // Handle marquee selection dragging
    if (isMarqueeSelecting && marqueeStart) {
      const worldPos = screenToWorld(mouseX, mouseY);
      setMarqueeEnd(worldPos);
      redrawCanvas();
      return;
    }

    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;

      setTransform((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (isDraggingToken && draggedTokenId) {
      // Token dragging
      const worldPos = screenToWorld(mouseX, mouseY);
      const newX = worldPos.x - dragOffset.x;
      const newY = worldPos.y - dragOffset.y;

      // Get the dragged token to access its size
      const draggedToken = tokens.find((t) => t.id === draggedTokenId);
      const tokenGridWidth = draggedToken?.gridWidth || 1;
      const tokenGridHeight = draggedToken?.gridHeight || 1;

      // Update grid highlights based on token position and size
      updateGridHighlights(newX, newY, tokenGridWidth, tokenGridHeight);

      // Add point to drag path (sample every few pixels for smoother path)
      const lastPoint = dragPath[dragPath.length - 1];
      const distance = Math.sqrt((newX - lastPoint.x) ** 2 + (newY - lastPoint.y) ** 2);
      if (distance > 10) {
        // Sample every 10 world units
        setDragPath((prev) => [...prev, { x: newX, y: newY }]);
      }

      // Update token position in store
      updateTokenPosition(draggedTokenId, newX, newY);

      // Real-time vision preview during drag (if enabled)
      console.log('[DRAG VISION] Checking conditions:', {
        realtimeVisionDuringDrag,
        fogEnabled,
        fogRevealAll,
        hasWallGeometry: !!wallGeometryRef.current,
        wallSegmentsCount: wallGeometryRef.current?.wallSegments?.length ?? 0
      });
      
      if (realtimeVisionDuringDrag && fogEnabled && !fogRevealAll) {
        const draggedToken = tokens.find((t) => t.id === draggedTokenId);
        console.log('[DRAG VISION] Found token:', draggedToken?.name, 'hasVision:', draggedToken?.hasVision);
        
        if (draggedToken && draggedToken.hasVision !== false) {
          // Compute vision range in pixels
          // Illumination source range is already in pixels
          // Token visionRange and fogVisionRange are in grid units - need conversion using region's gridSize
          const tokenRegion = regions.find(
            (r) => draggedToken.x >= r.x && draggedToken.x <= r.x + r.width && 
                   draggedToken.y >= r.y && draggedToken.y <= r.y + r.height,
          );
          const gridSize = tokenRegion?.gridSize || 40;
          const illuminationRange = draggedToken.illuminationSources?.[0]?.range;
          const gridBasedRange = (draggedToken.visionRange ?? fogVisionRange) * gridSize;
          const tokenVisionRange = illuminationRange || gridBasedRange;
          
          console.log('[DRAG VISION] Range calculation:', {
            illuminationRange,
            gridBasedRange,
            finalRange: tokenVisionRange,
            gridSize,
            fogVisionRange
          });
          
          // Throttled visibility computation
          const now = Date.now();
          const lastUpdateKey = 'lastVisionUpdate';
          const lastUpdate = (window as any)[lastUpdateKey] || 0;
          
          if (now - lastUpdate >= realtimeVisionThrottleMs) {
            (window as any)[lastUpdateKey] = now;
            
            // Compute visibility for the dragged token at its new position
            const tokenCenterX = newX + (draggedToken.gridWidth || 1) * gridSize / 2;
            const tokenCenterY = newY + (draggedToken.gridHeight || 1) * gridSize / 2;
            
            // Store the position for rendering (post-processing path needs this) - use state to trigger re-render
            setDragPreviewPosition({ x: tokenCenterX, y: tokenCenterY, range: tokenVisionRange });
            
            // Get wall segments, default to empty array if not available
            const wallSegments = wallGeometryRef.current?.wallSegments ?? [];
            console.log('[DRAG VISION] Computing visibility at:', { tokenCenterX, tokenCenterY, tokenVisionRange, wallSegmentsCount: wallSegments.length });
            
            // Always use circular fallback for now to verify rendering works
            // TODO: Re-enable wall-based visibility once basic rendering is confirmed
            if (wallSegments.length > 0) {
              try {
                const visibility = computeVisibilityFromSegments(
                  { x: tokenCenterX, y: tokenCenterY },
                  wallSegments,
                  tokenVisionRange
                );
                console.log('[DRAG VISION] Visibility computed, polygon points:', visibility.polygon?.length, 'boundingBox:', visibility.boundingBox);
                
                if (visibility.polygon && visibility.polygon.length > 2) {
                  dragPreviewVisibilityRef.current = visibilityPolygonToPath2D(visibility.polygon);
                  console.log('[DRAG VISION] Path2D created from wall visibility');
                } else {
                  throw new Error('Invalid polygon');
                }
              } catch (e) {
                console.error('[DRAG VISION] Visibility computation error:', e);
                // Fallback: create a simple circular visibility area
                const circlePath = new Path2D();
                circlePath.arc(tokenCenterX, tokenCenterY, tokenVisionRange, 0, Math.PI * 2);
                dragPreviewVisibilityRef.current = circlePath;
                console.log('[DRAG VISION] Using circular fallback after error');
              }
            } else {
              // No walls - use simple circle
              const circlePath = new Path2D();
              circlePath.arc(tokenCenterX, tokenCenterY, tokenVisionRange, 0, Math.PI * 2);
              dragPreviewVisibilityRef.current = circlePath;
              console.log('[DRAG VISION] Using circular (no walls), center:', tokenCenterX, tokenCenterY, 'range:', tokenVisionRange);
            }
          }
        }
      }

      // Force immediate redraw for smooth dragging feedback
      redrawCanvas();
    } else if (isDraggingRegion && draggedRegionId) {
      // Region dragging - move tokens in real-time for smooth preview
      const worldPos = screenToWorld(mouseX, mouseY);
      const newX = worldPos.x - regionDragOffset.x;
      const newY = worldPos.y - regionDragOffset.y;

      // Find the region being dragged
      const draggedRegion = regions.find((r) => r.id === draggedRegionId);
      if (draggedRegion) {
        // Calculate movement delta from original region position
        const deltaX = newX - draggedRegion.x;
        const deltaY = newY - draggedRegion.y;

        // Update temporary positions for preview (avoid store updates during drag)
        const newTempPositions: { [tokenId: string]: { x: number; y: number } } = {};
        groupedTokens.forEach((groupedToken) => {
          const newTokenX = groupedToken.startX + deltaX;
          const newTokenY = groupedToken.startY + deltaY;
          newTempPositions[groupedToken.tokenId] = { x: newTokenX, y: newTokenY };
        });
        setTempTokenPositions(newTempPositions);

        if (draggedRegion.regionType === "path" && draggedRegion.pathPoints) {
          // Update path points for preview
          const newPathPoints = draggedRegion.pathPoints.map((point) => ({
            x: point.x + deltaX,
            y: point.y + deltaY,
          }));

          // Also update bezier control points if they exist
          let newBezierControls = draggedRegion.bezierControlPoints;
          if (draggedRegion.bezierControlPoints) {
            newBezierControls = draggedRegion.bezierControlPoints.map((control) => ({
              cp1: {
                x: control.cp1.x + deltaX,
                y: control.cp1.y + deltaY,
              },
              cp2: {
                x: control.cp2.x + deltaX,
                y: control.cp2.y + deltaY,
              },
            }));
          }

          const newBounds = newBezierControls
            ? getBezierBounds(newPathPoints, newBezierControls)
            : getPolygonBounds(newPathPoints);

          setDragPreview({
            regionId: draggedRegionId,
            pathPoints: newPathPoints,
            bezierControlPoints: newBezierControls,
            x: newBounds.x,
            y: newBounds.y,
            width: newBounds.width,
            height: newBounds.height,
          });
        } else {
          // Update rectangle preview
          setDragPreview({
            regionId: draggedRegionId,
            x: newX,
            y: newY,
            width: draggedRegion.width,
            height: draggedRegion.height,
          });
        }
      }

      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => redrawCanvas());
    } else if (isRotatingRegion && draggedRegionId) {
      // Region rotation - rotate tokens around region center
      const worldPos = screenToWorld(mouseX, mouseY);

      // Find the region being rotated
      const draggedRegion = regions.find((r) => r.id === draggedRegionId);
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
          bezierControlPoints: draggedRegion.bezierControlPoints,
        });

        // Rotate all grouped tokens around region center
        const newTempPositions: { [tokenId: string]: { x: number; y: number } } = {};
        groupedTokens.forEach((groupedToken) => {
          const rotatedPos = rotatePoint(groupedToken.startX, groupedToken.startY, centerX, centerY, rotationDelta);
          newTempPositions[groupedToken.tokenId] = { x: rotatedPos.x, y: rotatedPos.y };
        });
        setTempTokenPositions(newTempPositions);
      }

      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => redrawCanvas());
    } else if (isResizingRegion && draggedRegionId && resizeHandle) {
      // Region resizing or path node editing - use preview for smooth updates
      const worldPos = screenToWorld(mouseX, mouseY);

      const targetRegion = regions.find((r) => r.id === draggedRegionId);
      if (targetRegion) {
        if (targetRegion.regionType === "path" && resizeHandle.startsWith("node-") && targetRegion.pathPoints) {
          // Handle path node editing preview
          const nodeIndex = parseInt(resizeHandle.split("-")[1]);
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
                    y: newBezierControls[nodeIndex].cp1.y + deltaY,
                  },
                };
              }

              if (nodeIndex > 0 && nodeIndex - 1 < newBezierControls.length) {
                // Update cp2 of the segment ending at this node
                newBezierControls[nodeIndex - 1] = {
                  ...newBezierControls[nodeIndex - 1],
                  cp2: {
                    x: newBezierControls[nodeIndex - 1].cp2.x + deltaX,
                    y: newBezierControls[nodeIndex - 1].cp2.y + deltaY,
                  },
                };
              }
            }

            // Update preview with new path points
            const newBounds = newBezierControls
              ? getBezierBounds(newPathPoints, newBezierControls)
              : getPolygonBounds(newPathPoints);
            setDragPreview({
              regionId: draggedRegionId,
              pathPoints: newPathPoints,
              bezierControlPoints: newBezierControls,
              x: newBounds.x,
              y: newBounds.y,
              width: newBounds.width,
              height: newBounds.height,
            });
          }
        } else if (
          targetRegion.regionType === "path" &&
          resizeHandle.startsWith("cp-") &&
          targetRegion.bezierControlPoints
        ) {
          // Handle Bezier control point editing
          const parts = resizeHandle.split("-");
          const segmentIndex = parseInt(parts[1]);
          const isFirst = parts[2] === "1";

          if (segmentIndex >= 0 && segmentIndex < targetRegion.bezierControlPoints.length) {
            const newBezierControls = [...targetRegion.bezierControlPoints];
            if (isFirst) {
              newBezierControls[segmentIndex] = {
                ...newBezierControls[segmentIndex],
                cp1: { x: worldPos.x, y: worldPos.y },
              };
            } else {
              newBezierControls[segmentIndex] = {
                ...newBezierControls[segmentIndex],
                cp2: { x: worldPos.x, y: worldPos.y },
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
              height: newBounds.height,
            });
          }
        } else {
          // Handle rectangle region resizing preview
          const { x, y, width, height } = targetRegion;
          let updates: Partial<CanvasRegion> = {};

          switch (resizeHandle) {
            case "nw":
              updates.x = worldPos.x;
              updates.y = worldPos.y;
              updates.width = width + (x - worldPos.x);
              updates.height = height + (y - worldPos.y);
              break;
            case "ne":
              updates.y = worldPos.y;
              updates.width = worldPos.x - x;
              updates.height = height + (y - worldPos.y);
              break;
            case "sw":
              updates.x = worldPos.x;
              updates.width = width + (x - worldPos.x);
              updates.height = worldPos.y - y;
              break;
            case "se":
              updates.width = worldPos.x - x;
              updates.height = worldPos.y - y;
              break;
            case "n":
              updates.y = worldPos.y;
              updates.height = height + (y - worldPos.y);
              break;
            case "e":
              updates.width = worldPos.x - x;
              break;
            case "s":
              updates.height = worldPos.y - y;
              break;
            case "w":
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
            height: updates.height ?? targetRegion.height,
          });
        }
      }

      // Use requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => redrawCanvas());
    } else {
      // Mouse hover - detect token hover and update cursor
      const worldPos = screenToWorld(mouseX, mouseY);

      // Check if hovering over a token
      let foundHoveredToken = false;
      const currentPlayer = players.find((p) => p.id === currentPlayerId);

      for (const token of tokens) {
        const baseTokenSize = 40;
        const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
        const radius = tokenSize / 2;
        const distance = Math.sqrt((worldPos.x - token.x) ** 2 + (worldPos.y - token.y) ** 2);

        if (distance <= radius) {
          setHoveredTokenId(token.id);
          foundHoveredToken = true;

          // Update cursor based on controllability
          if (canvas && currentPlayer) {
            const isControllable = canControlToken(token, currentPlayer, roles);
            canvas.style.cursor = isControllable ? "pointer" : "not-allowed";
          }
          break;
        }
      }

      if (!foundHoveredToken) {
        setHoveredTokenId(null);
        if (canvas) {
          canvas.style.cursor = "default";
        }
      }

      // Show grid highlights for potential token placement
      // Only show highlights if Shift key is held (indicating token placement mode)
      if (e.shiftKey) {
        // Use default 1x1 size for new token placement, or get size from active token in toolbar
        // For now, use 1x1 as default
        updateGridHighlights(worldPos.x, worldPos.y, 1, 1);
      } else {
        // Clear highlights when not in placement mode
        setHighlightedGrids([]);
      }

      // Redraw to show hover effects
      if (foundHoveredToken) {
        redrawCanvas();
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle marquee selection completion
    if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
      // Calculate marquee bounds in world space
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);
      
      // Only select if marquee is large enough (not just a click)
      const marqueeWidth = maxX - minX;
      const marqueeHeight = maxY - minY;
      
      if (marqueeWidth > 5 && marqueeHeight > 5) {
        const selectedRegionIdsList: string[] = [];
        const selectedTokenIdsList: string[] = [];
        
        // Select regions (in edit mode)
        if (renderingMode === 'edit') {
          regions.forEach(region => {
            // Get region bounds
            let regionMinX: number, regionMinY: number, regionMaxX: number, regionMaxY: number;
            
            if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 0) {
              const xs = region.pathPoints.map(p => p.x);
              const ys = region.pathPoints.map(p => p.y);
              regionMinX = Math.min(...xs);
              regionMinY = Math.min(...ys);
              regionMaxX = Math.max(...xs);
              regionMaxY = Math.max(...ys);
            } else {
              regionMinX = region.x;
              regionMinY = region.y;
              regionMaxX = region.x + region.width;
              regionMaxY = region.y + region.height;
            }
            
            // Check if region intersects with marquee (AABB intersection)
            const intersects = !(regionMaxX < minX || regionMinX > maxX || 
                                regionMaxY < minY || regionMinY > maxY);
            
            if (intersects) {
              selectedRegionIdsList.push(region.id);
              selectRegion(region.id);
            }
          });
        }
        
        // Select tokens (both edit and play mode)
        const baseTokenSize = 40; // Base size for 1x1 token
        tokens.forEach(token => {
          const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
          const radius = tokenSize / 2;
          
          // Token bounds (circle approximated as square for intersection)
          const tokenMinX = token.x - radius;
          const tokenMinY = token.y - radius;
          const tokenMaxX = token.x + radius;
          const tokenMaxY = token.y + radius;
          
          // Check if token intersects with marquee
          const intersects = !(tokenMaxX < minX || tokenMinX > maxX || 
                              tokenMaxY < minY || tokenMinY > maxY);
          
          if (intersects) {
            // Check if player can control this token
            if (currentPlayer && canControlToken(token, currentPlayer, roles)) {
              selectedTokenIdsList.push(token.id);
            }
          }
        });
        
        // Update state based on what was selected
        if (selectedRegionIdsList.length > 0) {
          setSelectedRegionIds(selectedRegionIdsList);
        }
        if (selectedTokenIdsList.length > 0) {
          setSelectedTokenIds(selectedTokenIdsList);
        }
        
        // Show feedback
        const parts: string[] = [];
        if (selectedRegionIdsList.length > 0) {
          parts.push(`${selectedRegionIdsList.length} region${selectedRegionIdsList.length !== 1 ? 's' : ''}`);
        }
        if (selectedTokenIdsList.length > 0) {
          parts.push(`${selectedTokenIdsList.length} token${selectedTokenIdsList.length !== 1 ? 's' : ''}`);
        }
        if (parts.length > 0) {
          toast.success(`Selected ${parts.join(' and ')}`);
        }
      }
      
      // Reset marquee state
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      redrawCanvas();
      return;
    }
    
    // Handle freehand drawing completion
    if (isFreehandDrawing && pathDrawingMode === "drawing" && pathDrawingType === "freehand") {
      setIsFreehandDrawing(false);
      finishPathDrawing();
      return;
    }

    if (e.button === 2) {
      // Right click
      setIsPanning(false);
    } else if (e.button === 0) {
      // Left click
      // Handle token snapping on drag end
      if (isDraggingToken && draggedTokenId && !tokensMovedByRegion.includes(draggedTokenId)) {
        const token = tokens.find((t) => t.id === draggedTokenId);
        if (token) {
          // Find local region at token position (our local regions in SimpleTabletop)
          const localRegion = regions.find((r) => isPointInRegion(token.x, token.y, r));

          // Priority 1: Local region snapping (if region exists and has snapping enabled)
          if (localRegion && localRegion.gridSnapping && localRegion.gridType !== "free") {
            // Convert local region to map region format for snapping
            let regionPoints: Array<{ x: number; y: number }>;

            if (localRegion.regionType === "path" && localRegion.pathPoints) {
              regionPoints = localRegion.pathPoints;
            } else {
              // Rectangle region
              regionPoints = [
                { x: localRegion.x, y: localRegion.y },
                { x: localRegion.x + localRegion.width, y: localRegion.y },
                { x: localRegion.x + localRegion.width, y: localRegion.y + localRegion.height },
                { x: localRegion.x, y: localRegion.y + localRegion.height },
              ];
            }

            const regionForSnap = {
              map: {} as any, // Not used in snapping logic
              region: {
                gridType: localRegion.gridType,
                gridSize: localRegion.gridSize * localRegion.gridScale,
                points: regionPoints,
              } as any,
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
          
          // Create undo command for token movement
          if (initialTokenState && (initialTokenState.x !== token.x || initialTokenState.y !== token.y)) {
            moveTokenUndoable(
              draggedTokenId,
              { x: initialTokenState.x, y: initialTokenState.y },
              { x: token.x, y: token.y },
              token.label || token.name
            );
          }
        }
      }

      setIsDraggingToken(false);
      setDraggedTokenId(null);
      setDragOffset({ x: 0, y: 0 });
      setDragStartPos({ x: 0, y: 0 });
      setDragPath([]);
      setInitialTokenState(null);
      
      // Clear stable visibility snapshot after drag ends
      if (stableVisibilityRef.current) {
        stableVisibilityRef.current.remove();
        stableVisibilityRef.current = null;
      }

      // Update highlights for all tokens after drag ends
      updateAllTokenHighlights();

      // Apply final positions for region drag preview (visual only; undo handled below)
      if (dragPreview && draggedRegionId) {
        const draggedRegion = regions.find((r) => r.id === draggedRegionId);
        if (draggedRegion) {
          let finalState: Partial<CanvasRegion>;
          
          // Update region in store with recalculated bounds for grid
          if (draggedRegion.regionType === "path" && dragPreview.pathPoints) {
            // Recalculate bounds to ensure grid is properly updated
            const finalBounds = dragPreview.bezierControlPoints
              ? getBezierBounds(dragPreview.pathPoints, dragPreview.bezierControlPoints)
              : getPolygonBounds(dragPreview.pathPoints);

            finalState = {
              x: finalBounds.x,
              y: finalBounds.y,
              width: finalBounds.width,
              height: finalBounds.height,
              pathPoints: dragPreview.pathPoints,
              bezierControlPoints: dragPreview.bezierControlPoints,
              // Preserve rotation when dragging
              rotation: draggedRegion.rotation,
            };
            
            updateRegion(draggedRegionId, finalState);
          } else {
            finalState = {
              x: dragPreview.x,
              y: dragPreview.y,
              width: dragPreview.width,
              height: dragPreview.height,
              // Preserve rotation when dragging
              rotation: draggedRegion.rotation,
            };
            
            updateRegion(draggedRegionId, finalState);
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
        const currentRegion = regions.find((r) => r.id === draggedRegionId);
        const newRotation = (currentRegion?.rotation || 0) + rotationDelta;
        
        updateRegion(draggedRegionId, {
          rotation: newRotation,
        });
      }

      // Clear rotation state
      setIsRotatingRegion(false);
      setTempRegionRotation({});
    }


    // Unified region transform undo registration
    // Handles move, scale, rotate - all region spatial changes
    // MUST run AFTER all region updates have been applied above
    if (initialRegionState && transformingRegionId) {
      const currentRegion = regions.find((r) => r.id === transformingRegionId);
      if (currentRegion) {
        const currentState = captureRegionTransformState(currentRegion);

        // Only register if something actually changed
        if (hasTransformChanged(initialRegionState, currentState)) {
          transformRegionUndoable(transformingRegionId, initialRegionState, currentState);
        }
      }

      // Always cleanup
      setInitialRegionState(null);
      setTransformingRegionId(null);
    }

    // Reset all region drag states (runs for normal drag, rotation, and resize)
    if (isDraggingRegion || isRotatingRegion || isResizingRegion) {
      setIsDraggingRegion(false);
      setIsResizingRegion(false);
      setDraggedRegionId(null);
      setRegionDragOffset({ x: 0, y: 0 });
      setResizeHandle(null);
      setDragPreview(null);

      // Clear tokens moved by region tracking
      setTokensMovedByRegion([]);
      
      // Clear stable visibility snapshot after drag ends
      if (stableVisibilityRef.current) {
        stableVisibilityRef.current.remove();
        stableVisibilityRef.current = null;
      }

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
      zoom: newZoom,
    });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasContextMenu(e);
  };

  // Token manipulation functions for FloatingMenu
  const handleTokenColorChange = (tokenId: string, color: string) => {
    updateTokenColor(tokenId, color);
    toast.success("Token color updated");
  };

  const handleCanvasUpdate = () => {
    // Canvas automatically redraws when tokens change
  };

  const addTokenToCanvas = async (
    imageUrl: string,
    x?: number,
    y?: number,
    gridWidth: number = 1,
    gridHeight: number = 1,
    color?: string,
  ) => {
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use provided coordinates or default to center of viewport
    let tokenX = x ?? -transform.x / transform.zoom;
    let tokenY = y ?? -transform.y / transform.zoom;

    // Apply grid snapping for new tokens based on world and region settings
    console.log("Adding new token at:", tokenX, tokenY);
    const activeRegion = getActiveRegionAt(tokenX, tokenY);
    console.log("Active region for new token:", activeRegion);

    // Find local region at token position for region-specific snapping
    const localRegion = regions.find((r) => isPointInRegion(tokenX, tokenY, r) && r.gridType !== "free");

    if (localRegion && localRegion.gridSnapping) {
      console.log("Applying local region snapping for new token, grid type:", localRegion.gridType);
      // Convert local region to map region format for snapping
      let regionPoints: Array<{ x: number; y: number }>;

      if (localRegion.regionType === "path" && localRegion.pathPoints) {
        regionPoints = localRegion.pathPoints;
      } else {
        // Rectangle region
        regionPoints = [
          { x: localRegion.x, y: localRegion.y },
          { x: localRegion.x + localRegion.width, y: localRegion.y },
          { x: localRegion.x + localRegion.width, y: localRegion.y + localRegion.height },
          { x: localRegion.x, y: localRegion.y + localRegion.height },
        ];
      }
      const regionForSnap = {
        map: {} as any, // Not used in snapping logic
        region: {
          gridType: localRegion.gridType,
          gridSize: localRegion.gridSize * localRegion.gridScale,
          points: regionPoints,
        } as any,
      };
      const snappedPos = snapToMapGrid(tokenX, tokenY, regionForSnap);
      console.log("New token snapped to local region:", snappedPos);
      tokenX = snappedPos.x;
      tokenY = snappedPos.y;
    } else if (isGridSnappingEnabled && activeRegion && activeRegion.region.gridType !== "none") {
      console.log("Applying world snapping for new token, grid type:", activeRegion.region.gridType);
      const snappedPos = snapToMapGrid(tokenX, tokenY, activeRegion);
      console.log("New token snapped position:", snappedPos);
      tokenX = snappedPos.x;
      tokenY = snappedPos.y;
    } else {
      console.log("No snapping for new token");
    }

    // Use provided color or generate a random one
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"];
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
        labelPosition: 'below',
        ownerId: currentPlayerId,
        color: tokenColor,
        roleId: "player", // Default to player role
        isHidden: false,
      });

      toast.success("Token added to map");
    } catch (error) {
      console.error("Failed to add token:", error);
      toast.error("Failed to add token");
    }
  };

  return (
    <div className="w-full h-screen bg-surface flex flex-col relative">
      {/* Texture Download Progress Indicator */}
      <TextureDownloadProgress />

      {/* Circular Button Bar - Always visible at top */}
      <CircularButtonBar
        mode={renderingMode}
        onToggleMode={() => setRenderingMode(renderingMode === "edit" ? "play" : "edit")}
      />

      {/* Vertical Toolbar - Middle left of viewport (controlled by CircularButtonBar) */}
      <VerticalToolbar
        mode={renderingMode}
        fabricCanvas={null}
        onOpenMapManager={() => setShowMapManager(true)}
        onAddRegion={addNewRegion}
        onStartPolygonDraw={() => startPathDrawing("polygon")}
        onStartFreehandDraw={() => startPathDrawing("freehand")}
        onFinishPolygonDraw={finishPathDrawing}
        isDrawingPolygon={pathDrawingMode === "drawing" && pathDrawingType === "polygon"}
        isDrawingFreehand={pathDrawingMode === "drawing" && pathDrawingType === "freehand"}
        isGridSnappingEnabled={isGridSnappingEnabled}
        onToggleGridSnapping={() => setIsGridSnappingEnabled(!isGridSnappingEnabled)}
        showRegions={showRegions}
        onToggleRegions={() => setShowRegions(!showRegions)}
        onFitToView={handleFitToView}
      />

      {/* Per-Region Snap Button (shows when region is selected) - REMOVED */}

      {/* Region Control Panel - removed, now using Region Controls Card */}

      {/* Main Canvas Container */}
      <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            background: "hsl(var(--canvas-background))",
            cursor: isPanning
              ? "grabbing"
              : isDraggingToken
                ? "move"
                : pathDrawingMode === "drawing"
                  ? "crosshair"
                  : "auto",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={() => pathDrawingMode === "drawing" && pathDrawingType === "polygon" && finishPathDrawing()}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
        />
        {/* Overlay canvas for UI elements above fog post-processing */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: Z_INDEX.CANVAS_ELEMENTS.CANVAS_UI_OVERLAY }}
        />
      </div>

      {/* Token Context Manager */}
      <TokenContextManager
        fabricCanvas={null}
        onColorChange={handleTokenColorChange}
        onUpdateCanvas={handleCanvasUpdate}
      />

      {/* Card-Based UI System */}
      <CardManager
        sessionId={sessionId}
        activeRegionId={activeRegionControlId}
        onToggleSnapping={toggleRegionSnapping}
        onToggleGridVisibility={toggleRegionGridVisibility}
      />

      {/* Initiative Tracker Panel - Bottom middle */}
      <InitiativePanel />

      {/* Bulk Operations Toolbar - Shows when multiple tokens selected */}
      <BulkOperationsToolbar
        selectedTokenIds={selectedTokenIds}
        onClearSelection={() => setSelectedTokenIds([])}
        onUpdateCanvas={handleCanvasUpdate}
      />

      {/* Region Control Bar - Shows when region(s) are selected */}
      <RegionControlBar
        selectedRegionIds={selectedRegionIds}
        onClearSelection={() => {
          selectedRegionIds.forEach(id => deselectRegion(id));
          setSelectedRegionIds([]);
          redrawCanvas();
        }}
        onUpdateCanvas={handleCanvasUpdate}
        onSelectAll={() => {
          // Select all regions
          regions.forEach(region => selectRegion(region.id));
          setSelectedRegionIds(regions.map(r => r.id));
          redrawCanvas();
        }}
      />

      {/* Selection Mode Indicator - Shows what type of selection is active */}
      <SelectionModeIndicator
        selectedRegionCount={selectedRegionIds.length}
        selectedTokenCount={selectedTokenIds.length}
      />

      {/* Movement Lock Indicator - Shows when token movement is locked */}
      <MovementLockIndicator />

      {/* Zoom Level Indicator with Menu */}
      <div 
        className="absolute bottom-4 right-4"
        style={{ zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground shadow-sm select-none hover:bg-card/90 transition-colors cursor-pointer"
            >
              {Math.round(transform.zoom * 100)}%
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="min-w-[100px]">
            <DropdownMenuItem onClick={() => setTransform(prev => ({ ...prev, zoom: 4.0 }))}>
              400%
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTransform(prev => ({ ...prev, zoom: 2.0 }))}>
              200%
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTransform(prev => ({ ...prev, zoom: 1.0 }))}>
              100%
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTransform(prev => ({ ...prev, zoom: 0.5 }))}>
              50%
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTransform(prev => ({ ...prev, zoom: 0.25 }))}>
              25%
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              // Fit to view - calculate zoom to fit all regions
              if (regions.length === 0) return;
              const bounds = regions.reduce((acc, r) => ({
                minX: Math.min(acc.minX, r.x),
                minY: Math.min(acc.minY, r.y),
                maxX: Math.max(acc.maxX, r.x + r.width),
                maxY: Math.max(acc.maxY, r.y + r.height),
              }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
              
              const contentWidth = bounds.maxX - bounds.minX;
              const contentHeight = bounds.maxY - bounds.minY;
              const padding = 50;
              
              const zoomX = (window.innerWidth - padding * 2) / contentWidth;
              const zoomY = (window.innerHeight - padding * 2) / contentHeight;
              const newZoom = Math.min(zoomX, zoomY, 2.0);
              
              const centerX = (bounds.minX + bounds.maxX) / 2;
              const centerY = (bounds.minY + bounds.maxY) / 2;
              
              setTransform({
                zoom: newZoom,
                x: window.innerWidth / 2 - centerX * newZoom,
                y: window.innerHeight / 2 - centerY * newZoom,
              });
            }}>
              Fit to View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {selectedAnnotationId &&
        (() => {
          const annotation = annotations.find((a) => a.id === selectedAnnotationId);
          if (!annotation || !annotation.text) return null;

          const screenX = annotation.position.x * transform.zoom + transform.x;
          const screenY = annotation.position.y * transform.zoom + transform.y;

          return (
            <div
              className="absolute bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-lg max-w-xs"
              style={{
                left: `${screenX + 20}px`,
                top: `${screenY - 10}px`,
                zIndex: Z_INDEX.CANVAS_ELEMENTS.CANVAS_UI_OVERLAY,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    {annotation.reference}
                  </div>
                  <span className="text-sm font-semibold">Marker {annotation.reference}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setSelectedAnnotationId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{annotation.text}</p>
            </div>
          );
        })()}

      {/* Map Manager Modal */}
      {showMapManager && <MapManager onClose={() => setShowMapManager(false)} />}

      {/* Region Background Modal */}
      <RegionBackgroundModal
        open={isRegionBackgroundModalOpen}
        onOpenChange={setIsRegionBackgroundModalOpen}
        region={selectedRegionForEdit}
        onUpdateRegion={updateRegion}
      />

      {/* Role Selection Modal - Shows on session entry */}
      <RoleSelectionModal open={true} />
    </div>
  );
};

export default SimpleTabletop;
