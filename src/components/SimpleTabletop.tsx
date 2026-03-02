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

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapManager } from "./MapManager";
import { TokenContextManager } from "./TokenContextManager";
import { CardManager } from "./CardManager";
import { CircularButtonBar } from "./CircularButtonBar";
import { VerticalToolbar } from "./VerticalToolbar";
import { InitiativePanel } from "./InitiativePanel";
import { BulkOperationsToolbar } from "./BulkOperationsToolbar";
import { UnifiedSelectionToolbar } from "./UnifiedSelectionToolbar";
import { MapObjectContextMenuWrapper } from "./MapObjectContextMenu";
import { MovementLockIndicator } from "./MovementLockIndicator";
import { useSessionStore, type Token } from "../stores/sessionStore";
import { emitLocalOp } from "@/lib/net";
import { emitDragBegin, emitDragUpdate, emitDragEnd } from "@/lib/net/dragOps";
import { useDragPreviewStore } from "@/stores/dragPreviewStore";
import { useMapStore } from "../stores/mapStore";
import { useRegionStore, type CanvasRegion } from "../stores/regionStore";
import { useDungeonStore } from "../stores/dungeonStore";
import { useInitiativeStore } from "../stores/initiativeStore";
import { useCardStore } from "../stores/cardStore";
import { useMapObjectStore } from "../stores/mapObjectStore";
import { CardType } from "@/types/cardTypes";
import {
  renderDoors,
  renderDungeonMapRegions,
  renderDungeonMapDoors,
} from "../lib/dungeonRenderer";
import { renderMapObjects, renderMapObjectShadows, findMapObjectAtPoint, findWallVertexAtPoint, findNearestWallSegmentPoint, triggerDoorAnimation } from "../lib/mapObjectRenderer";
import { MapObjectControlBar } from "./MapObjectControlBar";
import { generateNegativeSpaceRegion, mapObjectsToSegments } from "../lib/wallGeometry";
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
import { addVisibleToExplored, computeFogMasks, cleanupFogGeometry, paperPathToPath2D, isPointInRevealedArea, isPointInVisibleArea, getFogScope } from "../lib/fogGeometry";
import { serializeFogGeometry, deserializeFogGeometry } from "../lib/fogSerializer";
import { renderFogLayers } from "../lib/fogRenderer";
import { useVisionProfileStore } from "../stores/visionProfileStore";
import { useRoleStore } from "../stores/roleStore";
import { useUiModeStore, type DmFogVisibility } from "../stores/uiModeStore";
import { getTokensForVisionCalculation } from "../lib/visionPermissions";
import { canControlToken, canSeeToken, getTokenRelationship } from "../lib/rolePermissions";
import paper from "paper";
import { useFogStore } from "../stores/fogStore";
import { usePostProcessing } from "../hooks/usePostProcessing";
import { useRegionEdgeProcessing } from "../hooks/useRegionEdgeProcessing";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useUndoableActions } from "../hooks/useUndoableActions";
import { undoRedoManager } from "../lib/undoRedoManager";
import { BatchRegionRotationCommand } from "../lib/commands/regionCommands";
import { useTextureLoader } from "../hooks/useTextureLoader";
import { TextureDownloadProgress } from "./TextureDownloadProgress";
import { FloorNavigationWidget } from "./FloorNavigationWidget";
import { texturePatternCache } from "../lib/texturePatternCache";
import { animatedTextureManager } from "../lib/animatedTextureManager";
import { isInViewport, ViewportBounds } from "../lib/renderOptimizer";
import { LRUImageCache } from "../lib/LRUImageCache";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Settings, Grid3X3, Eye, Pen, Square, Settings2, X, Lightbulb, CloudFog, MousePointer2 } from "lucide-react";
import { RegionBackgroundModal } from "./modals/RegionBackgroundModal";
import { RoleSelectionModal } from "./modals/RoleSelectionModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { RegionControlBar } from "./RegionControlBar";
import { FogBrushToolbar } from "./FogBrushToolbar";
import { drawFootprintPath, drawStyledLinePath } from "../lib/footprintShapes";
import { checkMovementCollision, getBlockingObjects } from "../lib/movementCollision";
import { useTouchEvents } from "../hooks/useTouchEvents";
import { useGroupStore } from "../stores/groupStore";
import { useActionStore } from "../stores/actionStore";
import { CursorOverlay } from "./CursorOverlay";
import { useCursorStore } from "@/stores/cursorStore";
import { ephemeralBus } from "@/lib/net";
import { registerCursorHandlers } from "@/lib/net/ephemeral/cursorHandlers";
import { registerPresenceHandlers } from "@/lib/net/ephemeral/presenceHandlers";
import { registerTokenHandlers } from "@/lib/net/ephemeral/tokenHandlers";
import { registerMapHandlers } from "@/lib/net/ephemeral/mapHandlers";
import { registerMiscHandlers } from "@/lib/net/ephemeral/miscHandlers";
import { useTokenEphemeralStore } from "@/stores/tokenEphemeralStore";
import { useActiveMapFilter } from "@/hooks/useActiveMapFilter";
import { useMapEphemeralStore } from "@/stores/mapEphemeralStore";
import { useMapFocusStore, isFocusEffectActive } from "@/stores/mapFocusStore";

import { Z_INDEX } from "../lib/zIndex";
import { APP_VERSION } from "../lib/version";
import { setPostProcessingVisible } from "../lib/postProcessingLayer";

export const SimpleTabletop = () => {
  // Register ephemeral handlers once
  React.useEffect(() => {
    registerCursorHandlers();
    registerPresenceHandlers();
    registerTokenHandlers();
    registerMapHandlers();
    registerMiscHandlers();
  }, []);
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

  // Helper function to draw token label with rounded rect background
  const drawTokenLabel = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    labelPos: 'above' | 'center' | 'below',
    radius: number,
    zoom: number,
    labelColor?: string,
    labelBackgroundColor?: string
  ) => {
    const fontSize = 12 / zoom;
    const paddingX = 4 / zoom;
    const paddingY = 2 / zoom;
    const borderRadius = 3 / zoom;
    
    ctx.font = `${fontSize}px Arial`;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    
    // Calculate label position
    let labelX = x;
    let labelY: number;
    let textBaseline: CanvasTextBaseline;
    
    if (labelPos === 'center') {
      labelY = y;
      textBaseline = 'middle';
    } else if (labelPos === 'above') {
      labelY = y - radius - 4 / zoom - textHeight / 2;
      textBaseline = 'middle';
    } else {
      // below (default)
      labelY = y + radius + 4 / zoom + textHeight / 2;
      textBaseline = 'middle';
    }
    
    // Draw rounded rect background
    const bgColor = labelBackgroundColor || 'rgba(30, 30, 30, 0.75)';
    const bgX = labelX - textWidth / 2 - paddingX;
    const bgY = labelY - textHeight / 2 - paddingY;
    const bgWidth = textWidth + paddingX * 2;
    const bgHeight = textHeight + paddingY * 2;
    
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = labelColor || '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = textBaseline;
    ctx.fillText(text, labelX, labelY);
  };
  const [selectedRegionForEdit, setSelectedRegionForEdit] = useState<CanvasRegion | null>(null);
  const [showRegions, setShowRegions] = useState(true); // Debug toggle for testing wall-based light blocking
  const [gridColor, setGridColor] = useState("#333");
  const [gridOpacity, setGridOpacity] = useState(80);
  
  // Canvas dimensions for post-processing
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // ── Multi-map entity filtering (must be before fogBounds which uses isEntityVisible) ──
  const { isEntityVisible } = useActiveMapFilter();

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

      // ── EPHEMERAL: DM broadcasts viewport to all clients ──
      const currentPlayer2 = useSessionStore.getState().players.find(p => p.id === useSessionStore.getState().currentPlayerId);
      if (currentPlayer2?.roleIds?.includes('dm')) {
        ephemeralBus.emit("map.dm.viewport", { x: newTransform.x, y: newTransform.y, zoom: newTransform.zoom });
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

  // Broadcast presence.viewingMap when the active map changes
  useEffect(() => {
    ephemeralBus.emit("presence.viewingMap", { mapId: selectedMapId ?? null });
  }, [selectedMapId]);

  // ── Follow DM: auto-pan viewport to match DM's broadcast ──
  const followDM = useMapEphemeralStore((s) => s.followDM);
  const dmViewport = useMapEphemeralStore((s) => s.dmViewport);
  useEffect(() => {
    if (!followDM || !dmViewport) return;
    setTransformState({ x: dmViewport.x, y: dmViewport.y, zoom: dmViewport.zoom });
  }, [followDM, dmViewport]);
  
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

  // Remote drag previews — subscribe to store for canvas redraws
  const remoteDragPreviews = useDragPreviewStore((s) => s.previews);
  const remoteHovers = useTokenEphemeralStore((s) => s.hovers);
  const remoteSelections = useTokenEphemeralStore((s) => s.selectionPreviews);
  const remoteActionTargets = useTokenEphemeralStore((s) => s.actionTargets);
  const remotePings = useMapEphemeralStore((s) => s.pings);
  // Local pings (own + remote) for animated rendering — each has a birth timestamp
  const [activePings, setActivePings] = useState<Array<{ id: string; pos: { x: number; y: number }; color: string; ts: number }>>([]);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);
  // Multi-token drag: stores start positions for every token in the selection at drag start
  const multiDragStartPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  // Pending deselect: token to remove from selection on mouseup IF no drag was detected
  const pendingDeselectRef = useRef<string | null>(null);
  // Tracks whether mouse actually moved during a token drag (distinguishes click from drag)
  const dragMovedRef = useRef(false);

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
  
  // Combined visibility-blocking segments (walls + map objects)
  const combinedSegmentsRef = useRef<ReturnType<typeof mapObjectsToSegments>>([]);
  
  // Track previous map objects blocking state to detect changes (e.g., door toggle)
  const prevMapObjectsBlockingRef = useRef<string>('');

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
    importedWallSegments,
    renderingMode,
    setRenderingMode,
    watabouStyle,
    wallEdgeStyle,
    wallThickness,
    textureScale,
  } = useDungeonStore();

  // Map objects store
  const mapObjects = useMapObjectStore((state) => state.mapObjects);
  const selectedMapObjectIds = useMapObjectStore((state) => state.selectedMapObjectIds);
  const selectMapObject = useMapObjectStore((state) => state.selectMapObject);
  const clearMapObjectSelection = useMapObjectStore((state) => state.clearSelection);
  const toggleDoor = useMapObjectStore((state) => state.toggleDoor);
  const updateMapObject = useMapObjectStore((state) => state.updateMapObject);

  // Light system store
  const { lights, addLight, updateLight, removeLight, globalAmbientLight, shadowIntensity, selectedLightIds, selectMultipleLights, clearLightSelection } = useLightStore();

  // Light placement mode
  const [lightPlacementMode, setLightPlacementMode] = useState(false);

  // --- Auto-pause animations during pan / fog brush ---
  // Tracks the user's animation-pause preference before we override it
  const animPauseBeforeOverrideRef = useRef<boolean | null>(null);

  // Fog reveal brush state (DM tool for painting explored areas)
  const [fogRevealBrushActive, setFogRevealBrushActive] = useState(false);
  const fogRevealBrushActiveRef = useRef(false); // ref mirror to avoid stale closures in rAF/interval callbacks
  const [fogRevealBrushRadius, setFogRevealBrushRadius] = useState(60); // world-space radius
  const fogRevealBrushRadiusRef = useRef(60); // ref mirror
  const [isFogBrushPainting, setIsFogBrushPainting] = useState(false);
  const [fogBrushMode, setFogBrushMode] = useState<'reveal' | 'hide'>('reveal'); // reveal = remove fog, hide = add fog
  const fogBrushCursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null); // screen-space mouse pos for brush reticle
  const fogBrushPreExploredRef = useRef<paper.CompoundPath | null>(null); // snapshot for undo
  // Keep refs in sync with state for stale-closure-safe reads in rAF/interval callbacks
  fogRevealBrushActiveRef.current = fogRevealBrushActive;
  fogRevealBrushRadiusRef.current = fogRevealBrushRadius;
  // Fog of war store
  const {
    enabled: fogEnabled,
    revealAll: fogRevealAll,
    visionRange: fogVisionRange,
    fogOpacity,
    exploredOpacity,
    serializedExploredAreasPerMap,
    setSerializedExploredAreasForMap,
    setEnabled: setFogEnabled,
    setRevealAll: setFogRevealAll,
    effectSettings,
    realtimeVisionDuringDrag,
    realtimeVisionThrottleMs,
    clearExploredAreas,
  } = useFogStore();
  
  // ---------------------------------------------------------------------------
  // Content-aware fog canvas bounds
  // ---------------------------------------------------------------------------
  // Compute the bounding box of all map content (regions + tokens) in CSS px,
  // using the current pan/zoom transform.  The fog and PixiJS canvases are
  // sized to cover this bbox (plus FIXED_PADDING) so fog renders correctly even
  // when content extends far beyond the visible viewport.
  //
  // We union the result with the viewport so the fog always covers at least the
  // visible area.  originX/Y are the CSS px position of the bbox top-left
  // relative to the container — used to offset the PixiJS canvas CSS position.
  // ---------------------------------------------------------------------------
  const fogBounds = useMemo(() => {
    const vw = canvasDimensions.width;
    const vh = canvasDimensions.height;
    if (vw <= 0 || vh <= 0) return { width: vw, height: vh, originX: 0, originY: 0 };

    // Start with the viewport in screen space
    let minX = 0, minY = 0, maxX = vw, maxY = vh;

    // Expand to include all regions (in world space → screen space)
    regions.filter(r => isEntityVisible(r.mapId)).forEach((region) => {
      let rMinX: number, rMinY: number, rMaxX: number, rMaxY: number;
      if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 0) {
        const xs = region.pathPoints.map((p) => p.x);
        const ys = region.pathPoints.map((p) => p.y);
        rMinX = Math.min(...xs); rMinY = Math.min(...ys);
        rMaxX = Math.max(...xs); rMaxY = Math.max(...ys);
      } else {
        rMinX = region.x; rMinY = region.y;
        rMaxX = region.x + region.width; rMaxY = region.y + region.height;
      }
      // Project world → screen
      const sMinX = rMinX * transform.zoom + transform.x;
      const sMinY = rMinY * transform.zoom + transform.y;
      const sMaxX = rMaxX * transform.zoom + transform.x;
      const sMaxY = rMaxY * transform.zoom + transform.y;
      minX = Math.min(minX, sMinX);
      minY = Math.min(minY, sMinY);
      maxX = Math.max(maxX, sMaxX);
      maxY = Math.max(maxY, sMaxY);
    });

    // Content bbox in screen space
    const originX = Math.min(0, minX);   // ≤ 0: content extends left of viewport
    const originY = Math.min(0, minY);   // ≤ 0: content extends above viewport
    const totalW = Math.max(vw, maxX) - originX;
    const totalH = Math.max(vh, maxY) - originY;

    return { width: Math.ceil(totalW), height: Math.ceil(totalH), originX: Math.floor(originX), originY: Math.floor(originY) };
  }, [canvasDimensions.width, canvasDimensions.height, regions, transform, isEntityVisible]);

  // Post-processing hook for fog effects
  const { applyEffects: applyPostProcessingEffects, isReady: isPostProcessingReady, isReadyRef: isPostProcessingReadyRef } = usePostProcessing({
    containerRef: canvasContainerRef,
    enabled: renderingMode === 'play' && fogEnabled && effectSettings.postProcessingEnabled,
    width: fogBounds.width,
    height: fogBounds.height,
    originX: fogBounds.originX,
    originY: fogBounds.originY,
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

  // Track explored areas (accumulated visibility) using paper.js — per-map
  const exploredAreasMapRef = useRef<Map<string, paper.CompoundPath>>(new Map());
  const currentVisibilityRef = useRef<paper.Path | null>(null); // Current visibility for interaction checks
  const stableVisibilityRef = useRef<paper.Path | null>(null); // Snapshot of visibility for stable checks during drag

  /** Get the explored area for the currently selected map (or 'default-map') */
  const getActiveExploredArea = useCallback((): paper.CompoundPath | null => {
    const mapId = selectedMapId || 'default-map';
    return exploredAreasMapRef.current.get(mapId) || null;
  }, [selectedMapId]);

  /** Set the explored area for the currently selected map (or 'default-map') */
  const setActiveExploredArea = useCallback((path: paper.CompoundPath | null) => {
    const mapId = selectedMapId || 'default-map';
    if (path) {
      exploredAreasMapRef.current.set(mapId, path);
    } else {
      exploredAreasMapRef.current.delete(mapId);
    }
  }, [selectedMapId]);

  // Portal activation flash effect — maps portalId to start timestamp
  const portalActivationsRef = useRef<Map<string, number>>(new Map());
  
  // Pending teleport confirmation (DM approval)
  const [pendingTeleport, setPendingTeleport] = useState<{
    tokenId: string;
    tokenName: string;
    sourcePortalId: string;
    sourcePortalName: string;
    targetPortalId: string;
    targetPortalName: string;
    dropPosition?: { x: number; y: number };
  } | null>(null);
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
      /** Raw visibility polygon for wall-occlusion clipping in illumination (no circle clip applied).
       *  Only set when actual wall segments exist. Used as visibilityPolygon on IlluminationSource. */
      wallOcclusionPath?: Path2D;
      isLightSource?: boolean; // Light sources get two-zone gradient in post-processing
      tokenIllumination?: Token['illuminationSources']; // Token's custom illumination settings
      mapObjectLightData?: { lightColor?: string; lightRadius?: number; lightBrightRadius?: number; lightIntensity?: number }; // Map object light properties
    }>
  >([]);

  // Cached illuminationSources array — rebuilt only when tokenVisibilityDataRef changes
  const illuminationSourcesCacheRef = useRef<any[] | null>(null);

  // Cache individual token visibility shapes to avoid recomputing unchanged tokens
  const tokenVisibilityCacheRef = useRef<
    Map<
      string,
      {
        position: { x: number; y: number };
        visionPath: any; // paper.js Path
        illuminationRange?: number; // Track range to detect changes
        /** Raw Path2D from visibilityPolygonToPath2D (no circle clip) for use as illumination wall-occlusion mask. */
        wallOcclusionPath?: Path2D;
      }
    >
  >(new Map());

  // Track previous token positions and illumination ranges to detect changes
  const prevTokenPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const prevTokenIlluminationRef = useRef<Map<string, { range?: number; settingsHash?: string }>>(new Map());

  // Track previous rendering mode to detect edit → play transitions
  const prevRenderingModeRef = useRef<string>(renderingMode);

  // Performance optimization: Cache for token drawing to reduce redundant renders
  const tokenDrawCache = useRef<Map<string, { lastDrawn: number; data: any }>>(new Map());

   // Track if fog needs recomputation
  const [fogNeedsUpdate, setFogNeedsUpdate] = useState(false);
  
  // Track previous dragging state to detect drag-end transitions
  const wasDraggingTokenRef = useRef(false);
  
  // Counter to force re-render when images load
  const [imageLoadCounter, setImageLoadCounter] = useState(0);

  // Derive selectedRegionIds from the regionStore so that selections made
  // from the Map Tree (or anywhere else that calls selectRegion) are
  // automatically reflected in the RegionControlBar.
  const selectedRegionIds = useMemo(
    () => regions.filter(r => r.selected).map(r => r.id),
    [regions]
  );
  const setSelectedRegionIds = useCallback((ids: string[] | ((prev: string[]) => string[])) => {
    const currentIds = regions.filter(r => r.selected).map(r => r.id);
    const newIds = typeof ids === 'function' ? ids(currentIds) : ids;
    // Deselect regions no longer in the list
    currentIds.forEach(id => { if (!newIds.includes(id)) deselectRegion(id); });
    // Select newly added regions
    newIds.forEach(id => { if (!currentIds.includes(id)) selectRegion(id); });
  }, [regions, selectRegion, deselectRegion]);
  const [isDraggingRegion, setIsDraggingRegion] = useState(false);
  const [draggedRegionId, setDraggedRegionId] = useState<string | null>(null);
  const [regionDragOffset, setRegionDragOffset] = useState({ x: 0, y: 0 });
  // Snapshot of the dragged region's start position — used to compute absolute delta (avoids compounding)
  const regionDragStartRef = useRef<{ x: number; y: number } | null>(null);
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

  // Snapshot of ALL group siblings captured at the start of a drag or rotation.
  // Using a ref (not state) so reads during mousemove never go stale.
  // We ALWAYS apply transforms relative to these snapshots, never to live store state,
  // to prevent the compounding-delta bug where every frame re-rotates an already-rotated entity.

  // The single shared pivot point for group rotation — computed fresh from ALL members at mousedown.
  // Using one centroid for the primary region AND all siblings guarantees they all orbit the same point.
  const groupRotationPivotRef = useRef<{ x: number; y: number } | null>(null);

  const groupSiblingSnapshotsRef = useRef<{
    [memberId: string]: {
      type: 'mapObject' | 'region' | 'light' | 'token';
      position?: { x: number; y: number };
      rotation?: number;
      wallPoints?: { x: number; y: number }[];
      x?: number; y?: number; width?: number; height?: number; regRotation?: number;
      pathPoints?: { x: number; y: number }[];
      bezierControlPoints?: { cp1: { x: number; y: number }; cp2: { x: number; y: number } }[];
      regionType?: 'rectangle' | 'path';
      lightPos?: { x: number; y: number };
    }
  }>({});

  // Frozen AABB of the group, captured at mousedown. Used for drawing the bounding box
  // during rotation so it doesn't drift as siblings are updated each frame.
  const groupFrozenAABBRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);

  // Temporary token positions during region drag to avoid store updates
  const [tempTokenPositions, setTempTokenPositions] = useState<{ [tokenId: string]: { x: number; y: number } }>();

  // Rotation state
  const [isRotatingRegion, setIsRotatingRegion] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);
  // Ref mirror of rotationStartAngle — readable in mousemove without stale-closure issues.
  const rotationStartAngleRef = useRef(0);
  const [tempRegionRotation, setTempRegionRotation] = useState<{ [regionId: string]: number }>({});
  
  // Marquee selection — use refs to avoid React re-renders (eliminates flicker)
  const isMarqueeSelectingRef = useRef(false);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeEndRef = useRef<{ x: number; y: number } | null>(null);
  // Keep a React state bool only for the completion check in mouseUp (not for rendering)
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const marqueeStart = marqueeStartRef.current;
  const marqueeEnd = marqueeEndRef.current;
  const marqueeDivRef = useRef<HTMLDivElement>(null);
  
  // Undo/Redo: Track initial states before transformations
  const [initialTokenState, setInitialTokenState] = useState<{ id: string; x: number; y: number } | null>(null);
  const [initialRegionState, setInitialRegionState] = useState<Partial<CanvasRegion> | null>(null);
  const [transformingRegionId, setTransformingRegionId] = useState<string | null>(null);
  
  // MapObject dragging state (for edit mode)
  const [isDraggingMapObject, setIsDraggingMapObject] = useState(false);
  const [draggedMapObjectId, setDraggedMapObjectId] = useState<string | null>(null);
  const [mapObjectDragOffset, setMapObjectDragOffset] = useState({ x: 0, y: 0 });

  // MapObject active tool: 'drag' | 'rotate' | 'points'
  const [mapObjectTool, setMapObjectTool] = useState<'drag' | 'rotate' | 'points'>('drag');

  // MapObject rotation drag state
  const [isRotatingMapObject, setIsRotatingMapObject] = useState(false);
  const [rotatingMapObjectId, setRotatingMapObjectId] = useState<string | null>(null);
  const [mapObjectRotationStartAngle, setMapObjectRotationStartAngle] = useState(0);
  const [mapObjectRotationStartValue, setMapObjectRotationStartValue] = useState(0);

  // MapObject scale/resize drag state
  const [isResizingMapObject, setIsResizingMapObject] = useState(false);
  const [mapObjectResizeHandle, setMapObjectResizeHandle] = useState<string | null>(null);
  const [mapObjectResizeSnapshot, setMapObjectResizeSnapshot] = useState<{
    id: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    rotation: number;
  } | null>(null);

  // Wall vertex dragging state
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [draggedVertexInfo, setDraggedVertexInfo] = useState<{ mapObjectId: string; vertexIndex: number } | null>(null);
  
  // Wall point edit mode - reset when selection changes
  const [wallPointEditMode, setWallPointEditMode] = useState(false);
  const prevSelectedMapObjectIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (JSON.stringify(prevSelectedMapObjectIdsRef.current) !== JSON.stringify(selectedMapObjectIds)) {
      setWallPointEditMode(false);
      setMapObjectTool('drag');
      prevSelectedMapObjectIdsRef.current = selectedMapObjectIds;
    }
  }, [selectedMapObjectIds]);
  
  // MapObject context menu state
  const [mapObjectContextMenu, setMapObjectContextMenu] = useState<{
    x: number;
    y: number;
    mapObjectId: string;
  } | null>(null);

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

  // ── Multi-map filtered entity lists ──

  // Filtered entity lists — only entities belonging to active maps (or unassigned legacy entities)
  const filteredTokens = useMemo(() => tokens.filter(t => isEntityVisible(t.mapId)), [tokens, isEntityVisible]);
  const filteredMapObjects = useMemo(() => mapObjects.filter(o => isEntityVisible(o.mapId)), [mapObjects, isEntityVisible]);
  const filteredRegions = useMemo(() => regions.filter(r => isEntityVisible(r.mapId)), [regions, isEntityVisible]);

  const { isInCombat, currentTurnIndex, initiativeOrder, restrictMovement } = useInitiativeStore();

  // ── Auto-focus follows active initiative token ──
  const autoFocusFollowsToken = useMapStore((s) => s.autoFocusFollowsToken);
  useEffect(() => {
    if (!autoFocusFollowsToken || !isInCombat || initiativeOrder.length === 0) return;
    const activeEntry = initiativeOrder[currentTurnIndex];
    if (!activeEntry) return;
    const activeToken = tokens.find(t => t.id === activeEntry.tokenId);
    if (!activeToken?.mapId) return;

    // ── Visibility gate: only recenter if the token is visible to the current player ──
    const { currentPlayerId, players } = useSessionStore.getState();
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const allRoles = useRoleStore.getState().roles;

    if (currentPlayer) {
      const playerRoles = currentPlayer.roleIds
        ? currentPlayer.roleIds.map(rid => allRoles.find(r => r.id === rid)).filter(Boolean)
        : [];
      const hasFogBypass = playerRoles.some(r => r?.permissions.canSeeAllFog);

      // Basic role-based visibility check
      if (!canSeeToken(activeToken, currentPlayer, allRoles)) {
        return; // Player can't see this token at all — skip recentering
      }

      // For non-DM players, also check if the token is hidden (isHidden flag)
      if (!hasFogBypass && activeToken.isHidden) {
        return;
      }
    }

    const currentSelectedMapId = useMapStore.getState().selectedMapId;
    if (activeToken.mapId !== currentSelectedMapId) {
      // Ensure target map is active
      const targetMap = useMapStore.getState().maps.find(m => m.id === activeToken.mapId);
      if (targetMap && !targetMap.active) {
        useMapStore.getState().updateMap(activeToken.mapId, { active: true });
      }
      useMapStore.getState().setSelectedMap(activeToken.mapId);
      // Center viewport on the active token after map switch
      requestAnimationFrame(() => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          setTransform(prev => ({
            x: canvas.width / 2 - activeToken.x * prev.zoom,
            y: canvas.height / 2 - activeToken.y * prev.zoom,
            zoom: prev.zoom,
          }));
        }
      });
    }
  }, [autoFocusFollowsToken, isInCombat, currentTurnIndex, initiativeOrder, tokens]);

  const registerCard = useCardStore((state) => state.registerCard);
  const getCardByType = useCardStore((state) => state.getCardByType);
  const setVisibility = useCardStore((state) => state.setVisibility);
  const bringToFront = useCardStore((state) => state.bringToFront);
  const cards = useCardStore((state) => state.cards);

  // Group store for selection propagation
  const getGroupForEntity = useGroupStore((state) => state.getGroupForEntity);

  /**
   * When an entity is clicked, check if it belongs to a group.
   * If so, select all sibling members across their respective stores.
   * Returns true if group propagation occurred.
   */
  const propagateGroupSelection = useCallback((entityId: string, entityType: 'token' | 'region' | 'mapObject' | 'light') => {
    // Always read from store at call time to avoid stale closure after rehydration
    const group = useGroupStore.getState().getGroupForEntity(entityId);
    if (!group) return false;

    // Collect IDs by type
    const tokenIds: string[] = [];
    const regionIds: string[] = [];
    const mapObjectIds: string[] = [];
    const lightIds: string[] = [];

    for (const member of group.members) {
      switch (member.type) {
        case 'token': tokenIds.push(member.id); break;
        case 'region': regionIds.push(member.id); break;
        case 'mapObject': mapObjectIds.push(member.id); break;
        case 'light': lightIds.push(member.id); break;
      }
    }

    // Select all siblings in their respective stores
    if (tokenIds.length > 0) setSelectedTokenIds(tokenIds);
    if (regionIds.length > 0) {
      clearSelection();
      regionIds.forEach(id => selectRegion(id));
      setSelectedRegionIds(regionIds);
    }
    if (mapObjectIds.length > 0) {
      useMapObjectStore.getState().selectMultiple(mapObjectIds);
    }
    if (lightIds.length > 0) {
      selectMultipleLights(lightIds);
    }

    return true;
  }, [clearSelection, selectRegion, selectMultipleLights]);

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

  // ── Portal teleportation: execute the actual teleport ──
  const executeTeleport = useCallback((tokenId: string, sourcePortalId: string, targetPortalId: string, dropPosition?: { x: number; y: number }) => {
    const allMapObjects = useMapObjectStore.getState().mapObjects;
    const sourcePortal = allMapObjects.find(obj => obj.id === sourcePortalId);
    const targetPortal = allMapObjects.find(obj => obj.id === targetPortalId);
    if (!sourcePortal || !targetPortal) return;

    // Trigger activation flash on source portal
    portalActivationsRef.current.set(sourcePortalId, performance.now());

    toast.success(`Teleporting to ${targetPortal.portalName || 'portal'}`, { duration: 1500 });

    // After brief delay (simulating fade), move token
    setTimeout(() => {
      // Compute relative offset from source portal center, map to target portal
      let targetX = targetPortal.position.x;
      let targetY = targetPortal.position.y;
      if (dropPosition && sourcePortal.width > 0 && sourcePortal.height > 0) {
        // Normalized offset (-0.5 to 0.5) within source portal
        const relX = (dropPosition.x - sourcePortal.position.x) / sourcePortal.width;
        const relY = (dropPosition.y - sourcePortal.position.y) / sourcePortal.height;
        // Apply same relative offset to target portal dimensions
        targetX += relX * targetPortal.width;
        targetY += relY * targetPortal.height;
      }
      updateTokenPosition(tokenId, targetX, targetY);

      // Trigger activation flash on target portal
      portalActivationsRef.current.set(targetPortalId, performance.now());

      // If target portal is on a different map, reassign token's mapId
      if (targetPortal.mapId && targetPortal.mapId !== sourcePortal.mapId) {
        useSessionStore.setState(state => ({
          tokens: state.tokens.map(t => t.id === tokenId ? { ...t, mapId: targetPortal.mapId } : t)
        }));

        const maps = useMapStore.getState().maps;
        const targetMap = maps.find(m => m.id === targetPortal.mapId);

        if (targetMap && !targetMap.active) {
          if (sourcePortal.portalAutoActivateTarget) {
            useMapStore.getState().updateMap(targetPortal.mapId!, { active: true });
            useMapStore.getState().setSelectedMap(targetPortal.mapId!);
            toast.success(`Map "${targetMap.name}" activated`, { duration: 2000 });
            requestAnimationFrame(() => {
              if (canvasRef.current) {
                const canvas = canvasRef.current;
                setTransform(prev => ({
                  x: canvas.width / 2 - targetX * prev.zoom,
                  y: canvas.height / 2 - targetY * prev.zoom,
                  zoom: prev.zoom,
                }));
              }
            });
          } else {
            toast.info(`Token moved to inactive map "${targetMap.name}"`, { duration: 3000 });
          }
        } else if ((sourcePortal.portalAutoActivateTarget || useMapStore.getState().autoFocusFollowsToken) && targetPortal.mapId) {
          useMapStore.getState().setSelectedMap(targetPortal.mapId);
          requestAnimationFrame(() => {
            if (canvasRef.current) {
              const canvas = canvasRef.current;
              setTransform(prev => ({
                x: canvas.width / 2 - targetX * prev.zoom,
                y: canvas.height / 2 - targetY * prev.zoom,
                zoom: prev.zoom,
              }));
            }
          });
        }
      }
    }, 300);
  }, [updateTokenPosition]);

  // ── Portal teleportation check — triggers DM confirmation or auto-teleport ──
  const checkPortalTeleport = useCallback((tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    const allMapObjects = useMapObjectStore.getState().mapObjects;

    // Find portal at token drop position (same map as the token)
    const tokenMapId = token.mapId ?? useMapStore.getState().selectedMapId;
    const portalAtDrop = allMapObjects.find(obj => {
      if (obj.category !== 'portal' || obj.shape !== 'portal') return false;
      const objMapId = obj.mapId ?? useMapStore.getState().selectedMapId;
      if (objMapId !== tokenMapId) return false;
      const cx = obj.position.x;
      const cy = obj.position.y;
      const dx = token.x - cx;
      const dy = token.y - cy;
      const portalRadius = Math.max(obj.width, obj.height) / 2;
      return dx * dx + dy * dy <= portalRadius * portalRadius;
    });

    if (!portalAtDrop || !portalAtDrop.portalTargetId) return;

    const targetPortal = allMapObjects.find(obj => obj.id === portalAtDrop.portalTargetId);
    if (!targetPortal) {
      toast.error('Portal target not found');
      return;
    }

    // Trigger activation flash on the source portal immediately
    portalActivationsRef.current.set(portalAtDrop.id, performance.now());

    // DM gets a confirmation prompt; non-DM teleports instantly
    if (isDM) {
      const dropPos = { x: token.x, y: token.y };
      setPendingTeleport({
        tokenId,
        tokenName: token.name || 'Token',
        sourcePortalId: portalAtDrop.id,
        sourcePortalName: portalAtDrop.portalName || 'Portal',
        targetPortalId: targetPortal.id,
        targetPortalName: targetPortal.portalName || 'Portal',
        dropPosition: dropPos,
      });
    } else {
      executeTeleport(tokenId, portalAtDrop.id, targetPortal.id, { x: token.x, y: token.y });
    }
  }, [tokens, isDM, executeTeleport]);

  // Global mouseup listener to ensure drag states are always reset
  useEffect(() => {
    if (isDraggingToken || isDraggingRegion || isPanning || isDraggingMapObject || isDraggingVertex || isRotatingMapObject) {
      const handleGlobalMouseUp = () => {
        // Reset all drag states
        if (isDraggingToken && draggedTokenId) {
          // Check for collision before finalizing the move
          const { enforceMovementBlocking, enforceRegionBounds, renderingMode } = useDungeonStore.getState();
          const shouldEnforceCollisions = renderingMode === 'play';
          
          console.log('[Collision Debug] Token drag ended', { enforceMovementBlocking, enforceRegionBounds, renderingMode });
          
          if (shouldEnforceCollisions && (enforceMovementBlocking || enforceRegionBounds)) {
            const draggedToken = tokens.find(t => t.id === draggedTokenId);
            if (draggedToken) {
              // Use center point only (radius = 0) - allows tokens to pass through corridors
              // as long as their center can fit, regardless of token visual size
              const tokenRadius = 0;
              
              const blockingObjects = enforceMovementBlocking ? getBlockingObjects(mapObjects) : [];
              const checkRegions = enforceRegionBounds ? regions : [];
              
              console.log('[Collision Debug] Checking path', dragStartPos, '->', { x: draggedToken.x, y: draggedToken.y });
              console.log('[Collision Debug] Blocking objects:', blockingObjects.length);
              
              const collisionResult = checkMovementCollision(
                dragStartPos,
                { x: draggedToken.x, y: draggedToken.y },
                tokenRadius,
                blockingObjects,
                checkRegions,
                { enforceMovementBlocking, enforceRegionBounds }
              );
              
              console.log('[Collision Debug] Result:', collisionResult);
              
              if (collisionResult.blocked) {
                // Show toast with details
                let blockReason = '';
                let blockDetails = '';
                if (collisionResult.collidedWith && collisionResult.collidedWith !== 'region_bounds') {
                  const blockingObj = mapObjects.find(obj => obj.id === collisionResult.collidedWith);
                  const objName = blockingObj?.label || blockingObj?.category || 'obstacle';
                  blockReason = blockingObj?.category === 'door' 
                    ? `Blocked by closed door` 
                    : `Blocked by ${objName}`;
                  blockDetails = `Object: ${blockingObj?.category}${blockingObj?.label ? ` "${blockingObj.label}"` : ''} (ID: ${collisionResult.collidedWith?.slice(0, 8)}...)`;
                } else {
                  blockReason = 'Left region boundary';
                  blockDetails = `Token tried to exit all regions (obstacle=${enforceMovementBlocking}, bounds=${enforceRegionBounds})`;
                }
                
                toast.error(blockReason, { 
                  duration: 3000,
                  description: blockDetails
                });
                
                // Snap back to original position
                updateTokenPosition(draggedTokenId, dragStartPos.x, dragStartPos.y);
              } else {
                toast.success('Movement valid', { duration: 800 });
                
                // Check for portal teleportation after valid movement
                checkPortalTeleport(draggedTokenId);
              }
            }
          } else {
            // No collision enforcement — still check portal teleport
            checkPortalTeleport(draggedTokenId);
          }
          
          emitDragEnd({ tokenId: draggedTokenId, finalPos: { x: tokens.find(t => t.id === draggedTokenId)?.x ?? 0, y: tokens.find(t => t.id === draggedTokenId)?.y ?? 0 } });
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
        } else if (isDraggingToken) {
          // Token drag without draggedTokenId - just reset state
          setIsDraggingToken(false);
          setDraggedTokenId(null);
          setDragOffset({ x: 0, y: 0 });
          setDragStartPos({ x: 0, y: 0 });
          setDragPath([]);
          setGroupedTokens([]);
          setTempTokenPositions(undefined);
          dragPreviewVisibilityRef.current = null;
          setDragPreviewPosition(null);
        }
        if (isDraggingRegion) {
          setIsDraggingRegion(false);
          setDraggedRegionId(null);
          setDragPreview(null);
        }
        if (isDraggingMapObject) {
          setIsDraggingMapObject(false);
          setDraggedMapObjectId(null);
          setMapObjectDragOffset({ x: 0, y: 0 });
        }
        if (isRotatingMapObject) {
          setIsRotatingMapObject(false);
          setRotatingMapObjectId(null);
        }
        if (isDraggingVertex) {
          setIsDraggingVertex(false);
          setDraggedVertexInfo(null);
        }
        if (isPanning) {
          setIsPanning(false);
        }
        if (isRotatingRegion) {
          setIsRotatingRegion(false);
          setTempRegionRotation({});
          groupFrozenAABBRef.current = null;
        }
      };

      window.addEventListener("mouseup", handleGlobalMouseUp);
      return () => {
        window.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDraggingToken, isDraggingRegion, isPanning, isRotatingRegion, isDraggingMapObject, isDraggingVertex, isRotatingMapObject]);

  // MapObject context menu is handled by Radix ContextMenu component
  // No need for manual click-outside handling - Radix handles it

  // Update highlights whenever tokens or regions change (but not during drag - handled separately)
  // ── Expire stale remote drag previews every 300ms ──
  useEffect(() => {
    const id = setInterval(() => {
      useDragPreviewStore.getState().expireStale(400);
    }, 300);
    return () => clearInterval(id);
  }, []);

  // ── Merge remote pings into activePings for animated rendering ──
  useEffect(() => {
    const remotePingValues = Object.values(remotePings);
    if (remotePingValues.length === 0) return;
    setActivePings((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const newPings = remotePingValues
        .filter((rp) => !existingIds.has(`remote-${rp.userId}-${rp.ts}`))
        .map((rp) => ({
          id: `remote-${rp.userId}-${rp.ts}`,
          pos: rp.pos,
          color: rp.color || "#fbbf24",
          ts: rp.ts,
        }));
      return newPings.length > 0 ? [...prev, ...newPings] : prev;
    });
  }, [remotePings]);

  // ── Ping animation loop — expire after 1s, redraw while active ──
  useEffect(() => {
    if (activePings.length === 0) return;
    const id = requestAnimationFrame(() => {
      const now = Date.now();
      setActivePings((prev) => prev.filter((p) => now - p.ts < 1000));
      redrawCanvas();
    });
    return () => cancelAnimationFrame(id);
  }, [activePings]);

  // ── Redraw canvas when remote ephemeral overlays change ──
  useEffect(() => {
    if (Object.keys(remoteDragPreviews).length > 0 ||
        Object.keys(remoteHovers).length > 0 ||
        Object.keys(remoteSelections).length > 0 ||
        Object.keys(remoteActionTargets).length > 0) {
      redrawCanvas();
    }
  }, [remoteDragPreviews, remoteHovers, remoteSelections, remoteActionTargets]);

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
        // Cancel targeting mode if active
        const actionS = useActionStore.getState();
        if (actionS.isTargeting) {
          actionS.cancelAction();
          redrawCanvas();
          return;
        }
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

  // Fit to View - calculates bounds of focused map's content and zooms to fit
  const handleFitToView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scope to focused map entities only
    const scopedTokens = selectedMapId
      ? tokens.filter(t => t.mapId === selectedMapId)
      : tokens;
    const scopedRegions = selectedMapId
      ? regions.filter(r => r.mapId === selectedMapId)
      : regions;
    const scopedMapObjects = selectedMapId
      ? mapObjects.filter(o => o.mapId === selectedMapId)
      : mapObjects;

    // Calculate bounding box of all content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    // Include tokens with their illumination radius
    scopedTokens.forEach(token => {
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
        maxRadius = fogVisionRange * 40;
      }
      
      const tokenRadius = Math.max(token.gridWidth, token.gridHeight) * 20;
      const totalRadius = tokenRadius + maxRadius;
      
      minX = Math.min(minX, tokenCenterX - totalRadius);
      minY = Math.min(minY, tokenCenterY - totalRadius);
      maxX = Math.max(maxX, tokenCenterX + totalRadius);
      maxY = Math.max(maxY, tokenCenterY + totalRadius);
    });

    // Include map objects
    scopedMapObjects.forEach(obj => {
      hasContent = true;
      minX = Math.min(minX, obj.position.x);
      minY = Math.min(minY, obj.position.y);
      maxX = Math.max(maxX, obj.position.x + (obj.width ?? 0));
      maxY = Math.max(maxY, obj.position.y + (obj.height ?? 0));
    });

    // Include explored fog areas for the focused map
    const activeExplored = getActiveExploredArea();
    if (activeExplored) {
      const bounds = activeExplored.bounds;
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        hasContent = true;
        minX = Math.min(minX, bounds.left);
        minY = Math.min(minY, bounds.top);
        maxX = Math.max(maxX, bounds.right);
        maxY = Math.max(maxY, bounds.bottom);
      }
    }

    // Include visible regions
    scopedRegions.forEach(region => {
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
    const newZoom = Math.min(zoomX, zoomY, 5);

    // Calculate center of content
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // Set transform to center on content at calculated zoom
    setTransform({
      x: canvasWidth / 2 - contentCenterX * newZoom,
      y: canvasHeight / 2 - contentCenterY * newZoom,
      zoom: Math.max(0.1, newZoom),
    });

    const mapLabel = selectedMapId
      ? maps.find(m => m.id === selectedMapId)?.name ?? 'map'
      : 'all maps';
    toast.success(`Fit to view: ${mapLabel} (${Math.round(newZoom * 100)}%)`);
  }, [tokens, regions, mapObjects, fogVisionRange, setTransform, selectedMapId, maps]);

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

    // Load serialized explored areas per map
    if (fogEnabled && serializedExploredAreasPerMap) {
      const scope = fogScopeRef.current;
      if (scope) {
        for (const [mapId, data] of Object.entries(serializedExploredAreasPerMap)) {
          if (data) {
            const deserialized = deserializeFogGeometry(data, scope);
            if (deserialized) {
              exploredAreasMapRef.current.set(mapId, deserialized);
            }
          }
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
      exploredAreasMapRef.current.clear();
      currentVisibilityRef.current = null;
      fogMasksRef.current = null;
      fogSerializeSourceRef.current = true;
      clearExploredAreas();
    }
  }, [fogEnabled, clearExploredAreas]);

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

  // Track whether we are the source of the serialized change (to avoid redundant deserialization)
  const fogSerializeSourceRef = useRef(false);

  useEffect(() => {
    // When serialized explored areas change from an external source (undo/redo, remote sync),
    // deserialize back into the Paper.js refs and invalidate fog masks.
    if (fogSerializeSourceRef.current) {
      fogSerializeSourceRef.current = false;
      redrawCanvas();
      return;
    }
    if (fogEnabled && serializedExploredAreasPerMap && fogScopeRef.current) {
      for (const [mapId, data] of Object.entries(serializedExploredAreasPerMap)) {
        if (data) {
          const deserialized = deserializeFogGeometry(data, fogScopeRef.current);
          if (deserialized) {
            exploredAreasMapRef.current.set(mapId, deserialized);
          }
        } else {
          exploredAreasMapRef.current.delete(mapId);
        }
      }
    } else if (!serializedExploredAreasPerMap || Object.keys(serializedExploredAreasPerMap).length === 0) {
      exploredAreasMapRef.current.clear();
    }
    fogMasksRef.current = null; // Force fog mask recomputation
    redrawCanvas();
  }, [serializedExploredAreasPerMap]);

  // Redraw when map objects change (e.g., door toggle)
  // Must also update combined segments and clear visibility cache
  useEffect(() => {
    // Update combined segments with new map object state
    if (wallGeometryRef.current) {
      const mapObjectSegments = mapObjectsToSegments(mapObjects);
      combinedSegmentsRef.current = [...wallGeometryRef.current.wallSegments, ...mapObjectSegments, ...importedWallSegments];
    }
    
    // Clear visibility caches so fog recalculates with new segments
    notifyObstaclesChanged();
    tokenVisibilityCacheRef.current.clear();
    clearVisibilityCache(); // Also clear the global visibility cache
    
    // Use requestAnimationFrame to ensure redraw happens after React's state update cycle
    // This prevents stale closures from causing out-of-sync renders
    requestAnimationFrame(() => {
      redrawCanvas();
    });
  }, [mapObjects]);

  // Cleanup fog state when switching from edit/dm → play mode
  useEffect(() => {
    const wasEdit = prevRenderingModeRef.current !== 'play';
    const isNowPlay = renderingMode === 'play';
    prevRenderingModeRef.current = renderingMode;

    if (!wasEdit || !isNowPlay) return;

    console.log('[Fog] Mode transition edit→play: flushing all visibility caches');

    // 1. Rebuild combined wall+obstacle segments from fresh state
    if (wallGeometryRef.current) {
      const mapObjectSegments = mapObjectsToSegments(mapObjects);
      combinedSegmentsRef.current = [
        ...wallGeometryRef.current.wallSegments,
        ...mapObjectSegments,
        ...importedWallSegments,
      ];
    }

    // 2. Notify light system that obstacle geometry has changed
    notifyObstaclesChanged();

    // 3. Clear all per-token visibility caches
    tokenVisibilityCacheRef.current.forEach((cached) => {
      if (cached?.visionPath?.remove) cached.visionPath.remove();
    });
    tokenVisibilityCacheRef.current.clear();
    prevTokenPositionsRef.current.clear();
    prevTokenIlluminationRef.current?.clear?.();

    // 4. Clear global Paper.js / visibility-polygon cache
    clearVisibilityCache();

    // 5. Null out the fog mask so fog computation cannot use the stale masks
    fogMasksRef.current = null;

    // 6. Reset PixiJS post-processing layer for a clean frame
    if (isPostProcessingReadyRef.current) {
      setPostProcessingVisible(false);
      requestAnimationFrame(() => {
        setPostProcessingVisible(true);
        redrawCanvas();
      });
    } else {
      redrawCanvas();
    }
  }, [renderingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // DM escape hatch: listen for manual fog-refresh requests from the UI
  useEffect(() => {
    const handleForceFogRefresh = () => {
      console.log('[Fog] Force refresh triggered by DM');

      // 1. Rebuild combined wall+obstacle segments from fresh state
      if (wallGeometryRef.current) {
        const mapObjectSegments = mapObjectsToSegments(mapObjects);
        combinedSegmentsRef.current = [
          ...wallGeometryRef.current.wallSegments,
          ...mapObjectSegments,
          ...importedWallSegments,
        ];
      }

      // 2. Notify light system that obstacle geometry has changed
      notifyObstaclesChanged();

      // 3. Clear all per-token visibility caches
      tokenVisibilityCacheRef.current.forEach((cached) => {
        if (cached?.visionPath?.remove) cached.visionPath.remove();
      });
      tokenVisibilityCacheRef.current.clear();
      prevTokenPositionsRef.current.clear();
      prevTokenIlluminationRef.current?.clear?.();

      // 4. Clear global Paper.js / visibility-polygon cache
      clearVisibilityCache();

      // 5. Null out the fog mask to force fresh computation
      fogMasksRef.current = null;

      // 6. Reset PixiJS post-processing layer for a clean frame
      if (isPostProcessingReadyRef.current) {
        setPostProcessingVisible(false);
        requestAnimationFrame(() => {
          setPostProcessingVisible(true);
          redrawCanvas();
        });
      } else {
        redrawCanvas();
      }
    };

    window.addEventListener('fog:force-refresh', handleForceFogRefresh);
    return () => window.removeEventListener('fog:force-refresh', handleForceFogRefresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute fog of war masks when tokens move or fog settings change
  // Skip during dragging to prevent stuttering
  useEffect(() => {
    if (!fogEnabled || fogRevealAll) {
      // Fog explicitly disabled — clear masks
      fogMasksRef.current = null;
      return;
    }
    if (!wallGeometryRef.current || !fogScopeRef.current) {
      // Prerequisites not ready yet — keep existing masks (if any) to avoid black flash.
      // They'll be replaced once prerequisites are available on a subsequent run.
      return;
    }

    // Skip fog computation while dragging tokens to prevent stuttering
    if (isDraggingToken) {
      wasDraggingTokenRef.current = true;
      return;
    }
    
    // When drag just ended, clear all caches to force full recomputation
    // Paper.js cached paths can become stale after drag operations
    if (wasDraggingTokenRef.current) {
      wasDraggingTokenRef.current = false;
      tokenVisibilityCacheRef.current.forEach((cached) => {
        if (cached?.visionPath?.remove) cached.visionPath.remove();
      });
      tokenVisibilityCacheRef.current.clear();
      prevTokenPositionsRef.current.clear();
      console.log('[Fog] Drag ended — cleared all visibility caches for full recomputation');
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
          // Use combined segments (walls + vision-blocking map objects)
          const tokensForVision = getTokensForVisionCalculation(
            filteredTokens,
            currentPlayer,
            roles,
            combinedSegmentsRef.current,
          );

          // Only consider tokens with vision enabled
          const tokensWithVision = tokensForVision.filter((t) => t.hasVision !== false);
          
          console.log(`[Fog] Vision tokens: ${tokensWithVision.length}/${tokens.length}, cache: ${tokenVisibilityCacheRef.current.size}, visData: ${tokenVisibilityDataRef.current.length}`);
          const movedTokens: typeof tokens = [];
          const illuminationChangedTokens: typeof tokens = [];
          const currentTokenIds = new Set(tokensWithVision.map((t) => t.id));

          // Track tokens whose vision state or illumination range changed
          let visionStateChanged = false;
          let illuminationSettingsChanged = false;

          tokensWithVision.forEach((token) => {
            const prevPos = prevTokenPositionsRef.current.get(token.id);
            if (!prevPos || prevPos.x !== token.x || prevPos.y !== token.y) {
              movedTokens.push(token);
            }
            
            // Check if illumination range changed (requires visibility polygon recomputation)
            const prevIllum = prevTokenIlluminationRef.current.get(token.id);
            const currentRange = token.illuminationSources?.[0]?.range ?? token.visionRange ?? fogVisionRange;
            if (prevIllum?.range !== currentRange) {
              // Range changed - need to recompute visibility polygon
              if (!movedTokens.includes(token)) {
                illuminationChangedTokens.push(token);
              }
            }
            
            // Check if other illumination settings changed (doesn't require polygon recomputation)
            // Create a simple hash of relevant settings for comparison
            const settingsHash = token.illuminationSources?.[0] 
              ? JSON.stringify({
                  brightZone: token.illuminationSources[0].brightZone,
                  brightIntensity: token.illuminationSources[0].brightIntensity,
                  dimIntensity: token.illuminationSources[0].dimIntensity,
                  color: token.illuminationSources[0].color,
                  colorEnabled: token.illuminationSources[0].colorEnabled,
                  animation: token.illuminationSources[0].animation,
                })
              : '';
            if (prevIllum?.settingsHash !== settingsHash) {
              illuminationSettingsChanged = true;
            }
            
            // Update tracking for next comparison
            prevTokenIlluminationRef.current.set(token.id, {
              range: currentRange,
              settingsHash,
            });
          });

          // Remove cached visibility for tokens that no longer exist OR lost vision
          const cachedIds = Array.from(tokenVisibilityCacheRef.current.keys());
          cachedIds.forEach((id) => {
            if (!currentTokenIds.has(id)) {
              const cached = tokenVisibilityCacheRef.current.get(id);
              if (cached?.visionPath?.remove) cached.visionPath.remove();
              tokenVisibilityCacheRef.current.delete(id);
              prevTokenPositionsRef.current.delete(id);
              prevTokenIlluminationRef.current.delete(id);
              visionStateChanged = true; // Vision was disabled for this token
            }
          });

          // Check if map object blocking state changed (e.g., door toggled)
          // This creates a hash of all vision-blocking objects to detect changes
          const mapObjectsBlockingHash = mapObjects
            .filter(obj => obj.blocksVision || obj.category === 'door')
            .map(obj => `${obj.id}:${obj.blocksVision}:${obj.isOpen}`)
            .join('|');
          const mapObjectsBlockingChanged = mapObjectsBlockingHash !== prevMapObjectsBlockingRef.current;
          if (mapObjectsBlockingChanged) {
            prevMapObjectsBlockingRef.current = mapObjectsBlockingHash;
            // Clear all cached visibility polygons since blocking geometry changed
            tokenVisibilityCacheRef.current.forEach((cached) => {
              if (cached?.visionPath?.remove) cached.visionPath.remove();
            });
            tokenVisibilityCacheRef.current.clear();
          }

          // Determine what needs to be recomputed
          const tokensNeedingVisibilityRecompute = mapObjectsBlockingChanged 
            ? tokensWithVision  // All tokens need recompute if blocking geometry changed
            : [...movedTokens, ...illuminationChangedTokens];
          
          // Get light MapObjects as light sources for fog (only from active maps)
          const lightMapObjectSources = filteredMapObjects.filter(
            (obj) => obj.category === 'light' && obj.lightEnabled !== false
          );
          
          // Check if token visibility data ref is stale (wrong count vs cache)
          const visDataStale = tokenVisibilityDataRef.current.length !== 
            (tokenVisibilityCacheRef.current.size + lights.filter(l => l.enabled).length + lightMapObjectSources.length);

          // If no tokens need visibility recomputation AND illumination settings didn't change,
          // skip the expensive Paper.js visibility polygon computation.
          // BUT still rebuild tokenVisibilityDataRef if it's stale (wrong source count).
          const canSkipPolygonComputation = (
            tokensNeedingVisibilityRecompute.length === 0 &&
            !visionStateChanged &&
            !illuminationSettingsChanged &&
            !mapObjectsBlockingChanged &&
            tokenVisibilityCacheRef.current.size === tokensWithVision.length &&
            fogMasksRef.current !== null &&
            !visDataStale
          );

          if (canSkipPolygonComputation) {
            console.log(`[Fog] Early-exit: all ${tokenVisibilityCacheRef.current.size} cached, visData=${tokenVisibilityDataRef.current.length}`);
            return;
          }

          // If polygons are all cached but vis data is stale, skip recomputation
          // but still rebuild the vis data and masks below
          const skipPolygonRecomputation = (
            tokensNeedingVisibilityRecompute.length === 0 &&
            !visionStateChanged &&
            !mapObjectsBlockingChanged &&
            tokenVisibilityCacheRef.current.size === tokensWithVision.length
          );
          
          console.log(`[Fog] Computing: recompute=${tokensNeedingVisibilityRecompute.length}, visionChanged=${visionStateChanged}, illuminChanged=${illuminationSettingsChanged}, visDataStale=${visDataStale}, skipPolygons=${skipPolygonRecomputation}`);

          // Compute visibility only for tokens that moved or had illumination range changes
          // Skip if all polygons are already cached and only vis data needs rebuilding
          if (!skipPolygonRecomputation) {
          for (const token of tokensNeedingVisibilityRecompute) {
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
            // Use combined segments (walls + vision-blocking map objects)
            const tokenVision = await computeTokenVisibilityPaper(
              [token],
              combinedSegmentsRef.current,
              wallGeometry,
              visionRangePixels,
            );

            // Cache the new vision path with illumination range for change detection.
            // Also store a raw (non-circle-clipped) wall-occlusion Path2D for illumination.
            // This avoids the paper.js scope mismatch that caused diagonal wedge clipping.
            let wallOcclusionPath: Path2D | undefined;
            if (combinedSegmentsRef.current.length > 0) {
              const rawVis = computeVisibilityFromSegments(
                { x: token.x, y: token.y },
                combinedSegmentsRef.current,
                visionRangePixels
              );
              if (rawVis.polygon.length > 2) {
                wallOcclusionPath = visibilityPolygonToPath2D(rawVis.polygon);
              }
            }
            tokenVisibilityCacheRef.current.set(token.id, {
              position: { x: token.x, y: token.y },
              visionPath: tokenVision,
              illuminationRange: visionRangePixels,
              wallOcclusionPath,
            });

            // Update previous position
            prevTokenPositionsRef.current.set(token.id, { x: token.x, y: token.y });
          }
          } // end skipPolygonRecomputation check

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

          // Merge into explored areas (per-map)
          const activeExplored = getActiveExploredArea();
          setActiveExploredArea(addVisibleToExplored(activeExplored, combinedVisibility));

          // Clean up combined visibility
          if (combinedVisibility.remove) combinedVisibility.remove();

          // Serialize for persistence
          const currentMapId = selectedMapId || 'default-map';
          const serialized = serializeFogGeometry(getActiveExploredArea());
          if (serialized) {
            fogSerializeSourceRef.current = true;
            setSerializedExploredAreasForMap(currentMapId, serialized);
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

          const masks = computeFogMasks(getActiveExploredArea(), visibilityForMask, worldBounds);

          // Store individual token visibility data for rendering
          const tokenVisData: Array<{
            position: { x: number; y: number };
            visionRange: number;
            visibilityPath: Path2D;
            wallOcclusionPath?: Path2D;
            isLightSource?: boolean;
            tokenIllumination?: typeof tokens[0]['illuminationSources'];
            mapObjectLightData?: { lightColor?: string; lightRadius?: number; lightBrightRadius?: number; lightIntensity?: number };
          }> = [];

          tokenVisibilityCacheRef.current.forEach((cached, tokenId) => {
            if (!cached.visionPath) return;

            // Find the token to get its vision range and gradient settings
            const token = filteredTokens.find((t) => t.id === tokenId);
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
              // Use the raw (non-circle-clipped) wall-occlusion path for illumination clipping.
              // This prevents the diagonal wedge caused by paper.js scope mismatch.
              wallOcclusionPath: cached.wallOcclusionPath,
              isLightSource: false, // Tokens are not light sources
              tokenIllumination: token.illuminationSources,
            });
          });

          // Add enabled light sources from lightStore to fog revelation (only from active maps)
          const enabledLights = lights.filter((l) => l.enabled && isEntityVisible(l.mapId));
          for (const light of enabledLights) {
            const lightVision = await computeTokenVisibilityPaper(
              [{ x: light.position.x, y: light.position.y, id: light.id, gridWidth: 1, gridHeight: 1 }],
              combinedSegmentsRef.current,
              wallGeometry,
              light.radius,
            );

            if (lightVision) {
              const lightPath2D = paperPathToPath2D(lightVision);
              tokenVisData.push({
                position: light.position,
                visionRange: light.radius,
                visibilityPath: lightPath2D,
                isLightSource: true,
              });
              if (lightVision.remove) lightVision.remove();
            }
          }
          
          // Add enabled light MapObjects to fog revelation
          for (const lightObj of lightMapObjectSources) {
            const radius = lightObj.lightRadius || 100;
            const lightId = `map-light-${lightObj.id || Math.random()}`;
            const lightVision = await computeTokenVisibilityPaper(
              [{ x: lightObj.position.x, y: lightObj.position.y, id: lightId, gridWidth: 1, gridHeight: 1 }],
              combinedSegmentsRef.current,
              wallGeometry,
              radius,
            );

            if (lightVision) {
              const lightPath2D = paperPathToPath2D(lightVision);
              tokenVisData.push({
                position: lightObj.position,
                visionRange: radius,
                visibilityPath: lightPath2D,
                isLightSource: true,
                mapObjectLightData: {
                  lightColor: lightObj.lightColor,
                  lightRadius: lightObj.lightRadius,
                  lightBrightRadius: lightObj.lightBrightRadius,
                  lightIntensity: lightObj.lightIntensity,
                },
              });
              if (lightVision.remove) lightVision.remove();
            }
          }

          console.log(`[Fog] Built visData: ${tokenVisData.length} sources (${tokenVisData.filter(t => !t.isLightSource).length} tokens, ${tokenVisData.filter(t => t.isLightSource).length} lights)`);
          tokenVisibilityDataRef.current = tokenVisData;
          // Invalidate cached illumination sources so they're rebuilt on next frame
          illuminationSourcesCacheRef.current = null;

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
    // NOTE: transform.x/y/zoom intentionally excluded — pan/zoom don't change
    // visibility polygons or fog masks, and including them caused expensive
    // Paper.js computations on every mouse-move during canvas drag.
  }, [
    tokens,
    lights,
    fogEnabled,
    fogRevealAll,
    fogVisionRange,
    isDraggingToken,
    setSerializedExploredAreasForMap,
    renderingMode,
    regions,
    mapObjects, // Re-compute fog when map objects change (they may block vision)
    effectSettings.lightFalloff,
    exploredOpacity,
    players, // Re-compute when player data changes (role assignments affect vision)
    currentPlayerId, // Re-compute when active player changes
    roles, // Re-compute when roles change (permissions affect which tokens get vision)
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

    // Focus-based selection locking
    const focusState = useMapFocusStore.getState();
    const focusLock = focusState.selectionLockEnabled || isFocusEffectActive(focusState);

    // Check tokens in reverse order (top to bottom)
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];

      // Skip tokens on non-focused maps when focus lock is active
      if (focusLock && selectedMapId && token.mapId !== undefined && token.mapId !== selectedMapId) {
        continue;
      }
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
            getActiveExploredArea(),
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
    // Focus-based selection locking
    const focusState = useMapFocusStore.getState();
    const focusLock = focusState.selectionLockEnabled || isFocusEffectActive(focusState);

    // Check regions in reverse order (top to bottom)
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];

      // Skip regions on non-focused maps when focus lock is active
      if (focusLock && selectedMapId && region.mapId !== undefined && region.mapId !== selectedMapId) {
        continue;
      }

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
      const rotation = region.rotation || 0;

      // Un-rotate mouse position into region-local space so we can
      // hit-test against axis-aligned handle positions
      let localX = worldX;
      let localY = worldY;
      if (rotation !== 0) {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const rad = -(rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        localX = cos * (worldX - cx) - sin * (worldY - cy) + cx;
        localY = sin * (worldX - cx) + cos * (worldY - cy) + cy;
      }

      // Check corner handles
      if (Math.abs(localX - x) <= handleSize && Math.abs(localY - y) <= handleSize) return "nw";
      if (Math.abs(localX - (x + width)) <= handleSize && Math.abs(localY - y) <= handleSize) return "ne";
      if (Math.abs(localX - x) <= handleSize && Math.abs(localY - (y + height)) <= handleSize) return "sw";
      if (Math.abs(localX - (x + width)) <= handleSize && Math.abs(localY - (y + height)) <= handleSize) return "se";

      // Check edge handles
      if (Math.abs(localX - (x + width / 2)) <= handleSize && Math.abs(localY - y) <= handleSize) return "n";
      if (Math.abs(localX - (x + width)) <= handleSize && Math.abs(localY - (y + height / 2)) <= handleSize) return "e";
      if (Math.abs(localX - (x + width / 2)) <= handleSize && Math.abs(localY - (y + height)) <= handleSize) return "s";
      if (Math.abs(localX - x) <= handleSize && Math.abs(localY - (y + height / 2)) <= handleSize) return "w";

      return null;
    }
  };

  // Image cache with LRU eviction to prevent unbounded memory growth
  const imageCache = useRef(new LRUImageCache(200));

  // Helper to get or load a cached image (must be defined before redrawCanvas)
  // For animated GIFs, returns the current frame's ImageBitmap
  const getCachedImage = (url: string): HTMLImageElement | ImageBitmap | null => {
    if (!url) return null;
    
    // Check for animated texture first - returns current frame if animated
    const animatedFrame = animatedTextureManager.getCurrentFrame(url);
    if (animatedFrame) return animatedFrame;
    
    // If it might be animated but not loaded yet, preload it
    if (animatedTextureManager.mightBeAnimated(url)) {
      animatedTextureManager.preload(url);
    }
    
    // Fall back to static image cache
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

    // ── Multi-map filtering: shadow raw store arrays with map-scoped versions ──
    // All rendering code below uses these local aliases instead of the raw store data.
    const tokens = filteredTokens;
    const mapObjects = filteredMapObjects;
    const regions = filteredRegions;

    // ── Map focus blur/fade ──
    const focusState = useMapFocusStore.getState();
    const focusActive = isFocusEffectActive(focusState);
    const currentSelectedMapId = useMapStore.getState().selectedMapId;

    /** Apply dim/blur for entities on non-focused maps. Returns true if effects were applied. */
    const applyFocusDim = (ctx: CanvasRenderingContext2D, entityMapId: string | undefined): boolean => {
      if (!focusActive || !currentSelectedMapId) return false;
      if (entityMapId === undefined || entityMapId === currentSelectedMapId) return false;
      ctx.save();
      ctx.globalAlpha *= focusState.unfocusedOpacity;
      if (focusState.unfocusedBlur > 0) {
        ctx.filter = `blur(${focusState.unfocusedBlur}px)`;
      }
      return true;
    };

    /** Restore context after focus dim. Only call if applyFocusDim returned true. */
    const restoreFocusDim = (ctx: CanvasRenderingContext2D) => {
      ctx.restore();
    };

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
        visibleTokens.push({ ...checkToken, _focusDimmed: focusActive && currentSelectedMapId && checkToken.mapId !== undefined && checkToken.mapId !== currentSelectedMapId });
      } else {
        offScreenTokens.push(checkToken);
      }
    });

    // Water/trap terrain is now rendered as MapObjects (shape: 'custom', category: 'water'|'trap')
    // No explicit renderTerrainFeatures call needed — handled by the MapObject renderer below.

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
        
        // Skip rendering if region is outside viewport.
        // Use a zoom-aware margin so partially-visible large regions are never culled.
        // The margin is at least 200 world units, but scales up at low zoom so large
        // regions whose bounding box starts off-screen are still rendered correctly.
        const viewportMargin = Math.max(200, 500 / transform.zoom);
        if (!isInViewport(regionBounds, viewport, viewportMargin)) {
          return;
        }
        
        const dimmed = applyFocusDim(ctx, region.mapId);
        drawRegion(ctx, region, true); // skipStroke = true for both modes
        if (dimmed) restoreFocusDim(ctx);
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
      
      // Update combined segments (walls + vision-blocking map objects + imported walls) - even with cached walls
      const mapObjectSegments = mapObjectsToSegments(mapObjects);
      combinedSegmentsRef.current = [...wallGeometry.wallSegments, ...mapObjectSegments, ...importedWallSegments];
    } else {
      // Generate new decorations and cache them.
      // Build extra bounds points so the outer wall bounding box encompasses ALL content.
      // Without this, anything outside region bounds causes the visibility engine to treat
      // the region boundary corner as an invisible occluder (producing hard light cutoffs
      // and 45-degree diagonal clipping near bounding-box corners).
      //
      // We include:
      //  • Map object positions (walls, obstacles, doors)
      //  • Map object LIGHT RADII — the bounding box must reach the outer edge of each
      //    light's illumination circle, not just its center
      //  • Token positions — tokens near a bounding-box corner get 45° shadow artifacts
      //  • LightStore light positions + radii
      const extraBoundsPoints: { x: number; y: number }[] = [];

      for (const mo of mapObjects) {
        if (mo.wallPoints && mo.wallPoints.length > 0) {
          // Wall polylines: include every vertex
          extraBoundsPoints.push(...mo.wallPoints);
        } else {
          // Non-wall: include center
          extraBoundsPoints.push(mo.position);
          // If it's a light object, also include its four radius-edge points so the
          // outer bounding box extends to the full illumination circle
          if (mo.category === 'light' && mo.lightRadius) {
            const r = mo.lightRadius;
            extraBoundsPoints.push(
              { x: mo.position.x - r, y: mo.position.y },
              { x: mo.position.x + r, y: mo.position.y },
              { x: mo.position.x, y: mo.position.y - r },
              { x: mo.position.x, y: mo.position.y + r },
            );
          }
        }
      }

      // Include token positions so tokens near the boundary don't get 45° clipping
      for (const token of tokens) {
        extraBoundsPoints.push({ x: token.x, y: token.y });
      }

      // Include LightStore lights (position + radius)
      for (const light of lights) {
        const r = light.radius;
        extraBoundsPoints.push(
          { x: light.position.x - r, y: light.position.y },
          { x: light.position.x + r, y: light.position.y },
          { x: light.position.x, y: light.position.y - r },
          { x: light.position.x, y: light.position.y + r },
        );
      }

      const negativeSpace = generateNegativeSpaceRegion(regions, 15, margin, extraBoundsPoints);
      if (negativeSpace) {
        wallGeometry = negativeSpace.wallGeometry;

        // Create offscreen canvas for decorations
        const offscreenCanvas = document.createElement("canvas");
        const bounds = wallGeometry.bounds;
        const padding = 50; // Extra padding for thick walls
        offscreenCanvas.width = Math.max(1, Math.ceil(bounds.width + padding * 2));
        offscreenCanvas.height = Math.max(1, Math.ceil(bounds.height + padding * 2));

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
        
        // Update combined segments (walls + vision-blocking map objects + imported walls)
        const mapObjectSegments = mapObjectsToSegments(mapObjects);
        combinedSegmentsRef.current = [...wallGeometry.wallSegments, ...mapObjectSegments, ...importedWallSegments];
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
    if (cachedCanvas && wallDecorationCacheRef.current && cachedCanvas.width > 0 && cachedCanvas.height > 0) {
      const cacheBounds = wallDecorationCacheRef.current.bounds;
      ctx.drawImage(cachedCanvas, cacheBounds.x, cacheBounds.y);
    }

    // NEW: Render shadows using visibility polygon system
    // Use combined segments (walls + vision-blocking map objects)
    if (isPlayMode && lights.length > 0 && wallGeometry) {
      const illumination = computeIllumination(lights, combinedSegmentsRef.current, wallGeometry);
      renderShadows(ctx, regions, illumination, shadowIntensity, globalAmbientLight);
    }

    // 4. Doors are now rendered as MapObjects, so old door rendering is deprecated
    // Legacy door data from dungeonStore is still imported but converted to MapObjects

    // 5. Render map objects (columns, statues, etc.) - after walls so shadows work
    // First render shadows from shadow-casting objects
    const { lightDirection, shadowDistance } = useDungeonStore.getState();
    const shadowCastingObjects = mapObjects.filter(obj => obj.castsShadow);
    if (shadowCastingObjects.length > 0) {
      renderMapObjectShadows(
        ctx,
        shadowCastingObjects,
        shadowDistance,
        lightDirection,
        'rgba(0, 0, 0, 0.25)'
      );
    }
    
    // Compute portal activation flash progress (0-1, 600ms duration)
    const now = performance.now();
    const FLASH_DURATION = 600;
    let portalActivations: Map<string, number> | undefined;
    const activations = portalActivationsRef.current;
    if (activations.size > 0) {
      portalActivations = new Map();
      for (const [id, startTime] of activations) {
        const elapsed = now - startTime;
        if (elapsed >= FLASH_DURATION) {
          activations.delete(id);
        } else {
          portalActivations.set(id, elapsed / FLASH_DURATION);
        }
      }
      if (portalActivations.size === 0) portalActivations = undefined;
    }

    // Then render the map objects themselves
    // Pass isDM for DM-specific UI (door toggle indicators) — but NOT in play mode
    // so light centers, radius rings, and other editor chrome are hidden from everyone in play mode.
    if (focusActive && currentSelectedMapId) {
      // Two-pass render: non-focused (dimmed) first, then focused on top
      const unfocusedObjs = mapObjects.filter(o => o.mapId !== undefined && o.mapId !== currentSelectedMapId);
      const focusedObjs = mapObjects.filter(o => o.mapId === undefined || o.mapId === currentSelectedMapId);
      if (unfocusedObjs.length > 0) {
        ctx.save();
        ctx.globalAlpha *= focusState.unfocusedOpacity;
        if (focusState.unfocusedBlur > 0) ctx.filter = `blur(${focusState.unfocusedBlur}px)`;
        renderMapObjects(ctx, unfocusedObjs, transform.zoom, selectedMapObjectIds, watabouStyle, isDM && renderingMode !== 'play', portalActivations);
        ctx.restore();
      }
      renderMapObjects(ctx, focusedObjs, transform.zoom, selectedMapObjectIds, watabouStyle, isDM && renderingMode !== 'play', portalActivations);
    } else {
      renderMapObjects(ctx, mapObjects, transform.zoom, selectedMapObjectIds, watabouStyle, isDM && renderingMode !== 'play', portalActivations);
    }

    // Draw scale handles + rotation handle on selected, unlocked, non-wall map objects (edit mode)
    if (renderingMode === 'edit' && selectedMapObjectIds.length === 1) {
      const selObj = mapObjects.find(o => o.id === selectedMapObjectIds[0] && !o.locked && o.shape !== 'wall');
      if (selObj && !useGroupStore.getState().isEntityInAnyGroup(selObj.id)) {
        const hSize = 10 / transform.zoom;
        const rotation = selObj.rotation || 0;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad); const sin = Math.sin(rad);
        const cx = selObj.position.x;
        const cy = selObj.position.y;
        const hw = selObj.width / 2;
        const hh = selObj.height / 2;

        // Helper: rotate a point around the object center
        const rotPt = (px: number, py: number) => ({
          x: cx + (px - cx) * cos - (py - cy) * sin,
          y: cy + (px - cx) * sin + (py - cy) * cos,
        });

        // 8 handle positions (local, before rotation)
        const rawHandles = [
          { x: cx - hw, y: cy - hh }, // nw
          { x: cx,      y: cy - hh }, // n
          { x: cx + hw, y: cy - hh }, // ne
          { x: cx + hw, y: cy      }, // e
          { x: cx + hw, y: cy + hh }, // se
          { x: cx,      y: cy + hh }, // s
          { x: cx - hw, y: cy + hh }, // sw
          { x: cx - hw, y: cy      }, // w
        ];

        ctx.save();
        ctx.fillStyle = '#4f46e5';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / transform.zoom;

        rawHandles.forEach(h => {
          const r = rotPt(h.x, h.y);
          ctx.save();
          ctx.translate(r.x, r.y);
          ctx.rotate(rad);
          ctx.fillRect(-hSize / 2, -hSize / 2, hSize, hSize);
          ctx.strokeRect(-hSize / 2, -hSize / 2, hSize, hSize);
          ctx.restore();
        });

        // Rotation handle
        const dist = 30 / transform.zoom;
        const rawRotHandle = rotPt(cx, cy - hh - dist);
        const rawTopCenter = rotPt(cx, cy - hh);
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2 / transform.zoom;
        ctx.beginPath();
        ctx.moveTo(rawTopCenter.x, rawTopCenter.y);
        ctx.lineTo(rawRotHandle.x, rawRotHandle.y);
        ctx.stroke();
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rawRotHandle.x, rawRotHandle.y, hSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }


    // Draw the single shared group rotation handle for any selected grouped entities (edit mode only).
    // Each group only gets one handle even if multiple members are selected.
    // Check both regions AND map objects so the handle appears regardless of which member type was clicked first.
    if (renderingMode === 'edit') {
      const drawnGroupIds = new Set<string>();
      regions.forEach(region => {
        if (!region.selected) return;
        const grp = useGroupStore.getState().getGroupForEntity(region.id);
        if (grp && !drawnGroupIds.has(grp.id)) {
          drawnGroupIds.add(grp.id);
          drawGroupRotationHandle(ctx, grp);
        }
      });
      // Also check selected map objects — clicking a door/wall in a group selects it,
      // and propagation selects sibling regions, but the region.selected flag may not be
      // flushed yet; checking mapObjects ensures the handle always appears.
      mapObjects.forEach(obj => {
        if (!obj.selected) return;
        const grp = useGroupStore.getState().getGroupForEntity(obj.id);
        if (grp && !drawnGroupIds.has(grp.id)) {
          drawnGroupIds.add(grp.id);
          drawGroupRotationHandle(ctx, grp);
        }
      });
    }

    // Draw highlighted grids (if any) - below tokens in z-order
    drawHighlightedGrids(ctx);
    
    // Marquee is now rendered as a DOM div above the fog layer (see marqueeDivRef in JSX)
    // No canvas drawing needed here — this avoids z-order issues with fog post-processing.

    // Helper to draw annotation MapObjects to a given context (with world-space transform applied)
    const drawAnnotationsToContext = (targetCtx: CanvasRenderingContext2D) => {
      const isPlayModeForAnnotations = renderingMode === 'play';
      const annotationObjs = mapObjects.filter(o => o.category === 'annotation');
      annotationObjs.forEach((annotation) => {
        const { x, y } = annotation.position;
        
        // Check if annotation is in revealed area (for visibility and DM effects)
        let isInFog = false;
        if (isPlayModeForAnnotations && fogEnabled && !fogRevealAll) {
          const annotationPoint = { x, y };
          const isRevealed = isPointInRevealedArea(
            annotationPoint,
            getActiveExploredArea(),
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
        targetCtx.fillText(annotation.annotationReference ?? annotation.label ?? '', x, y);

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
        
        // Apply focus dim for tokens on non-focused maps
        const tokenDimmed = applyFocusDim(targetCtx, renderToken.mapId);
        drawTokenToContext(targetCtx, renderToken, tokenInFog);
        if (tokenDimmed) restoreFocusDim(targetCtx);
      });
    };

    // Helper to draw a single token to a specific context
    const drawTokenToContext = (targetCtx: CanvasRenderingContext2D, token: any, isInFog: boolean = false) => {
      const baseTokenSize = 40;
      const tokenWidth = (token.gridWidth || 1) * baseTokenSize;
      const tokenHeight = (token.gridHeight || 1) * baseTokenSize;
      const radiusX = tokenWidth / 2;
      const radiusY = tokenHeight / 2;
      // For label positioning, use the larger radius
      const maxRadius = Math.max(radiusX, radiusY);
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
        targetCtx.ellipse(token.x, token.y, radiusX + 5, radiusY + 5, 0, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.restore();
      }

      // Draw active combat highlight
      if (isActiveInCombat && !isInFog) {
        targetCtx.save();
        targetCtx.strokeStyle = "rgba(255, 215, 0, 0.6)";
        targetCtx.lineWidth = 6 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.ellipse(token.x, token.y, radiusX + 6, radiusY + 6, 0, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.strokeStyle = "rgba(255, 215, 0, 0.8)";
        targetCtx.lineWidth = 3 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.ellipse(token.x, token.y, radiusX + 3, radiusY + 3, 0, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.restore();
      }

      // Draw controllability hover glow
      if (isHovered && isControllable && !isDraggingToken && !isInFog) {
        targetCtx.save();
        targetCtx.strokeStyle = "rgba(34, 197, 94, 0.6)";
        targetCtx.lineWidth = 4 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.ellipse(token.x, token.y, radiusX + 4, radiusY + 4, 0, 0, 2 * Math.PI);
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
        targetCtx.ellipse(token.x, token.y, radiusX + 3 / transform.zoom, radiusY + 3 / transform.zoom, 0, 0, 2 * Math.PI);
        targetCtx.stroke();
        targetCtx.shadowBlur = 0;
      }

      // Draw main token (image or color fill)
      const tokenImg = token.imageUrl ? getCachedImage(token.imageUrl) : null;
      
      if (tokenImg) {
        // Draw elliptical clipped image
        targetCtx.save();
        targetCtx.beginPath();
        targetCtx.ellipse(token.x, token.y, radiusX, radiusY, 0, 0, 2 * Math.PI);
        targetCtx.clip();
        
        // Draw image centered and scaled to fit the ellipse bounds
        targetCtx.drawImage(tokenImg, token.x - radiusX, token.y - radiusY, tokenWidth, tokenHeight);
        targetCtx.restore();
        
        // Draw border on top
        targetCtx.strokeStyle = roleBorderColor;
        targetCtx.lineWidth = 3 / transform.zoom;
        targetCtx.beginPath();
        targetCtx.ellipse(token.x, token.y, radiusX, radiusY, 0, 0, 2 * Math.PI);
        targetCtx.stroke();
      } else {
        // Fallback to color fill
        targetCtx.fillStyle = token.color || "#ffffff";
        targetCtx.beginPath();
        targetCtx.ellipse(token.x, token.y, radiusX, radiusY, 0, 0, 2 * Math.PI);
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
        drawTokenLabel(
          targetCtx,
          displayText,
          token.x,
          token.y,
          labelPos,
          maxRadius,
          transform.zoom,
          token.labelColor,
          token.labelBackgroundColor
        );
      }

      targetCtx.restore();
    };

    // Determine if we should use the overlay canvas for tokens/annotations
    const useOverlayForTokens = isPostProcessingReadyRef.current && effectSettings.postProcessingEnabled && fogEnabled;

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
    // SAFETY: If fog is enabled but masks haven't been computed yet, render full black
    // to prevent accidentally revealing the map on initial load / refresh.
    if (isPlayMode && fogEnabled && !fogRevealAll && !fogMasksRef.current) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillRect(
        -transform.x / transform.zoom,
        -transform.y / transform.zoom,
        canvas.width / transform.zoom,
        canvas.height / transform.zoom
      );
      ctx.restore();
    }
    if (isPlayMode && fogEnabled && !fogRevealAll && fogMasksRef.current) {
      // Check if we should use PixiJS post-processing instead of main canvas fog
      const usePostProcessing = isPostProcessingReadyRef.current && effectSettings.postProcessingEnabled;

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
          fogOffscreenCanvas.width = Math.max(1, canvas.width);
          fogOffscreenCanvas.height = Math.max(1, canvas.height);
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
          if (fogOffscreenCanvas.width > 0 && fogOffscreenCanvas.height > 0) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to draw fog canvas at screen coordinates
            ctx.drawImage(fogOffscreenCanvas, 0, 0);
            ctx.restore();
          }
        }
      } else {
        // Apply PixiJS post-processing effects to fog (blur, light falloff gradients)
        // Use cached illumination sources to avoid rebuilding the array every frame
        if (!illuminationSourcesCacheRef.current) {
          illuminationSourcesCacheRef.current = tokenVisibilityDataRef.current.map((t, idx) => {
            const tokenSettings = t.tokenIllumination?.[0];
            const rangePixels = t.visionRange;
            const moLight = t.mapObjectLightData;
            const dimRadius = moLight?.lightRadius ?? rangePixels;
            const brightRadius = moLight?.lightBrightRadius ?? dimRadius * 0.5;
            const moColor = moLight?.lightColor ?? '#FFD700';
            const moIntensity = moLight?.lightIntensity ?? 1.0;

            return {
              id: `vis-${idx}`,
              name: t.isLightSource ? 'Light' : 'Vision',
              enabled: true,
              position: t.position,
              range: rangePixels,
              brightZone: moLight
                ? (brightRadius / dimRadius)
                : (tokenSettings?.brightZone ?? effectSettings.lightFalloff),
              brightIntensity: moLight
                ? moIntensity
                : (tokenSettings?.brightIntensity ?? 1.0),
              dimIntensity: moLight
                ? moIntensity * 0.4
                : (tokenSettings?.dimIntensity ?? (t.isLightSource ? 0.4 : 0.0)),
              color: moLight
                ? moColor
                : (tokenSettings?.color ?? (t.isLightSource ? '#FFD700' : '#FFFFFF')),
              colorEnabled: moLight
                ? true
                : (tokenSettings?.colorEnabled ?? false),
              colorIntensity: moLight
                ? 0.5
                : (tokenSettings?.colorIntensity ?? 0.5),
              softEdge: tokenSettings?.softEdge ?? true,
              softEdgeRadius: tokenSettings?.softEdgeRadius ?? 8,
              animation: tokenSettings?.animation ?? 'none',
              animationSpeed: tokenSettings?.animationSpeed ?? 1.0,
              animationIntensity: tokenSettings?.animationIntensity ?? 0.3,
              visibilityPolygon: t.wallOcclusionPath,
            };
          });
        }
        const illuminationSources = [...illuminationSourcesCacheRef.current];
        
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
      // Draw drag path BEFORE tokens so footprints appear below token art
      if (isDraggingToken && draggedTokenId) {
        drawDragPathOnly(ctx);
      }
      
      drawTokensToContext(ctx);
      
      // Draw drag ghost on top of tokens (only for non-overlay mode)
      if (isDraggingToken && draggedTokenId) {
        drawDragGhostAndPath(ctx);
      }

      // ── Remote ephemeral overlays ──
      drawRemoteDragPreviews(ctx);
      drawRemoteTokenHovers(ctx);
      drawRemoteSelectionPreviews(ctx);
      drawRemoteActionTargets(ctx);
      drawMapPings(ctx);
    }

    // ── Fog Reveal Brush: ghost circle is now drawn on the overlay canvas (see below)
    // so it appears above the PixiJS fog post-processing layer.

    // Restore context after all world-space rendering
    ctx.restore();

    // Draw off-screen token indicators and overlay content
    // When post-processing is enabled with fog, also draw tokens/annotations to overlay canvas
    const usePostProcessing = isPostProcessingReadyRef.current && effectSettings.postProcessingEnabled;
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
            
            // Draw drag path BEFORE tokens so footprints appear below token art
            if (isDraggingToken && draggedTokenId) {
              drawDragPathOnly(overlayCtx);
            }
            
            // Draw tokens on top
            drawTokensToContext(overlayCtx);
            
            // Draw drag ghost on overlay so it appears above tokens
            if (isDraggingToken && draggedTokenId) {
              drawDragGhostAndPath(overlayCtx);
            }
            // ── Remote ephemeral overlays on overlay ──
            drawRemoteDragPreviews(overlayCtx);
            drawRemoteTokenHovers(overlayCtx);
            drawRemoteSelectionPreviews(overlayCtx);
            drawRemoteActionTargets(overlayCtx);

            overlayCtx.restore();
          }
        } else {
          // Not using post-processing - draw indicators to main canvas
          offScreenTokens.forEach((token) => {
            drawOffScreenIndicator(ctx, token, viewX, viewY, viewWidth, viewHeight);
          });
        }

        // ── Fog Reveal Brush: draw ghost circle on overlay so it's always above fog ──
        if (fogRevealBrushActiveRef.current && fogEnabled && isDM && renderingMode === 'play' && fogBrushCursorRef.current) {
          const bp = fogBrushCursorRef.current;
          const brushR = fogRevealBrushRadiusRef.current;
          overlayCtx.save();
          overlayCtx.translate(transform.x, transform.y);
          overlayCtx.scale(transform.zoom, transform.zoom);
          overlayCtx.beginPath();
          overlayCtx.arc(bp.x, bp.y, brushR, 0, Math.PI * 2);
          overlayCtx.strokeStyle = 'rgba(100, 200, 255, 0.7)';
          overlayCtx.lineWidth = 2 / transform.zoom;
          overlayCtx.setLineDash([6 / transform.zoom, 4 / transform.zoom]);
          overlayCtx.stroke();
          overlayCtx.fillStyle = 'rgba(100, 200, 255, 0.15)';
          overlayCtx.fill();
          overlayCtx.setLineDash([]);
          // Radius label
          const labelText = `${Math.round(brushR)}px`;
          const fontSize = 11 / transform.zoom;
          overlayCtx.font = `${fontSize}px Arial`;
          overlayCtx.fillStyle = 'rgba(100, 200, 255, 0.9)';
          overlayCtx.textAlign = 'center';
          overlayCtx.fillText(labelText, bp.x, bp.y - brushR - 6 / transform.zoom);
          overlayCtx.restore();
        }
      }
    } else if (!usePostProcessing) {
      // No overlay canvas, draw indicators to main canvas
      offScreenTokens.forEach((token) => {
        drawOffScreenIndicator(ctx, token, viewX, viewY, viewWidth, viewHeight);
      });
    }


    // ── Targeting reticle line (action system) ──
    const actionState = useActionStore.getState();
    if (actionState.isTargeting && actionState.currentAction) {
      const sourceToken = tokens.find(t => t.id === actionState.currentAction!.sourceTokenId);
      if (sourceToken) {
        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.zoom, transform.zoom);

        const currentMap = maps.find(m => m.id === selectedMapId);
        const gridSize = currentMap?.regions?.[0]?.gridSize || 40;

        const mousePos = actionState.targetingMousePos;
        for (const target of actionState.currentAction!.targets) {
          const targetToken = tokens.find(t => t.id === target.tokenId);
          if (targetToken) {
            drawTargetingLineHelper(ctx, sourceToken.x, sourceToken.y, targetToken.x, targetToken.y, target.distance, gridSize, true);
          }
        }
        if (mousePos) {
          const dx = mousePos.x - sourceToken.x;
          const dy = mousePos.y - sourceToken.y;
          const distPx = Math.sqrt(dx * dx + dy * dy);
          const distGrid = distPx / gridSize;
          drawTargetingLineHelper(ctx, sourceToken.x, sourceToken.y, mousePos.x, mousePos.y, distGrid, gridSize, false);
        }

        ctx.restore();
      }
    }

    // ── Resolution flash effects ──
    if (actionState.resolutionFlashes.length > 0) {
      const now = Date.now();
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.zoom, transform.zoom);

      for (const flash of actionState.resolutionFlashes) {
        const elapsed = now - flash.startTime;
        const duration = 1500;
        if (elapsed >= duration) continue;

        const progress = elapsed / duration;
        // Expanding ring that fades out
        const maxRadius = 40 / transform.zoom;
        const radius = maxRadius * (0.5 + progress * 0.5);
        const alpha = 1 - progress;

        const isHit = flash.color === 'hit';
        const r = isHit ? 239 : 34;
        const g = isHit ? 68 : 197;
        const b = isHit ? 68 : 94;

        // Glow fill
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.25})`;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Ring stroke
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.9})`;
        ctx.lineWidth = 3 / transform.zoom;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner pulse ring
        const innerRadius = maxRadius * 0.3 * (1 - progress);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`;
        ctx.lineWidth = 1.5 / transform.zoom;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, innerRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Continuously re-render while flashes are active
      const hasActiveFlashes = actionState.resolutionFlashes.some(f => now - f.startTime < 1500);
      if (hasActiveFlashes) {
        requestAnimationFrame(() => redrawCanvas());
      }
    }
  };

  // Function to draw drag ghost and path
  const drawDragGhostAndPath = (ctx: CanvasRenderingContext2D) => {
    if (!draggedTokenId) return;

    const draggedToken = tokens.find((t) => t.id === draggedTokenId);
    if (!draggedToken) return;

    // Draw ghost token at original position (on top of everything)
    drawGhostToken(ctx, dragStartPos.x, dragStartPos.y, draggedToken);
    
    // Note: Drag path is now drawn separately via drawDragPathOnly() BEFORE tokens
  };

  // ── Draw remote drag previews (ghost + line from start → current) ──
  const drawRemoteDragPreviews = (ctx: CanvasRenderingContext2D) => {
    const previews = Object.values(remoteDragPreviews);
    if (previews.length === 0) return;

    ctx.save();
    for (const p of previews) {
      const baseTokenSize = 40;
      const token = tokens.find((t) => t.id === p.tokenId);
      const tokenSize = token ? Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize : baseTokenSize;
      const radius = tokenSize / 2;
      const color = token?.color || "#888888";

      // Draw movement trail polyline if path has 2+ points
      if (p.path.length >= 2) {
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5 / transform.zoom;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(p.path[0].x, p.path[0].y);
        for (let i = 1; i < p.path.length; i++) {
          ctx.lineTo(p.path[i].x, p.path[i].y);
        }
        // Extend to currentPos (may be ahead of last path point)
        ctx.lineTo(p.currentPos.x, p.currentPos.y);
        ctx.stroke();
      }

      // Draw dashed straight-line distance indicator from start to current
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / transform.zoom;
      ctx.setLineDash([6 / transform.zoom, 4 / transform.zoom]);
      ctx.beginPath();
      ctx.moveTo(p.startPos.x, p.startPos.y);
      ctx.lineTo(p.currentPos.x, p.currentPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw ghost circle at start position
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.startPos.x, p.startPos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw ghost circle at current drag position
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.currentPos.x, p.currentPos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw border ring on current position
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / transform.zoom;
      ctx.beginPath();
      ctx.arc(p.currentPos.x, p.currentPos.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw username label above current position
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#ffffff";
      ctx.font = `${11 / transform.zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const label = p.userId.slice(0, 8);
      ctx.fillText(label, p.currentPos.x, p.currentPos.y - radius - 4 / transform.zoom);
    }
    ctx.restore();
  };

  // ── Draw remote token hover highlights (colored ring around hovered token) ──
  const drawRemoteTokenHovers = (ctx: CanvasRenderingContext2D) => {
    const hovers = Object.values(remoteHovers);
    if (hovers.length === 0) return;

    ctx.save();
    for (const h of hovers) {
      if (!h.tokenId) continue;
      const token = tokens.find((t) => t.id === h.tokenId);
      if (!token) continue;

      const baseTokenSize = 40;
      const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
      const radius = tokenSize / 2 + 3 / transform.zoom;

      // Use cursor color for this user
      const cursorState = useCursorStore.getState().cursors[h.userId];
      const color = cursorState?.color || "#60a5fa";

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5 / transform.zoom;
      ctx.setLineDash([6 / transform.zoom, 3 / transform.zoom]);
      ctx.beginPath();
      ctx.arc(token.x, token.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Small label
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.font = `${9 / transform.zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(h.userId.slice(0, 8), token.x, token.y - radius - 2 / transform.zoom);
    }
    ctx.restore();
  };

  // ── Draw remote selection rectangle previews ──
  const drawRemoteSelectionPreviews = (ctx: CanvasRenderingContext2D) => {
    const selections = Object.values(remoteSelections);
    if (selections.length === 0) return;

    ctx.save();
    for (const s of selections) {
      if (!s.rect || s.rect.width < 2 || s.rect.height < 2) continue;

      const cursorState = useCursorStore.getState().cursors[s.userId];
      const color = cursorState?.color || "#a78bfa";

      // Filled rectangle with low opacity
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = color;
      ctx.fillRect(s.rect.x, s.rect.y, s.rect.width, s.rect.height);

      // Dashed border
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / transform.zoom;
      ctx.setLineDash([5 / transform.zoom, 3 / transform.zoom]);
      ctx.strokeRect(s.rect.x, s.rect.y, s.rect.width, s.rect.height);
      ctx.setLineDash([]);

      // User label at top-left
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.font = `${9 / transform.zoom}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(s.userId.slice(0, 8), s.rect.x, s.rect.y - 2 / transform.zoom);
    }
    ctx.restore();
  };

  // ── Draw remote action target crosshairs ──
  const drawRemoteActionTargets = (ctx: CanvasRenderingContext2D) => {
    const targets = Object.values(remoteActionTargets);
    if (targets.length === 0) return;

    ctx.save();
    for (const t of targets) {
      const cursorState = useCursorStore.getState().cursors[t.userId];
      const color = cursorState?.color || "#f87171";
      const r = 12 / transform.zoom;
      const { x, y } = t.pos;

      // Outer circle
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / transform.zoom;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(x - r * 1.4, y);
      ctx.lineTo(x - r * 0.5, y);
      ctx.moveTo(x + r * 0.5, y);
      ctx.lineTo(x + r * 1.4, y);
      ctx.moveTo(x, y - r * 1.4);
      ctx.lineTo(x, y - r * 0.5);
      ctx.moveTo(x, y + r * 0.5);
      ctx.lineTo(x, y + r * 1.4);
      ctx.stroke();

      // Small center dot
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 2 / transform.zoom, 0, Math.PI * 2);
      ctx.fill();

      // Line from source token to target pos
      const sourceToken = tokens.find((tk) => tk.id === t.sourceTokenId);
      if (sourceToken) {
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / transform.zoom;
        ctx.setLineDash([4 / transform.zoom, 3 / transform.zoom]);
        ctx.beginPath();
        ctx.moveTo(sourceToken.x, sourceToken.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // User label
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.font = `${9 / transform.zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(t.userId.slice(0, 8), x, y - r - 3 / transform.zoom);
    }
    ctx.restore();
  };

  // ── Draw map pings (expanding + fading circles) ──
  const drawMapPings = (ctx: CanvasRenderingContext2D) => {
    if (activePings.length === 0) return;
    const now = Date.now();
    ctx.save();
    for (const ping of activePings) {
      const age = now - ping.ts;
      if (age >= 1000) continue;
      const t = age / 1000; // 0→1
      const radius = (20 + t * 60) / transform.zoom;
      const alpha = 1 - t;

      // Outer expanding ring
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = ping.color;
      ctx.lineWidth = 3 / transform.zoom;
      ctx.beginPath();
      ctx.arc(ping.pos.x, ping.pos.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner solid dot (fades slower)
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ping.color;
      ctx.beginPath();
      ctx.arc(ping.pos.x, ping.pos.y, 5 / transform.zoom, 0, Math.PI * 2);
      ctx.fill();

      // Second expanding ring (delayed)
      if (t > 0.15) {
        const t2 = (t - 0.15) / 0.85;
        const radius2 = (20 + t2 * 60) / transform.zoom;
        ctx.globalAlpha = (1 - t2) * 0.35;
        ctx.strokeStyle = ping.color;
        ctx.lineWidth = 2 / transform.zoom;
        ctx.beginPath();
        ctx.arc(ping.pos.x, ping.pos.y, radius2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const drawDragPathOnly = (ctx: CanvasRenderingContext2D) => {
    if (!draggedTokenId) return;

    const draggedToken = tokens.find((t) => t.id === draggedTokenId);
    if (!draggedToken) return;

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

  // ── Targeting reticle line helper (action system) ──
  const drawTargetingLineHelper = (
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    distGrid: number,
    gridSize: number,
    confirmed: boolean
  ) => {
    ctx.save();

    // Line style
    const lineWidth = 2 / transform.zoom;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(confirmed ? [] : [8 / transform.zoom, 4 / transform.zoom]);

    // Red/orange targeting line
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, confirmed ? 'rgba(239, 68, 68, 0.9)' : 'rgba(251, 191, 36, 0.7)');
    gradient.addColorStop(1, confirmed ? 'rgba(239, 68, 68, 0.5)' : 'rgba(251, 191, 36, 0.3)');
    ctx.strokeStyle = gradient;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Targeting reticle at endpoint
    const reticleRadius = confirmed ? 14 / transform.zoom : 10 / transform.zoom;
    ctx.strokeStyle = confirmed ? 'rgba(239, 68, 68, 0.9)' : 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = 1.5 / transform.zoom;

    // Outer ring
    ctx.beginPath();
    ctx.arc(x2, y2, reticleRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    const ch = reticleRadius * 0.6;
    ctx.beginPath();
    ctx.moveTo(x2 - ch, y2); ctx.lineTo(x2 + ch, y2);
    ctx.moveTo(x2, y2 - ch); ctx.lineTo(x2, y2 + ch);
    ctx.stroke();

    if (confirmed) {
      // Fill confirmed reticle
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.beginPath();
      ctx.arc(x2, y2, reticleRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distance label at midpoint
    const midX = (x1 + x2) / 2;
    const midY = (x1 === x2 && y1 === y2) ? y1 : (y1 + y2) / 2;
    const distFt = (distGrid * 5).toFixed(0);
    const fontSize = 11 / transform.zoom;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = `${distFt} ft.`;
    const tm = ctx.measureText(text);
    const px = 4 / transform.zoom;
    const py = 2 / transform.zoom;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(midX - tm.width / 2 - px, midY - fontSize / 2 - py, tm.width + px * 2, fontSize + py * 2, 3 / transform.zoom);
    ctx.fill();

    ctx.fillStyle = confirmed ? '#ef4444' : '#fbbf24';
    ctx.fillText(text, midX, midY);

    ctx.restore();
  };

  // Function to draw drag path
  const drawDragPath = (ctx: CanvasRenderingContext2D, token: any) => {
    // For free movement: draw straight line from start to current position
    // TODO: For grid movement, this will use grid-based pathfinding algorithms

    const gridSize = 40; // Grid unit size in pixels
    
    // Get token path styling settings (use defaults if not set)
    const pathStyle = token.pathStyle || 'dashed';
    const pathColor = token.pathColor || token.color || '#ffffff';
    const pathWeight = token.pathWeight ?? 3;
    const pathOpacity = token.pathOpacity ?? 0.7;
    const pathGaitWidth = token.pathGaitWidth ?? 0.6;
    const footprintType = token.footprintType || 'barefoot';

    ctx.save();

    // Calculate distance in grid units
    const dx = token.x - dragStartPos.x;
    const dy = token.y - dragStartPos.y;
    const distancePixels = Math.sqrt(dx * dx + dy * dy);
    const distanceGridUnits = (distancePixels / gridSize).toFixed(2);

    // Draw straight line indicator (always shown for distance reference)
    ctx.strokeStyle = pathColor;
    ctx.lineWidth = 2 / transform.zoom;
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([8 / transform.zoom, 4 / transform.zoom]);
    ctx.beginPath();
    ctx.moveTo(dragStartPos.x, dragStartPos.y);
    ctx.lineTo(token.x, token.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw distance text at midpoint of line
    if (distancePixels > 10) {
      const midX = (dragStartPos.x + token.x) / 2;
      const midY = (dragStartPos.y + token.y) / 2;

      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.9;
      ctx.font = `${14 / transform.zoom}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

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

    // Draw detailed movement path if we have path points and path style is not 'none'
    if (dragPath.length > 1 && pathStyle !== 'none') {
      // Calculate total path distance
      let pathDistance = 0;
      for (let i = 1; i < dragPath.length; i++) {
        const pdx = dragPath[i].x - dragPath[i - 1].x;
        const pdy = dragPath[i].y - dragPath[i - 1].y;
        pathDistance += Math.sqrt(pdx * pdx + pdy * pdy);
      }
      const pathDistanceGridUnits = (pathDistance / gridSize).toFixed(2);

      // Draw movement path based on style
      if (pathStyle === 'footprint') {
        // Calculate footprint size based on token size and weight setting
        const baseTokenSize = 40;
        const tokenSize = Math.max(token.gridWidth || 1, token.gridHeight || 1) * baseTokenSize;
        const footprintSize = tokenSize * 0.3 * (pathWeight / 3); // Scale with pathWeight
        
        drawFootprintPath(
          ctx,
          dragPath,
          footprintType,
          pathColor,
          footprintSize,
          pathOpacity,
          pathGaitWidth,
          transform.zoom
        );
      } else {
        // Solid or dashed line
        drawStyledLinePath(
          ctx,
          dragPath,
          pathStyle as 'solid' | 'dashed',
          pathColor,
          pathWeight,
          pathOpacity,
          transform.zoom
        );
      }

      // Draw path distance text near the origin (start) so it's always visible
      if (dragPath.length > 2 && pathDistance > 10) {
        const originPoint = dragPath[0];

        const offsetX = 40 / transform.zoom;
        const offsetY = -40 / transform.zoom;
        const textX = originPoint.x + offsetX;
        const textY = originPoint.y + offsetY;

        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.9;
        ctx.font = `${12 / transform.zoom}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

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

        ctx.fillStyle = pathColor;
        ctx.fillText(pathText, textX, textY);
      }
    }

    // Note: No direction arrow needed - path renders under the token so arrow would be hidden
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

    // Only decorate the inner boundaries (region edges), not the outer bounding box
    regions.forEach((region) => {
      // Per-region save/restore so rotation transforms don't corrupt sibling regions
      ctx.save();

      const points = getRegionEdgePoints(region);

      // Calculate total path length for variation
      let totalLength = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }

      // Apply rotation for rectangle regions (path regions have rotation baked into pathPoints)
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

      // Restore per-region transform (replaces the broken setTransform reset)
      ctx.restore();
    });

    // Outer save/restore removed — each region now owns its own save/restore above
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
          return `${r.id}-${r.pathPoints.map((p) => `${(p.x ?? 0).toFixed(0)},${(p.y ?? 0).toFixed(0)}`).join(";")}`;
        }
        return `${r.id}-${(r.x ?? 0).toFixed(0)},${(r.y ?? 0).toFixed(0)},${(r.width ?? 0).toFixed(0)},${(r.height ?? 0).toFixed(0)},${r.rotation || 0}`;
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

    // Only show handles and selection in edit mode.
    // Grouped regions suppress per-region handles — the group draws a single
    // unified bounding box with shared handles instead (see drawGroupRotationHandle).
    if (isSelected && renderingMode === "edit") {
      const regionGroup = useGroupStore.getState().getGroupForEntity(region.id);
      if (!regionGroup) {
        // Ungrouped region: draw its own resize + rotation handles
        if (region.regionType === "path") {
          drawPathHandles(ctx, region);
        } else {
          drawRegionHandles(ctx, region);
        }
      }
      // Grouped regions: a single shared handle set is drawn once per group by drawGroupRotationHandle
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
      drawRegionBackground(ctx, region, effectiveRotation);
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
  // Supports animated GIFs via animatedTextureManager
  // effectiveRotationDeg: if non-zero, skip axis-aligned viewport clipping (it's invalid under rotation)
  const drawRegionBackground = (ctx: CanvasRenderingContext2D, region: CanvasRegion, effectiveRotationDeg: number = 0) => {
    if (!region.backgroundImage) return;

    // Check for animated texture first
    const animatedFrame = animatedTextureManager.getCurrentFrame(region.backgroundImage);
    const isAnimated = animatedFrame !== null;
    
    // For animated textures, use the current frame directly
    // For static textures, use the image cache
    let img: HTMLImageElement | ImageBitmap | null = null;
    let imgWidth: number;
    let imgHeight: number;
    
    if (isAnimated) {
      img = animatedFrame;
      imgWidth = animatedFrame.width;
      imgHeight = animatedFrame.height;
    } else {
      // Check if this might be animated but not loaded yet
      if (animatedTextureManager.mightBeAnimated(region.backgroundImage)) {
        animatedTextureManager.preload(region.backgroundImage);
      }
      
      let staticImg = imageCache.current.get(region.backgroundImage);

      if (!staticImg) {
        // Create and cache new image
        staticImg = new Image();
        staticImg.crossOrigin = "anonymous";
        imageCache.current.set(region.backgroundImage, staticImg);

        // Only set up onload for new images
        staticImg.onload = () => {
          // Invalidate any cached patterns for this image since it just loaded
          texturePatternCache.invalidateImage(region.backgroundImage!);
          // Trigger re-render when image loads
          setImageLoadCounter(c => c + 1);
        };
        
        staticImg.onerror = () => {
          console.warn('Failed to load region background image:', region.backgroundImage?.substring(0, 50));
        };

        staticImg.src = region.backgroundImage;
        
        // Draw placeholder while loading (blue = loading)
        ctx.fillStyle = "rgba(100, 100, 200, 0.5)";
        ctx.fillRect(region.x, region.y, region.width, region.height);
        return;
      }

      // Only draw if image is fully loaded with valid dimensions
      if (!staticImg.complete || staticImg.naturalWidth === 0 || staticImg.naturalHeight === 0) {
        // Draw placeholder while loading (green = waiting for dimensions)
        ctx.fillStyle = "rgba(100, 200, 100, 0.5)";
        ctx.fillRect(region.x, region.y, region.width, region.height);
        return;
      }
      
      img = staticImg;
      imgWidth = staticImg.naturalWidth;
      imgHeight = staticImg.naturalHeight;
    }

    if (!img) return;

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
    const scaledWidth = Math.max(1, imgWidth * scale);
    const scaledHeight = Math.max(1, imgHeight * scale);

    if (repeat === "no-repeat") {
      // For no-repeat, use source-clipping to avoid exceeding browser canvas size limits.
      // At high zoom levels, drawing a large image to world-space coordinates would produce
      // canvas draw calls that exceed the browser's maximum texture dimension (~8192px),
      // causing the image to be silently clipped. We compute the visible intersection and
      // draw only that portion using the 9-argument form of drawImage.
      const destX = x + offsetX;
      const destY = y + offsetY;
      const destW = scaledWidth;
      const destH = scaledHeight;

      // When the region is rotated the canvas context already has a rotation transform applied.
      // In that case the axis-aligned viewport rectangle does NOT describe the visible area in
      // the rotated local coordinate space, so the intersection math would produce a wrong
      // (too-small or zero) rectangle and clip the texture away at high zoom levels.
      // The ctx.clip() call that wraps this function already constrains output to the region
      // bounds, so it is safe to skip the viewport intersection and draw the full dest rect.
      if (effectiveRotationDeg !== 0) {
        ctx.drawImage(img, destX, destY, destW, destH);
      } else {
        // The canvas context is already scaled by transform.zoom; the browser clips draw calls
        // that are too large in device pixels. To avoid this, we manually clip the destination
        // rectangle to the current world-space viewport and derive the matching source rectangle.
        const vpX = -transform.x / transform.zoom;
        const vpY = -transform.y / transform.zoom;
        const vpW = (canvasRef.current?.width ?? window.innerWidth) / transform.zoom;
        const vpH = (canvasRef.current?.height ?? window.innerHeight) / transform.zoom;

        // Clamp destination rect to viewport
        const clampedDestX = Math.max(destX, vpX);
        const clampedDestY = Math.max(destY, vpY);
        const clampedDestRight = Math.min(destX + destW, vpX + vpW);
        const clampedDestBottom = Math.min(destY + destH, vpY + vpH);

        if (clampedDestRight <= clampedDestX || clampedDestBottom <= clampedDestY) {
          // Nothing to draw (fully outside viewport)
          return;
        }

        // Derive source rectangle proportionally
        const scaleX = imgWidth / destW;
        const scaleY = imgHeight / destH;
        const srcX = (clampedDestX - destX) * scaleX;
        const srcY = (clampedDestY - destY) * scaleY;
        const srcW = (clampedDestRight - clampedDestX) * scaleX;
        const srcH = (clampedDestBottom - clampedDestY) * scaleY;

        ctx.drawImage(
          img,
          srcX, srcY, srcW, srcH,
          clampedDestX, clampedDestY, clampedDestRight - clampedDestX, clampedDestBottom - clampedDestY
        );
      }
    } else if (isAnimated) {
      // For animated textures, we can't use CanvasPattern (it captures only one frame)
      // Instead, manually tile the current frame using drawImage
      const startX = x + offsetX - scaledWidth;
      const startY = y + offsetY - scaledHeight;
      const endX = x + width + scaledWidth;
      const endY = y + height + scaledHeight;
      
      for (let tileY = startY; tileY < endY; tileY += scaledHeight) {
        for (let tileX = startX; tileX < endX; tileX += scaledWidth) {
          ctx.drawImage(img, tileX, tileY, scaledWidth, scaledHeight);
        }
      }
    } else {
      // Use cached pattern for static textures in repeat modes (major performance optimization)
      const pattern = texturePatternCache.getPattern(
        ctx,
        img as HTMLImageElement,
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
  // NOTE: This is called from within an already-rotated canvas context (drawRectangleRegion),
  // so NO additional rotation should be applied here.
  const drawSquareGrid = (ctx: CanvasRenderingContext2D, region: CanvasRegion) => {
    const gridSize = region.gridSize;

    // Save context for local transformations
    ctx.save();

    // DO NOT apply rotation here - the caller (drawRectangleRegion) already has the context rotated.

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
    const rotation = region.rotation || 0;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rad = (rotation * Math.PI) / 180;

    // Helper to rotate a point around region center
    const rot = (px: number, py: number) => {
      if (rotation === 0) return { x: px, y: py };
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return {
        x: cos * (px - cx) - sin * (py - cy) + cx,
        y: sin * (px - cx) + cos * (py - cy) + cy,
      };
    };

    ctx.fillStyle = "#4f46e5";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2 / transform.zoom;

    // Draw resize handles at corners and edges (rotated)
    const rawHandles = [
      { x: x, y: y },
      { x: x + width / 2, y: y },
      { x: x + width, y: y },
      { x: x + width, y: y + height / 2 },
      { x: x + width, y: y + height },
      { x: x + width / 2, y: y + height },
      { x: x, y: y + height },
      { x: x, y: y + height / 2 },
    ];

    rawHandles.forEach((handle) => {
      const r = rot(handle.x, handle.y);
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(rad);
      ctx.fillRect(-handleSize / 2, -handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(-handleSize / 2, -handleSize / 2, handleSize, handleSize);
      ctx.restore();
    });

    // Only draw the individual rotation handle if this region is NOT part of a group.
    // When grouped, a single shared group-level handle is drawn instead (see drawGroupRotationHandle).
    const regionGroup = useGroupStore.getState().getGroupForEntity(region.id);
    if (!regionGroup) {
      const rotationHandleDistance = 30 / transform.zoom;
      const rawRotX = x + width / 2;
      const rawRotY = y - rotationHandleDistance;
      const rotHandle = rot(rawRotX, rawRotY);

      // Draw connection line from region top-center to rotation handle (both rotated)
      const topCenter = rot(x + width / 2, y);
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 2 / transform.zoom;
      ctx.beginPath();
      ctx.moveTo(topCenter.x, topCenter.y);
      ctx.lineTo(rotHandle.x, rotHandle.y);
      ctx.stroke();

      // Draw rotation handle (circular)
      ctx.fillStyle = "#10b981";
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(rotHandle.x, rotHandle.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };

  // Function to draw path control handles (for path regions)
  const calculateAngle = (centerX: number, centerY: number, pointX: number, pointY: number) => {
    return Math.atan2(pointY - centerY, pointX - centerX) * (180 / Math.PI);
  };

  /**
   * Single canonical AABB helper for groups.
   * ALWAYS reads from live Zustand store state — never the React render closure —
   * so the result is correct regardless of dragPreview or partial store updates.
   * computeGroupCentroid and computeGroupBounds both delegate here.
   */
  const computeGroupAABB = (group: { members: { id: string; type: string }[] }): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    const liveMapObjects = useMapObjectStore.getState().mapObjects;
    // Read regions from BOTH the live Zustand store AND the React closure to handle
    // cases where store rehydration or dragPreview lag causes mismatches.
    const liveRegions    = useRegionStore.getState().regions;
    const liveLights     = useLightStore.getState().lights;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const expand = (x: number, y: number) => {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    };
    const expandRotated = (cx: number, cy: number, px: number, py: number, angleDeg: number) => {
      if (!angleDeg) { expand(px, py); return; }
      const rad = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const rx = cx + cos * (px - cx) - sin * (py - cy);
      const ry = cy + sin * (px - cx) + cos * (py - cy);
      expand(rx, ry);
    };

    const expandRegion = (r: { x: number; y: number; width: number; height: number; rotation?: number; pathPoints?: { x: number; y: number }[] }, previewPathPts?: { x: number; y: number }[], previewX?: number, previewY?: number, previewW?: number, previewH?: number) => {
      const rot = r.rotation || 0;
      const rx = previewX ?? r.x;
      const ry = previewY ?? r.y;
      const rw = previewW ?? r.width;
      const rh = previewH ?? r.height;
      const pathPts = previewPathPts ?? r.pathPoints;
      if (pathPts && pathPts.length > 0) {
        const cx = pathPts.reduce((s, p) => s + p.x, 0) / pathPts.length;
        const cy = pathPts.reduce((s, p) => s + p.y, 0) / pathPts.length;
        for (const p of pathPts) expandRotated(cx, cy, p.x, p.y, rot);
      } else {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        expandRotated(cx, cy, rx,      ry,      rot);
        expandRotated(cx, cy, rx + rw, ry,      rot);
        expandRotated(cx, cy, rx,      ry + rh, rot);
        expandRotated(cx, cy, rx + rw, ry + rh, rot);
      }
    };

    for (const m of group.members) {
      if (m.type === 'mapObject') {
        const o = liveMapObjects.find(x => x.id === m.id);
        if (o) {
          if (o.wallPoints && o.wallPoints.length > 0) {
            for (const p of o.wallPoints) expand(p.x, p.y);
          } else {
            expand(o.position.x - (o.width || 0) / 2, o.position.y - (o.height || 0) / 2);
            expand(o.position.x + (o.width || 0) / 2, o.position.y + (o.height || 0) / 2);
          }
        }
      } else if (m.type === 'region') {
        const preview = dragPreview?.regionId === m.id ? dragPreview : null;
        // Try live store first, then fall back to React closure `regions`
        const r = liveRegions.find(x => x.id === m.id) ?? regions.find(x => x.id === m.id);
        if (r) {
          expandRegion(r, preview?.pathPoints ?? undefined, preview?.x, preview?.y, preview?.width, preview?.height);
        } else {
          console.warn('[computeGroupAABB] region member not found:', m.id, '| store size:', liveRegions.length);
        }
      } else if (m.type === 'light') {
        const l = liveLights.find(x => x.id === m.id);
        if (l) expand(l.position.x, l.position.y);
      } else if (m.type === 'token') {
        const t = tokens.find(x => x.id === m.id);
        if (t) expand(t.x, t.y);
      }
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  };

  /** Centroid of the group combined AABB — single shared pivot for all rotation ops. */
  const computeGroupCentroid = (group: { members: { id: string; type: string }[] }): { x: number; y: number } => {
    const b = computeGroupAABB(group);
    if (!b) return { x: 0, y: 0 };
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  };

  // Helper function to rotate a point around a center (clockwise for positive angle on canvas).
  // Uses the standard rotation matrix: nx = cx + dx*cos - dy*sin, ny = cy + dx*sin + dy*cos
  const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
    const cos = Math.cos((angle * Math.PI) / 180);
    const sin = Math.sin((angle * Math.PI) / 180);
    const dx = px - cx;
    const dy = py - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  };
  /** Delegates to computeGroupAABB — kept as alias so callers don't need updating. */
  const computeGroupBounds = (group: { members: { id: string; type: string }[] }): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    return computeGroupAABB(group);
  };

  /**
   * Get the world-space position of a group's single rotation handle.
   * Placed above the top-center of the group's combined bounding box.
   */
  const getGroupRotationHandlePos = (group: { members: { id: string; type: string }[] }): { x: number; y: number } | null => {
    const b = computeGroupBounds(group);
    if (!b) return null;
    const handleDist = 40 / transform.zoom;
    return { x: (b.minX + b.maxX) / 2, y: b.minY - handleDist };
  };

  /**
   * Draw a single shared rotation handle for an entire group.
   * Called once per selected group in the render loop.
   */
  const drawGroupRotationHandle = (ctx: CanvasRenderingContext2D, group: { members: { id: string; type: string }[] }) => {
    // During active rotation use the frozen AABB (captured at mousedown) so the bounding box
    // doesn't drift as siblings get updated to their rotated positions each frame.
    const b = (isRotatingRegion && groupFrozenAABBRef.current) ? groupFrozenAABBRef.current : computeGroupBounds(group);
    if (!b) return;
    const handleDist = 40 / transform.zoom;
    const handleSize = 8 / transform.zoom;
    const resizeHandleSize = 12 / transform.zoom;
    const cx = (b.minX + b.maxX) / 2;
    const topY = b.minY;
    const handleX = cx;
    const handleY = topY - handleDist;

    ctx.save();
    // Dashed outline box around entire group
    ctx.strokeStyle = 'rgba(79, 70, 229, 0.6)';
    ctx.lineWidth = 1.5 / transform.zoom;
    ctx.setLineDash([6 / transform.zoom, 4 / transform.zoom]);
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.setLineDash([]);

    // Draw 8 resize handles (corners + edge midpoints) for the unified group bounding box
    const groupW = b.maxX - b.minX;
    const groupH = b.maxY - b.minY;
    const resizeHandles = [
      { x: b.minX,           y: b.minY },            // nw
      { x: b.minX + groupW/2, y: b.minY },           // n
      { x: b.maxX,           y: b.minY },            // ne
      { x: b.maxX,           y: b.minY + groupH/2 }, // e
      { x: b.maxX,           y: b.maxY },            // se
      { x: b.minX + groupW/2, y: b.maxY },           // s
      { x: b.minX,           y: b.maxY },            // sw
      { x: b.minX,           y: b.minY + groupH/2 }, // w
    ];
    ctx.fillStyle = '#4f46e5';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / transform.zoom;
    resizeHandles.forEach(h => {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.fillRect(-resizeHandleSize / 2, -resizeHandleSize / 2, resizeHandleSize, resizeHandleSize);
      ctx.strokeRect(-resizeHandleSize / 2, -resizeHandleSize / 2, resizeHandleSize, resizeHandleSize);
      ctx.restore();
    });

    // Stem line
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2 / transform.zoom;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(handleX, handleY);
    ctx.stroke();

    // Handle circle (rotation)
    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / transform.zoom;
    ctx.beginPath();
    ctx.arc(handleX, handleY, handleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  /**
   * Hit-test whether the mouse is over the group-level rotation handle.
   */
  const isOverGroupRotationHandle = (mouseX: number, mouseY: number, group: { members: { id: string; type: string }[] }): boolean => {
    const pos = getGroupRotationHandlePos(group);
    if (!pos) return false;
    const hitRadius = 12 / transform.zoom;
    return Math.sqrt((mouseX - pos.x) ** 2 + (mouseY - pos.y) ** 2) <= hitRadius;
  };

  // Function to check if mouse is over a region's OWN rotation handle (only for ungrouped regions)
  const isOverRotationHandle = (mouseX: number, mouseY: number, region: CanvasRegion) => {
    // If this region is in a group, its individual handle is suppressed — use isOverGroupRotationHandle instead
    if (useGroupStore.getState().isEntityInAnyGroup(region.id)) return false;

    const handleSize = 30 / transform.zoom;
    const rotationHandleDistance = 30 / transform.zoom;
    const rotation = region.rotation || 0;
    const cx = region.x + region.width / 2;
    const cy = region.y + region.height / 2;
    const rad = (rotation * Math.PI) / 180;

    // Rotate the raw handle position to match region orientation
    const rawX = region.x + region.width / 2;
    const rawY = region.y - rotationHandleDistance;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotationX = cos * (rawX - cx) - sin * (rawY - cy) + cx;
    const rotationY = sin * (rawX - cx) + cos * (rawY - cy) + cy;

    const distance = Math.sqrt((mouseX - rotationX) ** 2 + (mouseY - rotationY) ** 2);
    return distance <= handleSize;
  };

  // ─── MapObject scale handle hit-test ─────────────────────────────────────────
  // Returns 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w' or null
  const getMapObjectScaleHandle = (obj: import('@/types/mapObjectTypes').MapObject, worldX: number, worldY: number): string | null => {
    if (obj.shape === 'wall' || obj.locked) return null;
    if (useGroupStore.getState().isEntityInAnyGroup(obj.id)) return null;
    const hitSize = 18 / transform.zoom;
    const rotation = obj.rotation || 0;
    const rad = -(rotation * Math.PI) / 180; // un-rotate mouse
    const cx = obj.position.x;
    const cy = obj.position.y;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    // Un-rotate the world point into object-local space
    const lx = cx + cos * (worldX - cx) - sin * (worldY - cy);
    const ly = cy + sin * (worldX - cx) + cos * (worldY - cy);
    const hw = obj.width / 2;
    const hh = obj.height / 2;
    const handles: [string, number, number][] = [
      ['nw', cx - hw, cy - hh],
      ['n',  cx,      cy - hh],
      ['ne', cx + hw, cy - hh],
      ['e',  cx + hw, cy     ],
      ['se', cx + hw, cy + hh],
      ['s',  cx,      cy + hh],
      ['sw', cx - hw, cy + hh],
      ['w',  cx - hw, cy     ],
    ];
    for (const [name, hx, hy] of handles) {
      if (Math.abs(lx - hx) <= hitSize && Math.abs(ly - hy) <= hitSize) return name;
    }
    return null;
  };

  // Returns true if the mouse is over the rotation handle of an ungrouped, unlocked, non-wall map object
  const isOverMapObjectRotationHandle = (obj: import('@/types/mapObjectTypes').MapObject, worldX: number, worldY: number): boolean => {
    if (obj.shape === 'wall' || obj.locked) return false;
    if (useGroupStore.getState().isEntityInAnyGroup(obj.id)) return false;
    const rotation = obj.rotation || 0;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    const cx = obj.position.x;
    const cy = obj.position.y;
    const dist = 30 / transform.zoom;
    const rawY = cy - obj.height / 2 - dist;
    const rx = cx + (cx - cx) * cos - (rawY - cy) * sin; // simplifies: cx
    const ry = cy + (cx - cx) * sin + (rawY - cy) * cos;
    // Actually: raw handle is directly above center, just rotated
    const hhx = cx + 0 * cos - (rawY - cy) * sin;
    const hhy = cy + 0 * sin + (rawY - cy) * cos;
    return Math.hypot(worldX - hhx, worldY - hhy) <= 18 / transform.zoom;
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
    ephemeralBus.emit("presence.activity", { activity: type === "freehand" ? "drawing freehand region" : "drawing polygon region" });
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
      drawTokenLabel(
        ctx,
        displayText,
        token.x,
        token.y,
        labelPos,
        radius,
        transform.zoom,
        token.labelColor,
        token.labelBackgroundColor
      );
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
  }, [transform, filteredTokens, filteredRegions, currentPath, isInCombat, currentTurnIndex, imageLoadCounter]);

  // --- Auto-pause animations while panning or fog brush is active ---
  const setAnimationsPaused = useUiModeStore((state) => state.setAnimationsPaused);

  useEffect(() => {
    const shouldOverride = isPanning || fogRevealBrushActive;

    if (shouldOverride) {
      // Capture the user's current preference (only once per override session)
      if (animPauseBeforeOverrideRef.current === null) {
        animPauseBeforeOverrideRef.current = useUiModeStore.getState().animationsPaused;
      }
      // Force pause
      setAnimationsPaused(true);
    } else {
      // Restore only if we previously overrode
      if (animPauseBeforeOverrideRef.current !== null) {
        setAnimationsPaused(animPauseBeforeOverrideRef.current);
        animPauseBeforeOverrideRef.current = null;
      }
    }
  }, [isPanning, fogRevealBrushActive, setAnimationsPaused]);

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
    
    // Check if there are any animated textures (GIFs) on tokens or regions
    const hasAnimatedTextures = tokens.some((token) => 
      token.imageUrl && animatedTextureManager.isAnimated(token.imageUrl)
    ) || regions.some((region) => 
      region.backgroundImage && animatedTextureManager.isAnimated(region.backgroundImage)
    );

    // Only run animation loop if there's something to animate
    if (!hasHostileTokens && !hoveredTokenId && !hasAnimatedIllumination && !hasAnimatedTextures) return;

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
    // Include regions for animated region textures
    // Include mapObjects so door state changes are reflected immediately in animation frames
  }, [tokens, regions, mapObjects, hoveredTokenId, players, currentPlayerId, roles, transform, animationsPaused, renderingMode]);

  // ---------------------------------------------------------------------------
  // Marquee DOM helpers — update/hide the marquee <div> directly via ref so
  // that we never trigger a React re-render during the drag (eliminates flicker).
  // Positions are in SCREEN space (CSS pixels), derived from world coords + transform.
  // ---------------------------------------------------------------------------
  const updateMarqueeDivFromRefs = () => {
    const div = marqueeDivRef.current;
    const canvas = canvasRef.current;
    if (!div || !canvas || !marqueeStartRef.current || !marqueeEndRef.current) return;

    const start = marqueeStartRef.current;
    const end = marqueeEndRef.current;

    // Convert world → screen using the latest transform (via ref to avoid stale closure)
    const t = transformRef.current;
    const toScreen = (wx: number, wy: number) => ({
      sx: wx * t.zoom + t.x,
      sy: wy * t.zoom + t.y,
    });

    const s = toScreen(start.x, start.y);
    const en = toScreen(end.x, end.y);

    const left = Math.min(s.sx, en.sx);
    const top  = Math.min(s.sy, en.sy);
    const w    = Math.abs(en.sx - s.sx);
    const h    = Math.abs(en.sy - s.sy);

    div.style.left    = `${left}px`;
    div.style.top     = `${top}px`;
    div.style.width   = `${w}px`;
    div.style.height  = `${h}px`;
    div.style.display = 'block';
  };

  const hideMarqueeDiv = () => {
    const div = marqueeDivRef.current;
    if (div) div.style.display = 'none';
  };

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

      // ── CTRL+CLICK: Emit map ping ──
      if (e.ctrlKey && !e.shiftKey && !e.metaKey) {
        const cursorColor = useCursorStore.getState().cursors[useSessionStore.getState().currentPlayerId || ""]?.color || "#fbbf24";
        const pingTs = Date.now();
        ephemeralBus.emit("map.ping", { pos: { x: worldPos.x, y: worldPos.y }, color: cursorColor });
        // Also show locally immediately
        setActivePings((prev) => [...prev, {
          id: `local-${pingTs}`,
          pos: { x: worldPos.x, y: worldPos.y },
          color: cursorColor,
          ts: pingTs,
        }]);
        return;
      }

      // Check if we clicked on a token first (tokens are on top)
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      const clickedMapObject = findMapObjectAtPoint(worldPos.x, worldPos.y, mapObjects, isDM && renderingMode === 'play', transform.zoom);
      const clickedRegion = getRegionAtPosition(worldPos.x, worldPos.y);

      if (clickedToken) {
        // Token selection logic
        if (e.ctrlKey || e.metaKey || (e.shiftKey && renderingMode === 'play')) {
          // Ctrl+click or Shift+click in play mode: toggle selection (add/remove from multi-select)
          setSelectedTokenIds((prev) =>
            prev.includes(clickedToken.id) ? prev.filter((id) => id !== clickedToken.id) : [...prev, clickedToken.id],
          );
        } else {
          // Normal click: check for group membership first
          const propagated = propagateGroupSelection(clickedToken.id, 'token');
          if (!propagated) {
            setSelectedTokenIds([clickedToken.id]);
          }
        }
        // Clear map object selection when selecting token (unless group propagation already set it)
        if (!getGroupForEntity(clickedToken.id)) {
          clearMapObjectSelection();
        }
      } else if (clickedMapObject) {
        // Map object selection logic
        if (renderingMode === "edit") {
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+click: toggle selection (no group propagation)
            selectMapObject(clickedMapObject.id, true);
          } else {
            // Normal click: check group membership
            const propagated = propagateGroupSelection(clickedMapObject.id, 'mapObject');
            if (!propagated) {
              selectMapObject(clickedMapObject.id, false);
            }
          }
          if (!getGroupForEntity(clickedMapObject.id)) {
            setSelectedTokenIds([]);
            clearSelection();
            setSelectedRegionIds([]);
          }
        } else if (renderingMode === "play" && isDM && clickedMapObject.category === 'door') {
          // DM can toggle doors in play mode
          const isOpening = !clickedMapObject.isOpen;
          triggerDoorAnimation(clickedMapObject.id, isOpening);
          toggleDoor(clickedMapObject.id);
        } else if (renderingMode === 'play') {
          // In play mode, non-door map objects are not interactive — clear selection and start marquee
          setSelectedTokenIds([]);
          isMarqueeSelectingRef.current = true;
          marqueeStartRef.current = worldPos;
          marqueeEndRef.current = worldPos;
          setIsMarqueeSelecting(true);
        }
      } else if (clickedRegion) {
        // Only allow region selection in edit mode
        if (renderingMode === "edit") {
          // Check if clicking on rotation handle (individual or group-level)
          const clickedRegionGroup = useGroupStore.getState().getGroupForEntity(clickedRegion.id);
          const overGroupHandle = clickedRegionGroup && isOverGroupRotationHandle(worldPos.x, worldPos.y, clickedRegionGroup);
          if (clickedRegion.selected && (overGroupHandle || isOverRotationHandle(worldPos.x, worldPos.y, clickedRegion))) {
            return;
          }

          // Region selection logic - handle multi-select with shift key
          if (e.shiftKey) {
            if (selectedRegionIds.includes(clickedRegion.id)) {
              setSelectedRegionIds(prev => prev.filter(id => id !== clickedRegion.id));
              deselectRegion(clickedRegion.id);
            } else {
              setSelectedRegionIds(prev => [...prev, clickedRegion.id]);
              selectRegion(clickedRegion.id);
            }
          } else {
            const propagated = propagateGroupSelection(clickedRegion.id, 'region');
            if (!propagated) {
              clearSelection();
              selectRegion(clickedRegion.id);
              setSelectedRegionIds([clickedRegion.id]);
            }
          }
          if (!getGroupForEntity(clickedRegion.id)) {
            setSelectedTokenIds([]);
            clearMapObjectSelection();
          }
        } else {
          // In play mode, clicking a region clears token selection and starts marquee
          setSelectedTokenIds([]);
          isMarqueeSelectingRef.current = true;
          marqueeStartRef.current = worldPos;
          marqueeEndRef.current = worldPos;
          setIsMarqueeSelecting(true);
        }
      } else {
        // Clicked on empty space
        if (e.shiftKey && renderingMode === 'edit') {
          // Shift+click in edit mode: add token at clicked position
          addTokenToCanvas("", worldPos.x, worldPos.y);
        } else if (renderingMode === 'edit') {
          // In edit mode: start marquee selection
          isMarqueeSelectingRef.current = true;
          marqueeStartRef.current = worldPos;
          marqueeEndRef.current = worldPos;
          setIsMarqueeSelecting(true);
          // Clear existing selection when starting new marquee
          selectedRegionIds.forEach(id => deselectRegion(id));
          setSelectedRegionIds([]);
          setSelectedTokenIds([]);
          clearMapObjectSelection();
          clearLightSelection();
        } else {
          // Play mode: clicking empty space — clear selection (unless shift held) then start marquee
          if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            setSelectedTokenIds([]);
          }
          isMarqueeSelectingRef.current = true;
          marqueeStartRef.current = worldPos;
          marqueeEndRef.current = worldPos;
          setIsMarqueeSelecting(true);
        }
      }
    }
  };

  // Handle right-click context menu for tokens, regions, and map objects
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
    const clickedMapObject = findMapObjectAtPoint(worldPos.x, worldPos.y, mapObjects, isDM && renderingMode === 'play', transform.zoom);
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
        const isExplored = getActiveExploredArea() 
          ? isPointInRevealedArea(point, getActiveExploredArea(), currentVisibilityRef.current)
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
    } else if (clickedMapObject && renderingMode === "edit") {
      // Show map object context menu in edit mode
      // Select the map object if not already selected
      if (!selectedMapObjectIds.includes(clickedMapObject.id)) {
        selectMapObject(clickedMapObject.id, false);
      }
      setMapObjectContextMenu({
        x: e.clientX,
        y: e.clientY,
        mapObjectId: clickedMapObject.id,
      });
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
        label: region.locked ? "Unlock Region" : "Lock Region",
        icon: region.locked ? "🔓" : "🔒",
        action: () => updateRegion(region.id, { locked: !region.locked }),
      },
      ...(isDM && fogEnabled ? [
        { type: "separator" as const },
        {
          label: "Mark as Explored",
          icon: "🌫️",
          action: () => handleMarkRegionsExplored([region.id]),
        },
        {
          label: "Unreveal",
          icon: "🔲",
          action: () => handleUnmarkRegionsExplored([region.id]),
        },
      ] : []),
      { type: "separator" },
      {
        label: "Delete Region",
        icon: "🗑️",
        action: () => deleteSelectedRegion(region.id),
        danger: true,
        disabled: region.locked,
      },
    ];

    menuItems.forEach((item) => {
      if ("type" in item && item.type === "separator") {
        const separator = document.createElement("div");
        separator.className = "my-1 h-px bg-border";
        menu.appendChild(separator);
        return;
      }

      const isDisabled = "disabled" in item && item.disabled;
      const menuItem = document.createElement("div");
      menuItem.className = `px-3 py-2 text-sm rounded flex items-center gap-2 ${
        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent"
      } ${
        "danger" in item && item.danger ? "text-destructive" : ""
      } ${"active" in item && item.active ? "bg-accent font-medium" : ""}`;
      menuItem.innerHTML = `<span>${"icon" in item ? item.icon : ""}</span> ${"label" in item ? item.label : ""}${"active" in item && item.active ? " ✓" : ""}`;
      menuItem.onclick = () => {
        if (isDisabled) return;
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
    // Use map-filtered entities for hit-testing
    const tokens = filteredTokens;
    const mapObjects = filteredMapObjects;
    const regions = filteredRegions;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);

    if (e.button === 1) {
      // Middle click — canvas pan
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (e.button === 2) {
      // Right click — no longer used for panning (reserved for context menus)
      e.preventDefault();
    } else if (e.button === 0) {
      // Left click

      // ── FOG REVEAL BRUSH: intercept click when brush tool is active ──
      if (fogRevealBrushActive && fogEnabled && isDM && renderingMode === 'play') {
        // Capture pre-paint state for undo
        fogBrushPreExploredRef.current = getActiveExploredArea()
          ? (getActiveExploredArea()!.clone() as paper.CompoundPath)
          : null;
        setIsFogBrushPainting(true);
        fogBrushCursorRef.current = worldPos; // Set cursor so ghost circle is visible immediately
        stampFogBrushCircle(worldPos.x, worldPos.y);
        // Broadcast cursor position
        ephemeralBus.emit("fog.cursor.preview", { pos: { x: worldPos.x, y: worldPos.y }, radius: fogRevealBrushRadius, tool: "reveal" });
        redrawCanvas();
        return;
      }

      // ── ACTION TARGETING: intercept click when in targeting mode ──
      const actionStore = useActionStore.getState();
      if (actionStore.isTargeting && actionStore.currentAction) {
        const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
        if (clickedToken && clickedToken.id !== actionStore.currentAction.sourceTokenId) {
          // Calculate distance
          const sourceToken = tokens.find(t => t.id === actionStore.currentAction!.sourceTokenId);
          if (sourceToken) {
            const dx = clickedToken.x - sourceToken.x;
            const dy = clickedToken.y - sourceToken.y;
            const currentMap = maps.find(m => m.id === selectedMapId);
            const gridSize = currentMap?.regions?.[0]?.gridSize || 40;
            const distGrid = Math.sqrt(dx * dx + dy * dy) / gridSize;

            // Get target's defense value (AC) from stat block if available
            let defenseValue = 10;
            let defenseLabel = 'AC';
            if (clickedToken.statBlockJson) {
              try {
                const json = JSON.parse(clickedToken.statBlockJson);
                if (Array.isArray(json.ac) && json.ac.length > 0) {
                  defenseValue = typeof json.ac[0] === 'number' ? json.ac[0] : json.ac[0].ac || 10;
                } else if (typeof json.armorClass === 'number') {
                  defenseValue = json.armorClass;
                }
              } catch { /* use default */ }
            }

            actionStore.addTarget({
              tokenId: clickedToken.id,
              tokenName: clickedToken.name || clickedToken.label || 'Unknown',
              distance: distGrid,
              defenseValue,
              defenseType: 'flat',
              defenseLabel,
            });

            // Auto-confirm single target and move to resolve
            actionStore.confirmTargets();
            redrawCanvas();
          }
        }
        return; // Consume the click during targeting
      }

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

      // PRIORITY 1: Check for annotation clicks (markers stored as MapObjects with category 'annotation')
      const annotationObjs = mapObjects.filter(o => o.category === 'annotation');
      const clickedAnnotation = annotationObjs.find((ann) => {
        const dx = worldPos.x - ann.position.x;
        const dy = worldPos.y - ann.position.y;
        const radius = 12;
        if (Math.sqrt(dx * dx + dy * dy) > radius) return false;
        
        // In play mode with fog enabled, check if annotation is in revealed area
        if (renderingMode === 'play' && fogEnabled && !fogRevealAll) {
          const annotationPoint = { x: ann.position.x, y: ann.position.y };
          const isRevealed = isPointInRevealedArea(
            annotationPoint,
            getActiveExploredArea(),
            currentVisibilityRef.current
          );
          if (!isRevealed) {
            if (!isDM || dmFogVisibility === 'hidden') {
              return false;
            }
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

      // PRIORITY 2: Check for the GROUP-LEVEL rotation handle (one handle per group, above group bounds).
      // Must be checked BEFORE individual region handle tests since the handle lives outside any region shape.
      if (renderingMode === 'edit' && selectedRegionIds.length > 0) {
        const checkedGroups = new Set<string>();
        for (const rid of selectedRegionIds) {
          const grpCheck = useGroupStore.getState().getGroupForEntity(rid);
          if (grpCheck && !checkedGroups.has(grpCheck.id)) {
            checkedGroups.add(grpCheck.id);
            if (isOverGroupRotationHandle(worldPos.x, worldPos.y, grpCheck)) {
              // Start group rotation using the first region in the group as the driver
              const primaryRegion = regions.find(r => grpCheck.members.some(m => m.id === r.id && m.type === 'region'));
              if (primaryRegion) {
                setIsRotatingRegion(true);
                setDraggedRegionId(primaryRegion.id);
                setInitialRegionState(captureRegionTransformState(primaryRegion));
                setTransformingRegionId(primaryRegion.id);
                const pivot = computeGroupCentroid(grpCheck);
                groupRotationPivotRef.current = pivot;
                const groupStartAngle = calculateAngle(pivot.x, pivot.y, worldPos.x, worldPos.y);
                rotationStartAngleRef.current = groupStartAngle;
                setRotationStartAngle(groupStartAngle);
                // Snapshot ALL members (including width/height/pathPoints for regions so sibling
                // rotation never reads from a stale React closure during mousemove).
                const snap: typeof groupSiblingSnapshotsRef.current = {};
                for (const m of grpCheck.members) {
                  if (m.type === 'mapObject') {
                    const o = mapObjects.find(x => x.id === m.id);
                    if (o) snap[m.id] = { type: 'mapObject', position: { ...o.position }, rotation: o.rotation || 0, wallPoints: o.wallPoints ? o.wallPoints.map(p => ({ ...p })) : undefined };
                  } else if (m.type === 'region') {
                    const r = regions.find(x => x.id === m.id);
                    if (r) snap[m.id] = { type: 'region', x: r.x, y: r.y, width: r.width, height: r.height, pathPoints: r.pathPoints ? r.pathPoints.map(p => ({ ...p })) : undefined, regRotation: r.rotation || 0 };
                  } else if (m.type === 'light') {
                    const l = useLightStore.getState().lights.find(x => x.id === m.id);
                    if (l) snap[m.id] = { type: 'light', lightPos: { ...l.position } };
                  } else if (m.type === 'token') {
                    const t = tokens.find(x => x.id === m.id);
                    if (t) snap[m.id] = { type: 'token', position: { x: t.x, y: t.y } };
                  }
                }
                groupSiblingSnapshotsRef.current = snap;
                // Freeze the AABB so the bounding box drawn during rotation doesn't drift
                groupFrozenAABBRef.current = computeGroupAABB(grpCheck);

                // Collect tokens sitting ON any region in the group (not formal group members).
                // These must be rotated visually alongside the group during the drag.
                const groupRegionMembers = grpCheck.members
                  .filter(m => m.type === 'region')
                  .map(m => regions.find(r => r.id === m.id))
                  .filter(Boolean) as typeof regions;
                const tokensOnGroupRegions: { tokenId: string; startX: number; startY: number }[] = [];
                tokens.forEach(token => {
                  // Skip tokens that are already formal group members (handled via snap)
                  if (snap[token.id]) return;
                  if (groupRegionMembers.some(r => isPointInRegion(token.x, token.y, r))) {
                    tokensOnGroupRegions.push({ tokenId: token.id, startX: token.x, startY: token.y });
                  }
                });
                setGroupedTokens(tokensOnGroupRegions);
                return;
              }
            }
          }
        }
      }

      // PRIORITY 3: Check for ANY handle on selected region first
      // This prevents deselection when clicking handles outside the shape boundary
      // But only in edit mode - no region manipulation in play mode
      // Only works for single selection
      if (selectedRegionIds.length === 1 && renderingMode === "edit") {
        const selectedRegion = regions.find((r) => r.id === selectedRegionIds[0] && r.selected);
        if (selectedRegion) {
          // Locked regions cannot be transformed
          if (selectedRegion.locked) {
            // Allow clicking but no transformations
          } else {
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

            // Snapshot all group siblings at rotation start
            const rotGroup1 = useGroupStore.getState().getGroupForEntity(selectedRegion.id);
            if (rotGroup1) {
              // Compute FRESH centroid from ALL members as the single shared pivot
              const pivot = computeGroupCentroid(rotGroup1);
              groupRotationPivotRef.current = pivot;
              // start angle set below alongside the ref update

              const snap: typeof groupSiblingSnapshotsRef.current = {};
              for (const m of rotGroup1.members) {
                if (m.type === 'mapObject') {
                  const o = mapObjects.find(x => x.id === m.id);
                  if (o) snap[m.id] = { type: 'mapObject', position: { ...o.position }, rotation: o.rotation || 0, wallPoints: o.wallPoints ? o.wallPoints.map(p => ({ ...p })) : undefined };
                } else if (m.type === 'region') {
                  const r = regions.find(x => x.id === m.id);
                  if (r) snap[m.id] = { type: 'region', x: r.x, y: r.y, width: r.width, height: r.height, pathPoints: r.pathPoints ? r.pathPoints.map(p => ({ ...p })) : undefined, regRotation: r.rotation || 0 };
                } else if (m.type === 'light') {
                  const l = useLightStore.getState().lights.find(x => x.id === m.id);
                  if (l) snap[m.id] = { type: 'light', lightPos: { ...l.position } };
                } else if (m.type === 'token') {
                  const t = tokens.find(x => x.id === m.id);
                  if (t) snap[m.id] = { type: 'token', position: { x: t.x, y: t.y } };
                }
              }
              groupSiblingSnapshotsRef.current = snap;
              groupFrozenAABBRef.current = computeGroupAABB(rotGroup1);
              rotationStartAngleRef.current = calculateAngle(pivot.x, pivot.y, worldPos.x, worldPos.y);
              setRotationStartAngle(rotationStartAngleRef.current);
            } else {
              // No group — use the region's own center. Still snapshot the primary region so
              // mousemove always uses a stable ref baseline (avoids the compounding-delta bug).
              const centerX = selectedRegion.x + selectedRegion.width / 2;
              const centerY = selectedRegion.y + selectedRegion.height / 2;
              groupRotationPivotRef.current = null;
              const startAngle = calculateAngle(centerX, centerY, worldPos.x, worldPos.y);
              rotationStartAngleRef.current = startAngle;
              setRotationStartAngle(startAngle);
              // Snapshot the solo region so primarySnap is available in mousemove
              groupSiblingSnapshotsRef.current = {
                [selectedRegion.id]: {
                  type: 'region',
                  x: selectedRegion.x, y: selectedRegion.y,
                  width: selectedRegion.width, height: selectedRegion.height,
                  pathPoints: selectedRegion.pathPoints ? selectedRegion.pathPoints.map(p => ({ ...p })) : undefined,
                  regRotation: selectedRegion.rotation || 0,
                }
              };
            }

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
          } // end locked check
        }
      }

      // PRIORITY 2: Check what we're clicking on for dragging (tokens first, then map objects, then regions)
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      // Focus-lock map objects: filter out non-focused map entities
      const focusStateHit = useMapFocusStore.getState();
      const focusLockHit = focusStateHit.selectionLockEnabled || isFocusEffectActive(focusStateHit);
      const mapObjectsForHitTest = focusLockHit && selectedMapId
        ? mapObjects.filter(o => o.mapId === undefined || o.mapId === selectedMapId)
        : mapObjects;
      let clickedMapObject = findMapObjectAtPoint(worldPos.x, worldPos.y, mapObjectsForHitTest, isDM && renderingMode === 'play', transform.zoom);

      // If no map object was found at the click point, check if the click landed on the
      // rotation or scale handles of the currently-selected map object.  Those handles
      // are rendered outside the object's bounding box so findMapObjectAtPoint misses them.
      if (!clickedMapObject && renderingMode === 'edit' && selectedMapObjectIds.length === 1) {
        const selMObj = mapObjects.find(
          o => o.id === selectedMapObjectIds[0] && !o.locked && o.shape !== 'wall' &&
               !useGroupStore.getState().isEntityInAnyGroup(o.id)
        );
        if (selMObj) {
          const overRot = isOverMapObjectRotationHandle(selMObj, worldPos.x, worldPos.y);
          const overScale = !overRot && getMapObjectScaleHandle(selMObj, worldPos.x, worldPos.y) !== null;
          if (overRot || overScale) {
            clickedMapObject = selMObj;
          }
        }
      }
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
        ephemeralBus.emit("presence.activity", { activity: "moving token" });
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

        // Handle selection on mousedown — support shift/ctrl for additive multi-select
        let allSelected: string[];
        // Reset drag tracking on each new mousedown
        dragMovedRef.current = false;
        pendingDeselectRef.current = null;

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // Additive toggle: add or remove from current selection
          if (selectedTokenIds.includes(clickedToken.id)) {
            // Already selected with modifier — keep for potential drag, schedule deselect on mouseup if no drag occurs
            allSelected = selectedTokenIds;
            pendingDeselectRef.current = clickedToken.id;
          } else {
            allSelected = [...selectedTokenIds, clickedToken.id];
            setSelectedTokenIds(allSelected);
          }
        } else if (selectedTokenIds.includes(clickedToken.id)) {
          // Token already in selection — keep full selection for multi-drag
          allSelected = selectedTokenIds;
        } else {
          // Normal click on unselected token — select just this one
          allSelected = [clickedToken.id];
          setSelectedTokenIds(allSelected);
        }

        // Capture start positions for ALL selected tokens (enables multi-drag)
        const startPositions: Record<string, { x: number; y: number }> = {};
        tokens.forEach(t => {
          if (allSelected.includes(t.id)) {
            startPositions[t.id] = { x: t.x, y: t.y };
          }
        });
        multiDragStartPositionsRef.current = startPositions;

        // ── Emit drag begin to network ──
        emitDragBegin({ tokenId: clickedToken.id, startPos: { x: clickedToken.x, y: clickedToken.y }, mode: "freehand" });
      } else if (clickedMapObject && clickedMapObject.selected && renderingMode === "edit" && !clickedMapObject.locked) {
        // Wall point edit mode: add/remove vertices
        if (wallPointEditMode && clickedMapObject.shape === 'wall' && clickedMapObject.wallPoints) {
          const vertexHit = findWallVertexAtPoint(worldPos.x, worldPos.y, mapObjects, transform.zoom);
          if (vertexHit && vertexHit.mapObjectId === clickedMapObject.id) {
            // Remove vertex (but keep at least 2 points)
            if (clickedMapObject.wallPoints.length > 2) {
              const newPoints = clickedMapObject.wallPoints.filter((_, i) => i !== vertexHit.vertexIndex);
              const xs = newPoints.map(p => p.x);
              const ys = newPoints.map(p => p.y);
              updateMapObject(clickedMapObject.id, {
                wallPoints: newPoints,
                position: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys),
              });
              toast.success('Vertex removed');
              redrawCanvas();
            } else {
              toast.error('Wall must have at least 2 points');
            }
          } else {
            // Add vertex on nearest segment
            const segHit = findNearestWallSegmentPoint(worldPos.x, worldPos.y, mapObjects, transform.zoom);
            if (segHit && segHit.mapObjectId === clickedMapObject.id) {
              const newPoints = [...clickedMapObject.wallPoints];
              newPoints.splice(segHit.segmentIndex + 1, 0, segHit.point);
              const xs = newPoints.map(p => p.x);
              const ys = newPoints.map(p => p.y);
              updateMapObject(clickedMapObject.id, {
                wallPoints: newPoints,
                position: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys),
              });
              toast.success('Vertex added');
              redrawCanvas();
            }
          }
          return; // Don't start dragging in point edit mode
        }
        // Check for wall vertex drag first (before general MapObject drag)
        const vertexHit = findWallVertexAtPoint(worldPos.x, worldPos.y, mapObjects, transform.zoom);
        if (vertexHit && renderingMode === "edit") {
          setIsDraggingVertex(true);
          setDraggedVertexInfo(vertexHit);
        } else if (clickedMapObject && clickedMapObject.selected && renderingMode === "edit" && !clickedMapObject.locked) {
          // ── PRIORITY: rotation handle → scale handles → drag ──────────────
          const isWallObj = clickedMapObject.shape === 'wall';

          if (!isWallObj && isOverMapObjectRotationHandle(clickedMapObject, worldPos.x, worldPos.y)) {
            // Start rotation (handle always visible in edit mode)
            setIsRotatingMapObject(true);
            setRotatingMapObjectId(clickedMapObject.id);
            const mobjRotGroup = useGroupStore.getState().getGroupForEntity(clickedMapObject.id);
            const rotPivot = mobjRotGroup
              ? (() => { const b = computeGroupBounds(mobjRotGroup); return b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : clickedMapObject.position; })()
              : clickedMapObject.position;
            groupRotationPivotRef.current = rotPivot;
            setMapObjectRotationStartAngle(calculateAngle(rotPivot.x, rotPivot.y, worldPos.x, worldPos.y));
            setMapObjectRotationStartValue(clickedMapObject.rotation || 0);
            const mobjRotSnap: typeof groupSiblingSnapshotsRef.current = {};
            mobjRotSnap[clickedMapObject.id] = {
              type: 'mapObject',
              position: { ...clickedMapObject.position },
              rotation: clickedMapObject.rotation || 0,
              wallPoints: clickedMapObject.wallPoints ? clickedMapObject.wallPoints.map(p => ({ ...p })) : undefined,
            };
            if (mobjRotGroup) {
              for (const m of mobjRotGroup.members) {
                if (m.id === clickedMapObject.id) continue;
                if (m.type === 'mapObject') {
                  const o = mapObjects.find(x => x.id === m.id);
                  if (o) mobjRotSnap[m.id] = { type: 'mapObject', position: { ...o.position }, rotation: o.rotation || 0, wallPoints: o.wallPoints ? o.wallPoints.map(p => ({ ...p })) : undefined };
                } else if (m.type === 'region') {
                  const r = regions.find(x => x.id === m.id);
                  if (r) mobjRotSnap[m.id] = { type: 'region', x: r.x, y: r.y, regRotation: r.rotation || 0, width: r.width, height: r.height, pathPoints: r.pathPoints ? r.pathPoints.map(p => ({ ...p })) : undefined };
                } else if (m.type === 'light') {
                  const l = useLightStore.getState().lights.find(x => x.id === m.id);
                  if (l) mobjRotSnap[m.id] = { type: 'light', lightPos: { ...l.position } };
                } else if (m.type === 'token') {
                  const t = tokens.find(x => x.id === m.id);
                  if (t) mobjRotSnap[m.id] = { type: 'token', position: { x: t.x, y: t.y } };
                }
              }
            }
            groupSiblingSnapshotsRef.current = mobjRotSnap;

          } else if (!isWallObj && mapObjectTool !== 'points') {
            // Check scale handles
            const scaleHandle = getMapObjectScaleHandle(clickedMapObject, worldPos.x, worldPos.y);
            if (scaleHandle) {
              setIsResizingMapObject(true);
              setMapObjectResizeHandle(scaleHandle);
              setMapObjectResizeSnapshot({
                id: clickedMapObject.id,
                position: { ...clickedMapObject.position },
                width: clickedMapObject.width,
                height: clickedMapObject.height,
                rotation: clickedMapObject.rotation || 0,
              });
            } else {
              // Drag
              setIsDraggingMapObject(true);
              setDraggedMapObjectId(clickedMapObject.id);
              setMapObjectDragOffset({ x: worldPos.x - clickedMapObject.position.x, y: worldPos.y - clickedMapObject.position.y });
              const mobjDragGroup = useGroupStore.getState().getGroupForEntity(clickedMapObject.id);
              const snap: typeof groupSiblingSnapshotsRef.current = {};
              snap[clickedMapObject.id] = { type: 'mapObject', position: { ...clickedMapObject.position }, wallPoints: clickedMapObject.wallPoints ? clickedMapObject.wallPoints.map(p => ({ ...p })) : undefined };
              if (mobjDragGroup) {
                for (const m of mobjDragGroup.members) {
                  if (m.id === clickedMapObject.id) continue;
                  if (m.type === 'mapObject') { const o = mapObjects.find(x => x.id === m.id); if (o) snap[m.id] = { type: 'mapObject', position: { ...o.position }, wallPoints: o.wallPoints ? o.wallPoints.map(p => ({ ...p })) : undefined }; }
                  else if (m.type === 'region') { const r = regions.find(x => x.id === m.id); if (r) snap[m.id] = { type: 'region', x: r.x, y: r.y, regionType: r.regionType, pathPoints: r.pathPoints?.map(p => ({ ...p })), bezierControlPoints: r.bezierControlPoints?.map(c => ({ cp1: { ...c.cp1 }, cp2: { ...c.cp2 } })) }; }
                  else if (m.type === 'light') { const l = useLightStore.getState().lights.find(x => x.id === m.id); if (l) snap[m.id] = { type: 'light', lightPos: { ...l.position } }; }
                  else if (m.type === 'token') { const t = tokens.find(x => x.id === m.id); if (t) snap[m.id] = { type: 'token', position: { x: t.x, y: t.y } }; }
                }
              }
              groupSiblingSnapshotsRef.current = snap;
            }
          } else {
            // Wall / points mode: always drag
            setIsDraggingMapObject(true);
            setDraggedMapObjectId(clickedMapObject.id);
            setMapObjectDragOffset({ x: worldPos.x - clickedMapObject.position.x, y: worldPos.y - clickedMapObject.position.y });
            const mobjDragGroup2 = useGroupStore.getState().getGroupForEntity(clickedMapObject.id);
            const snap2: typeof groupSiblingSnapshotsRef.current = {};
            snap2[clickedMapObject.id] = { type: 'mapObject', position: { ...clickedMapObject.position }, wallPoints: clickedMapObject.wallPoints ? clickedMapObject.wallPoints.map(p => ({ ...p })) : undefined };
            if (mobjDragGroup2) {
              for (const m of mobjDragGroup2.members) {
                if (m.id === clickedMapObject.id) continue;
                if (m.type === 'mapObject') { const o = mapObjects.find(x => x.id === m.id); if (o) snap2[m.id] = { type: 'mapObject', position: { ...o.position }, wallPoints: o.wallPoints ? o.wallPoints.map(p => ({ ...p })) : undefined }; }
                else if (m.type === 'region') { const r = regions.find(x => x.id === m.id); if (r) snap2[m.id] = { type: 'region', x: r.x, y: r.y, regionType: r.regionType, pathPoints: r.pathPoints?.map(p => ({ ...p })), bezierControlPoints: r.bezierControlPoints?.map(c => ({ cp1: { ...c.cp1 }, cp2: { ...c.cp2 } })) }; }
                else if (m.type === 'light') { const l = useLightStore.getState().lights.find(x => x.id === m.id); if (l) snap2[m.id] = { type: 'light', lightPos: { ...l.position } }; }
                else if (m.type === 'token') { const t = tokens.find(x => x.id === m.id); if (t) snap2[m.id] = { type: 'token', position: { x: t.x, y: t.y } }; }
              }
            }
            groupSiblingSnapshotsRef.current = snap2;
          }
        }
      } else if (clickedRegion && renderingMode === 'edit' && !clickedRegion.locked &&
        (clickedRegion.selected || useGroupStore.getState().isEntityInAnyGroup(clickedRegion.id))) {
        // Region manipulation in edit mode.
        // For grouped regions: start drag immediately (no prior selection required).
        // For ungrouped regions: require prior selection.
        // When dragging a grouped region, also propagate selection to all siblings.
        const regionGroup = useGroupStore.getState().getGroupForEntity(clickedRegion.id);
        if (regionGroup) {
          // Ensure all group members are visually selected
          propagateGroupSelection(clickedRegion.id, 'region');
        }

        // Check if we're clicking on a rotation handle first (ungrouped only — group handle handled in PRIORITY 2)
        if (isOverRotationHandle(worldPos.x, worldPos.y, clickedRegion)) {
          setIsRotatingRegion(true);
          setDraggedRegionId(clickedRegion.id);

          setInitialRegionState(captureRegionTransformState(clickedRegion));
          setTransformingRegionId(clickedRegion.id);

          const rotGroup2 = useGroupStore.getState().getGroupForEntity(clickedRegion.id);
          if (rotGroup2) {
            const pivot = computeGroupCentroid(rotGroup2);
            groupRotationPivotRef.current = pivot;
            const startAngle2 = calculateAngle(pivot.x, pivot.y, worldPos.x, worldPos.y);
            rotationStartAngleRef.current = startAngle2;
            setRotationStartAngle(startAngle2);
            const snap: typeof groupSiblingSnapshotsRef.current = {};
            for (const m of rotGroup2.members) {
              if (m.type === 'mapObject') {
                const o = mapObjects.find(x => x.id === m.id);
                if (o) snap[m.id] = { type: 'mapObject', position: { ...o.position }, rotation: o.rotation || 0, wallPoints: o.wallPoints ? o.wallPoints.map(p => ({ ...p })) : undefined };
              } else if (m.type === 'region') {
                const r = regions.find(x => x.id === m.id);
                if (r) snap[m.id] = { type: 'region', x: r.x, y: r.y, width: r.width, height: r.height, pathPoints: r.pathPoints ? r.pathPoints.map(p => ({ ...p })) : undefined, regRotation: r.rotation || 0 };
              } else if (m.type === 'light') {
                const l = useLightStore.getState().lights.find(x => x.id === m.id);
                if (l) snap[m.id] = { type: 'light', lightPos: { ...l.position } };
              } else if (m.type === 'token') {
                const t = tokens.find(x => x.id === m.id);
                if (t) snap[m.id] = { type: 'token', position: { x: t.x, y: t.y } };
              }
            }
            groupSiblingSnapshotsRef.current = snap;
            groupFrozenAABBRef.current = computeGroupAABB(rotGroup2);
          } else {
            // Solo region — snapshot it so mousemove always uses the stable ref baseline
            const centerX = clickedRegion.x + clickedRegion.width / 2;
            const centerY = clickedRegion.y + clickedRegion.height / 2;
            groupRotationPivotRef.current = null;
            const startAngle3 = calculateAngle(centerX, centerY, worldPos.x, worldPos.y);
            rotationStartAngleRef.current = startAngle3;
            setRotationStartAngle(startAngle3);
            groupSiblingSnapshotsRef.current = {
              [clickedRegion.id]: {
                type: 'region',
                x: clickedRegion.x, y: clickedRegion.y,
                width: clickedRegion.width, height: clickedRegion.height,
                pathPoints: clickedRegion.pathPoints ? clickedRegion.pathPoints.map(p => ({ ...p })) : undefined,
                regRotation: clickedRegion.rotation || 0,
              }
            };
          }
          const tokensInRegion2: { tokenId: string; startX: number; startY: number }[] = [];
          tokens.forEach((token) => {
            if (isPointInRegion(token.x, token.y, clickedRegion)) {
              tokensInRegion2.push({ tokenId: token.id, startX: token.x, startY: token.y });
            }
          });
          setGroupedTokens(tokensInRegion2);
        } else {
          // For ungrouped regions, check resize handles; for grouped, skip (no resize in group mode)
          const inGroup = useGroupStore.getState().isEntityInAnyGroup(clickedRegion.id);
          const handle = !inGroup ? getResizeHandle(clickedRegion, worldPos.x, worldPos.y) : null;
          if (handle) {
            setIsResizingRegion(true);
            setResizeHandle(handle);
            setDraggedRegionId(clickedRegion.id);
            setInitialRegionState(captureRegionTransformState(clickedRegion));
            setTransformingRegionId(clickedRegion.id);
          } else {
            // Start dragging the region (for both grouped and ungrouped)
            setIsDraggingRegion(true);
            setDraggedRegionId(clickedRegion.id);
            regionDragStartRef.current = { x: clickedRegion.x, y: clickedRegion.y };
            if (currentVisibilityRef.current) {
              stableVisibilityRef.current = currentVisibilityRef.current.clone({ insert: false }) as paper.Path;
            }
            setInitialRegionState(captureRegionTransformState(clickedRegion));
            setTransformingRegionId(clickedRegion.id);
            setRegionDragOffset({ x: worldPos.x - clickedRegion.x, y: worldPos.y - clickedRegion.y });

            // Snapshot ALL group siblings (and the primary itself) for absolute-delta drag
            const dragGroup2 = useGroupStore.getState().getGroupForEntity(clickedRegion.id);
            if (dragGroup2) {
              const snap: typeof groupSiblingSnapshotsRef.current = {};
              // Include primary so regionDragStartRef is always consistent
              snap[clickedRegion.id] = { type: 'region', x: clickedRegion.x, y: clickedRegion.y, regionType: clickedRegion.regionType, pathPoints: clickedRegion.pathPoints?.map(p => ({ ...p })), bezierControlPoints: clickedRegion.bezierControlPoints?.map(c => ({ cp1: { ...c.cp1 }, cp2: { ...c.cp2 } })) };
              const groupRegionIdsForSnap = new Set<string>([clickedRegion.id]);

              for (const m of dragGroup2.members) {
                if (m.id === clickedRegion.id) continue;
                if (m.type === 'mapObject') {
                  const o = mapObjects.find(x => x.id === m.id);
                  if (o) snap[m.id] = { type: 'mapObject', position: { ...o.position }, rotation: o.rotation || 0, wallPoints: o.wallPoints ? o.wallPoints.map(p => ({ ...p })) : undefined };
                } else if (m.type === 'region') {
                  const r = regions.find(x => x.id === m.id);
                  if (r) { snap[m.id] = { type: 'region', x: r.x, y: r.y, regionType: r.regionType, pathPoints: r.pathPoints?.map(p => ({ ...p })), bezierControlPoints: r.bezierControlPoints?.map(c => ({ cp1: { ...c.cp1 }, cp2: { ...c.cp2 } })) }; groupRegionIdsForSnap.add(m.id); }
                } else if (m.type === 'light') {
                  const l = useLightStore.getState().lights.find(x => x.id === m.id);
                  if (l) snap[m.id] = { type: 'light', lightPos: { ...l.position } };
                } else if (m.type === 'token') {
                  const t = tokens.find(x => x.id === m.id);
                  if (t) snap[m.id] = { type: 'token', position: { x: t.x, y: t.y } };
                }
              }

              groupSiblingSnapshotsRef.current = snap;
            }

            const tokensInRegion3: { tokenId: string; startX: number; startY: number }[] = [];
            tokens.forEach((token) => {
              if (isPointInRegion(token.x, token.y, clickedRegion)) {
                tokensInRegion3.push({ tokenId: token.id, startX: token.x, startY: token.y });
              }
            });
            setGroupedTokens(tokensInRegion3);
            setTokensMovedByRegion(tokensInRegion3.map((t) => t.tokenId));
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
        ephemeralBus.emit("presence.activity", { activity: "placing light" });
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
    // Use map-filtered entities for hit-testing
    const tokens = filteredTokens;
    const mapObjects = filteredMapObjects;
    const regions = filteredRegions;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // ── FOG REVEAL BRUSH: track cursor and paint while dragging ──
    if (fogRevealBrushActive && fogEnabled && isDM && renderingMode === 'play') {
      const worldPos = screenToWorld(mouseX, mouseY);
      fogBrushCursorRef.current = worldPos;
      if (isFogBrushPainting) {
        stampFogBrushCircle(worldPos.x, worldPos.y);
        ephemeralBus.emit("fog.cursor.preview", { pos: { x: worldPos.x, y: worldPos.y }, radius: fogRevealBrushRadius, tool: "reveal" });
      }
      canvas.style.cursor = 'crosshair';
      redrawCanvas();
      // Still allow panning via middle-click, so don't return if panning
      if (!isPanning) return;
    }

    // Always track screen-space mouse position for fog brush reticle seeding
    lastMousePosRef.current = { x: mouseX, y: mouseY };

    // ── EPHEMERAL CURSOR: broadcast world-space position ──
    const worldCursorPos = screenToWorld(mouseX, mouseY);
    ephemeralBus.emit("cursor.update", { pos: { x: worldCursorPos.x, y: worldCursorPos.y } });

    // ── ACTION TARGETING: track mouse position for reticle ──
    const actionStoreState = useActionStore.getState();
    if (actionStoreState.isTargeting) {
      const worldPos = screenToWorld(mouseX, mouseY);
      useActionStore.getState().setTargetingMousePos({ x: worldPos.x, y: worldPos.y });

      // ── EPHEMERAL: broadcast action target preview ──
      if (actionStoreState.currentAction?.sourceTokenId) {
        ephemeralBus.emit("action.target.preview", {
          sourceTokenId: actionStoreState.currentAction.sourceTokenId,
          pos: { x: worldPos.x, y: worldPos.y },
        });
      }
      // Update cursor
      const hoverToken = getTokenAtPosition(worldPos.x, worldPos.y);
      if (hoverToken && hoverToken.id !== actionStoreState.currentAction?.sourceTokenId) {
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = 'crosshair';
      }
      redrawCanvas();
      // Don't return — allow panning during targeting if right-click drag
    }

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

    // Handle marquee selection dragging — update DOM div directly (no re-render, no flicker)
    if (isMarqueeSelectingRef.current && marqueeStartRef.current) {
      const worldPos = screenToWorld(mouseX, mouseY);
      marqueeEndRef.current = worldPos;
      updateMarqueeDivFromRefs();

      // ── EPHEMERAL: broadcast selection rectangle preview ──
      const start = marqueeStartRef.current;
      ephemeralBus.emit("selection.preview", {
        rect: {
          x: Math.min(start.x, worldPos.x),
          y: Math.min(start.y, worldPos.y),
          width: Math.abs(worldPos.x - start.x),
          height: Math.abs(worldPos.y - start.y),
        },
      });
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
      // Token dragging — mark that actual movement occurred (clears pending deselect)
      dragMovedRef.current = true;
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

        // ── Emit drag update to network (throttled 50ms) with full path ──
        emitDragUpdate({ tokenId: draggedTokenId, pos: { x: newX, y: newY }, path: dragPath });
      }

      // Update primary token position
      updateTokenPosition(draggedTokenId, newX, newY);

      // --- Multi-token drag: move all other selected tokens by the same delta ---
      const startPositions = multiDragStartPositionsRef.current;
      const primaryStart = startPositions[draggedTokenId];
      if (primaryStart && selectedTokenIds.length > 1) {
        const dx = newX - primaryStart.x;
        const dy = newY - primaryStart.y;
        selectedTokenIds.forEach(tid => {
          if (tid === draggedTokenId) return;
          const tStart = startPositions[tid];
          if (tStart) {
            updateTokenPosition(tid, tStart.x + dx, tStart.y + dy);
          }
        });
      }

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
            
            // Get combined segments (walls + vision-blocking map objects)
            const combinedSegments = combinedSegmentsRef.current;
            console.log('[DRAG VISION] Computing visibility at:', { tokenCenterX, tokenCenterY, tokenVisionRange, segmentsCount: combinedSegments.length });
            
            // Always use circular fallback for now to verify rendering works
            // TODO: Re-enable wall-based visibility once basic rendering is confirmed
            if (combinedSegments.length > 0) {
              try {
                const visibility = computeVisibilityFromSegments(
                  { x: tokenCenterX, y: tokenCenterY },
                  combinedSegments,
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
    } else if (isDraggingVertex && draggedVertexInfo) {
      // Wall vertex dragging
      const worldPos = screenToWorld(mouseX, mouseY);
      const obj = mapObjects.find(o => o.id === draggedVertexInfo.mapObjectId);
      if (obj && obj.wallPoints) {
        const newPoints = [...obj.wallPoints];
        newPoints[draggedVertexInfo.vertexIndex] = { x: worldPos.x, y: worldPos.y };
        
        // Recalculate bounding box
        const xs = newPoints.map(p => p.x);
        const ys = newPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        
        updateMapObject(draggedVertexInfo.mapObjectId, {
          wallPoints: newPoints,
          position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
          width: maxX - minX,
          height: maxY - minY,
        });
      }
      redrawCanvas();
    } else if (isResizingMapObject && mapObjectResizeHandle && mapObjectResizeSnapshot) {
      // ── Map object scale/resize drag ────────────────────────────────────────
      const worldPos = screenToWorld(mouseX, mouseY);
      const snap = mapObjectResizeSnapshot;
      const rotation = snap.rotation;
      const rad = -(rotation * Math.PI) / 180; // un-rotate mouse into local space
      const cos = Math.cos(rad); const sin = Math.sin(rad);
      const cx = snap.position.x;
      const cy = snap.position.y;

      // Transform mouse into local (un-rotated) object space
      const lx = cx + cos * (worldPos.x - cx) - sin * (worldPos.y - cy);
      const ly = cy + sin * (worldPos.x - cx) + cos * (worldPos.y - cy);

      let newLeft   = cx - snap.width / 2;
      let newRight  = cx + snap.width / 2;
      let newTop    = cy - snap.height / 2;
      let newBottom = cy + snap.height / 2;

      switch (mapObjectResizeHandle) {
        case 'nw': newLeft = lx;  newTop    = ly; break;
        case 'n':                  newTop    = ly; break;
        case 'ne': newRight = lx; newTop    = ly; break;
        case 'e':  newRight = lx;                 break;
        case 'se': newRight = lx; newBottom = ly; break;
        case 's':                  newBottom = ly; break;
        case 'sw': newLeft = lx;  newBottom = ly; break;
        case 'w':  newLeft = lx;                  break;
      }

      const newW = Math.max(10, newRight - newLeft);
      const newH = Math.max(10, newBottom - newTop);
      // New center in local space, then rotate back to world space
      const newLocalCx = (newLeft + newRight) / 2;
      const newLocalCy = (newTop  + newBottom) / 2;
      const radBack = (rotation * Math.PI) / 180;
      const cosB = Math.cos(radBack); const sinB = Math.sin(radBack);
      const newWorldCx = cx + cosB * (newLocalCx - cx) - sinB * (newLocalCy - cy);
      const newWorldCy = cy + sinB * (newLocalCx - cx) + cosB * (newLocalCy - cy);

      updateMapObject(snap.id, {
        position: { x: newWorldCx, y: newWorldCy },
        width: newW,
        height: newH,
      });
      redrawCanvas();
    } else if (isRotatingMapObject && rotatingMapObjectId) {
      // MapObject rotation drag — uses SNAPSHOT positions to prevent compounding delta.
      // Snapshots were captured at mousedown; rotationDelta is always relative to startAngle.
      const worldPos = screenToWorld(mouseX, mouseY);
      const pivot = groupRotationPivotRef.current ?? mapObjects.find(o => o.id === rotatingMapObjectId)?.position ?? { x: 0, y: 0 };
      const pivotX = pivot.x;
      const pivotY = pivot.y;
      const currentAngle = calculateAngle(pivotX, pivotY, worldPos.x, worldPos.y);
      const rotationDelta = currentAngle - mapObjectRotationStartAngle;
      const rad = (rotationDelta * Math.PI) / 180;
      const cos = Math.cos(rad); const sin = Math.sin(rad);

      // Update primary object from snapshot
      const primarySnap = groupSiblingSnapshotsRef.current[rotatingMapObjectId];
      if (primarySnap?.type === 'mapObject') {
        if (primarySnap.wallPoints) {
          // Wall: orientation is fully encoded in vertex positions — do NOT update `rotation`
          // (that field drives local icon spin, causing double-rotation on wall polylines).
          const newWallPoints = primarySnap.wallPoints.map(p => {
            const dx = p.x - pivotX; const dy = p.y - pivotY;
            return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
          });
          const xs = newWallPoints.map(p => p.x); const ys = newWallPoints.map(p => p.y);
          updateMapObject(rotatingMapObjectId, {
            wallPoints: newWallPoints,
            position: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
            width: Math.max(Math.max(...xs) - Math.min(...xs), 1),
            height: Math.max(Math.max(...ys) - Math.min(...ys), 1),
            // rotation intentionally omitted for walls — vertices carry the geometry
          });
        } else if (primarySnap.position) {
          // Non-wall (door, light, obstacle): orbit around pivot AND spin locally
          const dx = primarySnap.position.x - pivotX; const dy = primarySnap.position.y - pivotY;
          updateMapObject(rotatingMapObjectId, {
            position: { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos },
            rotation: (primarySnap.rotation || 0) + rotationDelta,
          });
        }
      }

      // Propagate rotation to group siblings — ALL use snapshots, never live store positions
      const group = useGroupStore.getState().getGroupForEntity(rotatingMapObjectId);
      if (group) {
        for (const member of group.members) {
          if (member.id === rotatingMapObjectId) continue;
          const snap = groupSiblingSnapshotsRef.current[member.id];
          if (!snap) continue;
          if (member.type === 'mapObject' && snap.type === 'mapObject') {
            if (snap.wallPoints) {
              // Wall sibling: rotate vertices only, no rotation field
              const newWallPoints = snap.wallPoints.map(p => {
                const dx = p.x - pivotX; const dy = p.y - pivotY;
                return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
              });
              const xs = newWallPoints.map(p => p.x); const ys = newWallPoints.map(p => p.y);
              updateMapObject(member.id, {
                wallPoints: newWallPoints,
                position: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
                width: Math.max(Math.max(...xs) - Math.min(...xs), 1),
                height: Math.max(Math.max(...ys) - Math.min(...ys), 1),
              });
            } else if (snap.position) {
              // Non-wall sibling: orbit + spin
              const dx = snap.position.x - pivotX; const dy = snap.position.y - pivotY;
              updateMapObject(member.id, {
                position: { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos },
                rotation: (snap.rotation || 0) + rotationDelta,
              });
            }
          } else if (member.type === 'region' && snap.type === 'region' && snap.x !== undefined && snap.y !== undefined) {
            if (snap.pathPoints && snap.pathPoints.length > 0) {
              // Path region: rotate every path point around the shared group pivot.
              // The pathPoints ARE the geometry — x/y/width/height are just the bounding box.
              const newPathPoints = snap.pathPoints.map(p => {
                const dx = p.x - pivotX; const dy = p.y - pivotY;
                return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
              });
              const pxs = newPathPoints.map(p => p.x); const pys = newPathPoints.map(p => p.y);
              const minPX = Math.min(...pxs); const maxPX = Math.max(...pxs);
              const minPY = Math.min(...pys); const maxPY = Math.max(...pys);
              updateRegion(member.id, {
                pathPoints: newPathPoints,
                x: minPX, y: minPY,
                width: Math.max(maxPX - minPX, 1),
                height: Math.max(maxPY - minPY, 1),
                rotation: 0, // geometry baked into pathPoints — no separate angle needed
              });
            } else {
              // Rect region: orbit bounding-box center around the shared pivot
              const snapW = snap.width ?? 0;
              const snapH = snap.height ?? 0;
              const cx2 = snap.x + snapW / 2; const cy2 = snap.y + snapH / 2;
              const dx = cx2 - pivotX; const dy = cy2 - pivotY;
              const newCx = pivotX + dx * cos - dy * sin; const newCy = pivotY + dx * sin + dy * cos;
              updateRegion(member.id, { x: newCx - snapW / 2, y: newCy - snapH / 2, rotation: (snap.regRotation || 0) + rotationDelta });
            }
          } else if (member.type === 'light' && snap.lightPos) {
            const dx = snap.lightPos.x - pivotX; const dy = snap.lightPos.y - pivotY;
            useLightStore.getState().updateLight(member.id, { position: { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos } });
          } else if (member.type === 'token' && snap.position) {
            // tokens handled via tempPositions
          }
        }
      }
      requestAnimationFrame(() => redrawCanvas());
    } else if (isDraggingMapObject && draggedMapObjectId) {

      // MapObject dragging in edit mode
      const worldPos = screenToWorld(mouseX, mouseY);
      const newX = worldPos.x - mapObjectDragOffset.x;
      const newY = worldPos.y - mapObjectDragOffset.y;

      // ── EPHEMERAL: broadcast map object drag position ──
      ephemeralBus.emit("mapObject.drag.update", { objectId: draggedMapObjectId, pos: { x: newX, y: newY } });

      // Compute ABSOLUTE delta from snapshot origin (not from live store — avoids compounding)
      const primarySnap = groupSiblingSnapshotsRef.current[draggedMapObjectId];
      const primaryStartX = primarySnap?.position?.x ?? newX;
      const primaryStartY = primarySnap?.position?.y ?? newY;
      const absDeltaX = newX - primaryStartX;
      const absDeltaY = newY - primaryStartY;

      const prevObj = mapObjects.find(o => o.id === draggedMapObjectId);

      // Update primary map object position (wall-aware: shift wallPoints, not just position)
      if (prevObj && prevObj.shape === 'wall' && prevObj.wallPoints && primarySnap?.wallPoints) {
        // Shift from snapshot wall points by absolute delta
        const newWallPoints = primarySnap.wallPoints.map(p => ({ x: p.x + absDeltaX, y: p.y + absDeltaY }));
        const xs = newWallPoints.map(p => p.x);
        const ys = newWallPoints.map(p => p.y);
        const minX = Math.min(...xs); const maxX = Math.max(...xs);
        const minY = Math.min(...ys); const maxY = Math.max(...ys);
        updateMapObject(draggedMapObjectId, {
          wallPoints: newWallPoints,
          position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
          width: Math.max(maxX - minX, 1),
          height: Math.max(maxY - minY, 1),
        });
      } else {
        updateMapObject(draggedMapObjectId, { position: { x: newX, y: newY } });
      }

      // Propagate to all group siblings using snapshots (absolute delta, no compounding)
      const group = useGroupStore.getState().getGroupForEntity(draggedMapObjectId);
      if (group) {
        for (const member of group.members) {
          if (member.id === draggedMapObjectId) continue;
          const snap = groupSiblingSnapshotsRef.current[member.id];
          if (!snap) continue;
          if (member.type === 'mapObject' && snap.type === 'mapObject') {
            if (snap.wallPoints) {
              const newWallPoints = snap.wallPoints.map(p => ({ x: p.x + absDeltaX, y: p.y + absDeltaY }));
              const xs = newWallPoints.map(p => p.x);
              const ys = newWallPoints.map(p => p.y);
              const minX = Math.min(...xs); const maxX = Math.max(...xs);
              const minY = Math.min(...ys); const maxY = Math.max(...ys);
              updateMapObject(member.id, {
                wallPoints: newWallPoints,
                position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
                width: Math.max(maxX - minX, 1),
                height: Math.max(maxY - minY, 1),
              });
            } else if (snap.position) {
              updateMapObject(member.id, { position: { x: snap.position.x + absDeltaX, y: snap.position.y + absDeltaY } });
            }
          } else if (member.type === 'region' && snap.type === 'region' && snap.x !== undefined && snap.y !== undefined) {
            if (snap.regionType === 'path' && snap.pathPoints) {
              const newPathPoints = snap.pathPoints.map(p => ({ x: p.x + absDeltaX, y: p.y + absDeltaY }));
              const newBezierControls = snap.bezierControlPoints?.map(c => ({ cp1: { x: c.cp1.x + absDeltaX, y: c.cp1.y + absDeltaY }, cp2: { x: c.cp2.x + absDeltaX, y: c.cp2.y + absDeltaY } }));
              const newBounds = newBezierControls ? getBezierBounds(newPathPoints, newBezierControls) : getPolygonBounds(newPathPoints);
              updateRegion(member.id, { x: newBounds.x, y: newBounds.y, width: newBounds.width, height: newBounds.height, pathPoints: newPathPoints, bezierControlPoints: newBezierControls });
            } else {
              updateRegion(member.id, { x: snap.x + absDeltaX, y: snap.y + absDeltaY });
            }
          } else if (member.type === 'light' && snap.lightPos) {
            useLightStore.getState().updateLight(member.id, { position: { x: snap.lightPos.x + absDeltaX, y: snap.lightPos.y + absDeltaY } });
          }
        }
        // Token siblings via temp positions
        const newTempPositions: { [id: string]: { x: number; y: number } } = {};
        group.members.filter(m => m.type === 'token').forEach(m => {
          const snap = groupSiblingSnapshotsRef.current[m.id];
          if (snap?.position) newTempPositions[m.id] = { x: snap.position.x + absDeltaX, y: snap.position.y + absDeltaY };
        });
        if (Object.keys(newTempPositions).length > 0) {
          setTempTokenPositions(prev => ({ ...prev, ...newTempPositions }));
        }
      }

      // Force immediate redraw for smooth dragging feedback
      requestAnimationFrame(() => redrawCanvas());
    } else if (isDraggingRegion && draggedRegionId) {
      // Region dragging - move tokens in real-time for smooth preview
      const worldPos = screenToWorld(mouseX, mouseY);
      const newX = worldPos.x - regionDragOffset.x;
      const newY = worldPos.y - regionDragOffset.y;

      // ── EPHEMERAL: broadcast region drag position ──
      ephemeralBus.emit("region.drag.update", { regionId: draggedRegionId, pos: { x: newX, y: newY } });

      // Invalidate wall decoration cache every frame so ghost decorations don't trail the drag
      wallDecorationCacheRef.current = null;

      // Find the region being dragged
      const draggedRegion = regions.find((r) => r.id === draggedRegionId);
      if (draggedRegion) {
        // Calculate movement delta from the SNAPSHOT start position (absolute, non-compounding).
        // regionDragStartRef captures the region's x/y at mousedown, so deltaX/Y are always
        // relative to the drag origin, not to the last-frame position.
        const startX = regionDragStartRef.current?.x ?? draggedRegion.x;
        const startY = regionDragStartRef.current?.y ?? draggedRegion.y;
        const deltaX = newX - startX;
        const deltaY = newY - startY;

        // Update temporary positions for preview (avoid store updates during drag)
        const newTempPositions: { [tokenId: string]: { x: number; y: number } } = {};
        groupedTokens.forEach((groupedToken) => {
          const newTokenX = groupedToken.startX + deltaX;
          const newTokenY = groupedToken.startY + deltaY;
          newTempPositions[groupedToken.tokenId] = { x: newTokenX, y: newTokenY };
        });

        // Propagate drag to group siblings (map objects + lights + other regions + annotations + terrain)
        // IMPORTANT: Always use snapshots from groupSiblingSnapshotsRef to compute new positions.
        // This prevents the compounding-delta bug where each frame adds deltaX/Y to the
        // already-moved position from the previous frame.
        const group = useGroupStore.getState().getGroupForEntity(draggedRegionId);
        if (group && (deltaX !== 0 || deltaY !== 0)) {
          // Collect all region IDs in the group (including primary) for annotation/terrain propagation
          const groupRegionIds = new Set<string>();
          groupRegionIds.add(draggedRegionId);

          for (const member of group.members) {
            if (member.id === draggedRegionId) continue;
            const snap = groupSiblingSnapshotsRef.current[member.id];
            if (!snap) continue;
            if (member.type === 'mapObject' && snap.type === 'mapObject') {
              if (snap.wallPoints) {
                const newWallPoints = snap.wallPoints.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
                const xs = newWallPoints.map(p => p.x);
                const ys = newWallPoints.map(p => p.y);
                const minX = Math.min(...xs); const maxX = Math.max(...xs);
                const minY = Math.min(...ys); const maxY = Math.max(...ys);
                updateMapObject(member.id, {
                  wallPoints: newWallPoints,
                  position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
                  width: Math.max(maxX - minX, 1),
                  height: Math.max(maxY - minY, 1),
                });
              } else if (snap.position) {
                updateMapObject(member.id, { position: { x: snap.position.x + deltaX, y: snap.position.y + deltaY } });
              }
            } else if (member.type === 'token' && snap.position) {
              newTempPositions[member.id] = { x: snap.position.x + deltaX, y: snap.position.y + deltaY };
            } else if (member.type === 'region' && snap.type === 'region' && snap.x !== undefined && snap.y !== undefined) {
              if (snap.regionType === 'path' && snap.pathPoints) {
                const newPathPoints = snap.pathPoints.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
                const newBezierControls = snap.bezierControlPoints?.map(c => ({ cp1: { x: c.cp1.x + deltaX, y: c.cp1.y + deltaY }, cp2: { x: c.cp2.x + deltaX, y: c.cp2.y + deltaY } }));
                const newBounds = newBezierControls ? getBezierBounds(newPathPoints, newBezierControls) : getPolygonBounds(newPathPoints);
                updateRegion(member.id, { x: newBounds.x, y: newBounds.y, width: newBounds.width, height: newBounds.height, pathPoints: newPathPoints, bezierControlPoints: newBezierControls });
              } else {
                updateRegion(member.id, { x: snap.x + deltaX, y: snap.y + deltaY });
              }
              groupRegionIds.add(member.id);
            } else if (member.type === 'light' && snap.lightPos) {
              useLightStore.getState().updateLight(member.id, { position: { x: snap.lightPos.x + deltaX, y: snap.lightPos.y + deltaY } });
            }
          }
          // Annotation MapObjects are now EntityGroup members — no special propagation needed.
        }

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
      // Group rotation — ALL entities (primary region + siblings) orbit the SAME pivot.
      // The pivot is the group's fresh bounding-box centroid, computed at mousedown and
      // stored in groupRotationPivotRef. This eliminates the "different pivot" bug.
      const worldPos = screenToWorld(mouseX, mouseY);

      const draggedRegion = regions.find((r) => r.id === draggedRegionId);
      if (draggedRegion) {
        // Resolve the single shared pivot: group centroid if in a group, else region center
        const pivot = groupRotationPivotRef.current ?? {
          x: draggedRegion.x + draggedRegion.width / 2,
          y: draggedRegion.y + draggedRegion.height / 2,
        };
        const pivotX = pivot.x;
        const pivotY = pivot.y;

        // Calculate rotation delta from the SAME pivot that was used for rotationStartAngle.
        // Read from the ref (not React state) to avoid stale-closure issues on the first mousemove.
        const currentAngle = calculateAngle(pivotX, pivotY, worldPos.x, worldPos.y);
        const rotationDelta = currentAngle - rotationStartAngleRef.current;

        // Commit the rotation of the PRIMARY dragged region to the store every frame so
        // that on mouseup the store has the correct final value (prevents snap-back).
        // For grouped regions, the snapshot is in groupSiblingSnapshotsRef; for solo
        // regions it is in initialRegionState.
        const primarySnap = groupSiblingSnapshotsRef.current[draggedRegionId] ?? null;
        const rad = (rotationDelta * Math.PI) / 180;
        const cos = Math.cos(rad); const sin = Math.sin(rad);

        if (draggedRegion.regionType === 'path' && (primarySnap?.pathPoints ?? draggedRegion.pathPoints)) {
          const basePathPoints = primarySnap?.pathPoints ?? draggedRegion.pathPoints!;
          const newPathPoints = basePathPoints.map(p => {
            const dx = p.x - pivotX; const dy = p.y - pivotY;
            return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
          });
          const pxs = newPathPoints.map(p => p.x); const pys = newPathPoints.map(p => p.y);
          const minPX = Math.min(...pxs); const maxPX = Math.max(...pxs);
          const minPY = Math.min(...pys); const maxPY = Math.max(...pys);
          updateRegion(draggedRegionId, {
            pathPoints: newPathPoints,
            x: minPX, y: minPY,
            width: Math.max(maxPX - minPX, 1),
            height: Math.max(maxPY - minPY, 1),
            rotation: 0,
          });
        } else {
          // Rect region: orbit its bounding-box center around the pivot then add local spin
          const snapW = (primarySnap?.width ?? (initialRegionState?.width ?? draggedRegion.width)) as number;
          const snapH = (primarySnap?.height ?? (initialRegionState?.height ?? draggedRegion.height)) as number;
          const snapX = (primarySnap?.x ?? (initialRegionState?.x ?? draggedRegion.x)) as number;
          const snapY = (primarySnap?.y ?? (initialRegionState?.y ?? draggedRegion.y)) as number;
          const baseRot = primarySnap ? (primarySnap.regRotation ?? 0) : (initialRegionState?.rotation ?? draggedRegion.rotation ?? 0);
          const cx2 = snapX + snapW / 2; const cy2 = snapY + snapH / 2;
          const dx = cx2 - pivotX; const dy = cy2 - pivotY;
          const newCx = pivotX + dx * cos - dy * sin; const newCy = pivotY + dx * sin + dy * cos;
          updateRegion(draggedRegionId, {
            x: newCx - snapW / 2, y: newCy - snapH / 2,
            rotation: baseRot + rotationDelta,
          });
        }

        // Update tempRegionRotation so drawRegion doesn't add an extra delta on top.
        // Since we've already committed to the store, temp delta should be 0.
        setTempRegionRotation(prev => ({
          ...prev,
          [draggedRegionId]: 0,
        }));

        setDragPreview({
          regionId: draggedRegionId,
          x: draggedRegion.x,
          y: draggedRegion.y,
          width: draggedRegion.width,
          height: draggedRegion.height,
          pathPoints: draggedRegion.pathPoints,
          bezierControlPoints: draggedRegion.bezierControlPoints,
        });

        // Rotate all grouped tokens around the shared pivot
        const newTempPositions: { [tokenId: string]: { x: number; y: number } } = {};
        groupedTokens.forEach((groupedToken) => {
          const rotatedPos = rotatePoint(groupedToken.startX, groupedToken.startY, pivotX, pivotY, rotationDelta);
          newTempPositions[groupedToken.tokenId] = { x: rotatedPos.x, y: rotatedPos.y };
        });

        // Propagate rotation to ALL group siblings around the SAME shared pivot.
        // Snapshots were captured for ALL members (including primary) at mousedown.
        const group = useGroupStore.getState().getGroupForEntity(draggedRegionId);
        if (group) {
          const rad = (rotationDelta * Math.PI) / 180;
          const cos = Math.cos(rad); const sin = Math.sin(rad);
          for (const member of group.members) {
            const snap = groupSiblingSnapshotsRef.current[member.id];
            if (!snap) continue;
            if (member.type === 'mapObject' && snap.type === 'mapObject') {
              if (snap.wallPoints) {
                // Rotate every SNAPSHOT wall vertex around the shared pivot
                const newWallPoints = snap.wallPoints.map(p => {
                  const dx = p.x - pivotX; const dy = p.y - pivotY;
                  return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
                });
                const xs = newWallPoints.map(p => p.x);
                const ys = newWallPoints.map(p => p.y);
                const minX = Math.min(...xs); const maxX = Math.max(...xs);
                const minY = Math.min(...ys); const maxY = Math.max(...ys);
                updateMapObject(member.id, {
                  wallPoints: newWallPoints,
                  position: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
                  width: Math.max(maxX - minX, 1),
                  height: Math.max(maxY - minY, 1),
                  // rotation omitted for walls — orientation is in wallPoints vertices
                });
              } else if (snap.position) {
                // Non-wall: orbit + local spin
                const dx = snap.position.x - pivotX; const dy = snap.position.y - pivotY;
                updateMapObject(member.id, {
                  position: { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos },
                  rotation: (snap.rotation || 0) + rotationDelta,
                });
              }
            } else if (member.type === 'token' && snap.position) {
              const dx = snap.position.x - pivotX; const dy = snap.position.y - pivotY;
              newTempPositions[member.id] = { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
            } else if (member.type === 'region' && snap.type === 'region' && snap.x !== undefined && snap.y !== undefined) {
              if (snap.pathPoints && snap.pathPoints.length > 0) {
                // Path region: rotate every path point around the shared group pivot.
                // pathPoints ARE the geometry — x/y/width/height are just the bounding box.
                const newPathPoints = snap.pathPoints.map(p => {
                  const dx = p.x - pivotX; const dy = p.y - pivotY;
                  return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
                });
                const pxs = newPathPoints.map(p => p.x); const pys = newPathPoints.map(p => p.y);
                const minPX = Math.min(...pxs); const maxPX = Math.max(...pxs);
                const minPY = Math.min(...pys); const maxPY = Math.max(...pys);
                updateRegion(member.id, {
                  pathPoints: newPathPoints,
                  x: minPX, y: minPY,
                  width: Math.max(maxPX - minPX, 1),
                  height: Math.max(maxPY - minPY, 1),
                  rotation: 0,
                });
              } else {
                // Rect region: orbit bounding-box center around shared pivot
                const snapW = snap.width ?? 0;
                const snapH = snap.height ?? 0;
                const cx2 = snap.x + snapW / 2; const cy2 = snap.y + snapH / 2;
                const dx = cx2 - pivotX; const dy = cy2 - pivotY;
                const newCx = pivotX + dx * cos - dy * sin; const newCy = pivotY + dx * sin + dy * cos;
                updateRegion(member.id, { x: newCx - snapW / 2, y: newCy - snapH / 2, rotation: (snap.regRotation || 0) + rotationDelta });
              }

            } else if (member.type === 'light' && snap.lightPos) {
              const dx = snap.lightPos.x - pivotX; const dy = snap.lightPos.y - pivotY;
              useLightStore.getState().updateLight(member.id, { position: { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos } });
            }
          }
        }

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
          ephemeralBus.emit("token.hover", { tokenId: token.id });
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
        ephemeralBus.emit("token.hover", { tokenId: null });
        
        // Check if hovering over a door (DM in play mode)
        if (isDM && renderingMode === 'play') {
          const hoveredMapObject = findMapObjectAtPoint(worldPos.x, worldPos.y, mapObjects, true, transform.zoom);
          if (hoveredMapObject?.category === 'door') {
            if (canvas) {
              canvas.style.cursor = "pointer";
            }
          } else if (canvas) {
            canvas.style.cursor = "default";
          }
        } else if (canvas) {
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
    // Use map-filtered entities for hit-testing
    const tokens = filteredTokens;
    const mapObjects = filteredMapObjects;
    const regions = filteredRegions;
    // ── FOG REVEAL BRUSH: commit painted area on mouse up ──
    if (isFogBrushPainting) {
      setIsFogBrushPainting(false);

      // Capture before/after for undo
      const preSerialized = fogBrushPreExploredRef.current
        ? serializeFogGeometry(fogBrushPreExploredRef.current)
        : '';
      commitFogBrush();
      const postSerialized = getActiveExploredArea()
        ? serializeFogGeometry(getActiveExploredArea()!)
        : '';

      if (preSerialized !== postSerialized) {
        const undoMapId = selectedMapId || 'default-map';
        undoRedoManager.push({
          type: 'FOG_BRUSH_REVEAL',
          description: 'Fog brush reveal',
          execute() {
            useFogStore.getState().setSerializedExploredAreasForMap(undoMapId, postSerialized);
          },
          undo() {
            useFogStore.getState().setSerializedExploredAreasForMap(undoMapId, preSerialized);
          },
        });
      }

      fogBrushPreExploredRef.current = null;
      return;
    }

    // Clear ephemeral selection preview on mouse up
    ephemeralBus.emit("selection.preview", {});

    // Handle marquee selection completion
    if (isMarqueeSelectingRef.current && marqueeStartRef.current && marqueeEndRef.current) {
      // Read from refs for the most up-to-date values
      const marqueeStart = marqueeStartRef.current;
      const marqueeEnd = marqueeEndRef.current;
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
        const selectedMapObjectIdsList: string[] = [];
        const selectedLightIdsList: string[] = [];
        
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
        // In play mode: only tokens that are visible to the current player can be selected.
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
          
          if (!intersects) return;

          if (renderingMode === 'play') {
            // Play mode: apply visibility gate — only select tokens the player can currently see.
            if (fogEnabled && !fogRevealAll) {
              const tokenPoint = { x: token.x, y: token.y };
              const isCurrentlyIlluminated = isPointInVisibleArea(tokenPoint, currentVisibilityRef.current);
              if (!isCurrentlyIlluminated) {
                // Non-illuminated tokens are invisible to players — cannot be selected
                return;
              }
            }
            // Must also be controllable by this player
            if (currentPlayer && canControlToken(token, currentPlayer, roles)) {
              selectedTokenIdsList.push(token.id);
            }
          } else {
            // Edit mode: only controllable tokens
            if (currentPlayer && canControlToken(token, currentPlayer, roles)) {
              selectedTokenIdsList.push(token.id);
            }
          }
        });
        
        // Select map objects (in edit mode)
        if (renderingMode === 'edit') {
          mapObjects.forEach(obj => {
            let objMinX: number, objMinY: number, objMaxX: number, objMaxY: number;
            
            if (obj.shape === 'wall' && obj.wallPoints && obj.wallPoints.length > 0) {
              // Wall polyline bounds
              const xs = obj.wallPoints.map(p => p.x);
              const ys = obj.wallPoints.map(p => p.y);
              objMinX = Math.min(...xs);
              objMinY = Math.min(...ys);
              objMaxX = Math.max(...xs);
              objMaxY = Math.max(...ys);
            } else {
              // Standard object bounds from position + dimensions
              const halfW = obj.width / 2;
              const halfH = obj.height / 2;
              objMinX = obj.position.x - halfW;
              objMinY = obj.position.y - halfH;
              objMaxX = obj.position.x + halfW;
              objMaxY = obj.position.y + halfH;
            }
            
            const intersects = !(objMaxX < minX || objMinX > maxX || 
                                objMaxY < minY || objMinY > maxY);
            
            if (intersects) {
              selectedMapObjectIdsList.push(obj.id);
            }
          });
        }
        
        // Select lights (in edit mode)
        if (renderingMode === 'edit') {
          lights.forEach(light => {
            // Light is a point with a radius; use a small bounding box around the position
            const lightSize = 15; // Visual size of light icon
            const lMinX = light.position.x - lightSize;
            const lMinY = light.position.y - lightSize;
            const lMaxX = light.position.x + lightSize;
            const lMaxY = light.position.y + lightSize;
            
            const intersects = !(lMaxX < minX || lMinX > maxX || 
                                lMaxY < minY || lMinY > maxY);
            
            if (intersects) {
              selectedLightIdsList.push(light.id);
            }
          });
        }
        
        // Update state based on what was selected
        if (selectedRegionIdsList.length > 0) {
          setSelectedRegionIds(selectedRegionIdsList);
        }
        if (selectedTokenIdsList.length > 0) {
          setSelectedTokenIds(selectedTokenIdsList);
        }
        if (selectedMapObjectIdsList.length > 0) {
          selectMapObject(selectedMapObjectIdsList[0]); // Select first
          if (selectedMapObjectIdsList.length > 1) {
            // Use selectMultiple for all
            const selectMultiple = useMapObjectStore.getState().selectMultiple;
            selectMultiple(selectedMapObjectIdsList);
          }
        }
        if (selectedLightIdsList.length > 0) {
          selectMultipleLights(selectedLightIdsList);
        }
        
        // Show feedback
        const parts: string[] = [];
        if (selectedRegionIdsList.length > 0) {
          parts.push(`${selectedRegionIdsList.length} region${selectedRegionIdsList.length !== 1 ? 's' : ''}`);
        }
        if (selectedTokenIdsList.length > 0) {
          parts.push(`${selectedTokenIdsList.length} token${selectedTokenIdsList.length !== 1 ? 's' : ''}`);
        }
        if (selectedMapObjectIdsList.length > 0) {
          parts.push(`${selectedMapObjectIdsList.length} object${selectedMapObjectIdsList.length !== 1 ? 's' : ''}`);
        }
        if (selectedLightIdsList.length > 0) {
          parts.push(`${selectedLightIdsList.length} light${selectedLightIdsList.length !== 1 ? 's' : ''}`);
        }
        if (parts.length > 0) {
          toast.success(`Selected ${parts.join(', ')}`);
        }
      }
      
      // Reset marquee state
      isMarqueeSelectingRef.current = false;
      marqueeStartRef.current = null;
      marqueeEndRef.current = null;
      setIsMarqueeSelecting(false);
      hideMarqueeDiv();
      redrawCanvas();
      return;
    }
    
    // Handle freehand drawing completion
    if (isFreehandDrawing && pathDrawingMode === "drawing" && pathDrawingType === "freehand") {
      setIsFreehandDrawing(false);
      finishPathDrawing();
      return;
    }

    if (e.button === 1) {
      // Middle click — end canvas pan
      setIsPanning(false);
    } else if (e.button === 0) {
      // Left click
      // Handle token snapping on drag end
      if (isDraggingToken && draggedTokenId && !tokensMovedByRegion.includes(draggedTokenId)) {
        const token = tokens.find((t) => t.id === draggedTokenId);
        if (token) {
          // === COLLISION CHECK FIRST ===
          const { enforceMovementBlocking, enforceRegionBounds, renderingMode } = useDungeonStore.getState();
          const shouldEnforceCollisions = renderingMode === 'play';
          
          let movementBlocked = false;
          
          if (shouldEnforceCollisions && (enforceMovementBlocking || enforceRegionBounds)) {
            // Use center point only (radius = 0) - allows tokens to pass through corridors
            // as long as their center can fit, regardless of token visual size
            const tokenRadius = 0;
            
            const blockingObjects = enforceMovementBlocking ? getBlockingObjects(mapObjects) : [];
            const checkRegions = enforceRegionBounds ? regions : [];
            
            const collisionResult = checkMovementCollision(
              dragStartPos,
              { x: token.x, y: token.y },
              tokenRadius,
              blockingObjects,
              checkRegions,
              { enforceMovementBlocking, enforceRegionBounds }
            );
            
            if (collisionResult.blocked) {
              movementBlocked = true;
              
              let blockReason = '';
              let blockDetails = '';
              if (collisionResult.collidedWith && collisionResult.collidedWith !== 'region_bounds') {
                const blockingObj = mapObjects.find(obj => obj.id === collisionResult.collidedWith);
                const objName = blockingObj?.label || blockingObj?.category || 'obstacle';
                blockReason = blockingObj?.category === 'door' 
                  ? `Blocked by closed door` 
                  : `Blocked by ${objName}`;
                blockDetails = `Object: ${blockingObj?.category}${blockingObj?.label ? ` "${blockingObj.label}"` : ''} (ID: ${collisionResult.collidedWith?.slice(0, 8)}...)`;
              } else {
                blockReason = 'Cannot leave region boundary';
                blockDetails = `Token tried to exit all regions (obstacle=${enforceMovementBlocking}, bounds=${enforceRegionBounds})`;
              }
              
              toast.error(blockReason, { 
                duration: 3000,
                description: blockDetails
              });
              
              // Snap back primary token and all multi-dragged tokens to their start positions
              const startPositions = multiDragStartPositionsRef.current;
              updateTokenPosition(draggedTokenId, dragStartPos.x, dragStartPos.y);
              selectedTokenIds.forEach(tid => {
                if (tid === draggedTokenId) return;
                const tStart = startPositions[tid];
                if (tStart) updateTokenPosition(tid, tStart.x, tStart.y);
              });
            }
          }
          
          // Only proceed with snapping if movement wasn't blocked
          if (!movementBlocked) {
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
              const isRectWithRotation = localRegion.regionType !== 'path' && !!localRegion.rotation;
              const rectCenter = isRectWithRotation ? { x: localRegion.x + localRegion.width / 2, y: localRegion.y + localRegion.height / 2 } : undefined;
              const snappedPos = snapToMapGrid(token.x, token.y, regionForSnap, isRectWithRotation ? localRegion.rotation : undefined, rectCenter);
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
            
            // Create undo command for token movement (only if not blocked)
            if (initialTokenState && (initialTokenState.x !== token.x || initialTokenState.y !== token.y)) {
              moveTokenUndoable(
                draggedTokenId,
                { x: initialTokenState.x, y: initialTokenState.y },
                { x: token.x, y: token.y },
                token.label || token.name
              );
              // Emit token move to network
              emitLocalOp({ kind: 'token.move', data: { tokenId: draggedTokenId, x: token.x, y: token.y } });
              // ── Emit drag end to network ──
              emitDragEnd({ tokenId: draggedTokenId, finalPos: { x: token.x, y: token.y } });
              // Also emit moves for multi-dragged tokens
              const startPositions = multiDragStartPositionsRef.current;
              selectedTokenIds.forEach(tid => {
                if (tid === draggedTokenId) return;
                const t = tokens.find(tk => tk.id === tid);
                if (t && startPositions[tid] && (startPositions[tid].x !== t.x || startPositions[tid].y !== t.y)) {
                  emitLocalOp({ kind: 'token.move', data: { tokenId: tid, x: t.x, y: t.y } });
                }
              });
            }
            
            // Check for portal teleportation after valid movement
            checkPortalTeleport(draggedTokenId);
          }
        }
      }
      // Clear multi-drag start positions
      multiDragStartPositionsRef.current = {};

      setIsDraggingToken(false);
      setDraggedTokenId(null);
      setDragOffset({ x: 0, y: 0 });
      setDragStartPos({ x: 0, y: 0 });
      setDragPath([]);
      setInitialTokenState(null);

      // If a modifier-click on an already-selected token happened and no drag occurred,
      // now remove that token from the selection (deferred deselect).
      if (!dragMovedRef.current && pendingDeselectRef.current) {
        const tokenToDeselect = pendingDeselectRef.current;
        setSelectedTokenIds(prev => prev.filter(id => id !== tokenToDeselect));
      }
      pendingDeselectRef.current = null;
      dragMovedRef.current = false;
      
      // Clear stable visibility snapshot after drag ends
      if (stableVisibilityRef.current) {
        stableVisibilityRef.current.remove();
        stableVisibilityRef.current = null;
      }

      // Update highlights for all tokens after drag ends
      updateAllTokenHighlights();

      // Handle wall vertex drag completion
      if (isDraggingVertex && draggedVertexInfo) {
        setIsDraggingVertex(false);
        setDraggedVertexInfo(null);
        notifyObstaclesChanged();
        toast.success("Wall vertex moved");
      }

      // Handle MapObject rotation completion
      if (isRotatingMapObject && rotatingMapObjectId) {
        // Build batch undo covering ALL group members (map objects + regions)
        const snapshots = groupSiblingSnapshotsRef.current;
        const currentMapObjects = useMapObjectStore.getState().mapObjects;
        const currentRegions = useRegionStore.getState().regions;

        type MapObjEntry = { id: string; before: Partial<import('@/types/mapObjectTypes').MapObject>; after: Partial<import('@/types/mapObjectTypes').MapObject> };
        type RegionEntry = { id: string; before: Partial<CanvasRegion>; after: Partial<CanvasRegion> };
        const mobjEntries: MapObjEntry[] = [];
        const regionEntries: RegionEntry[] = [];

        for (const [memberId, snap] of Object.entries(snapshots)) {
          if (snap.type === 'mapObject') {
            const afterObj = currentMapObjects.find(o => o.id === memberId);
            if (!afterObj) continue;
            const before: Partial<import('@/types/mapObjectTypes').MapObject> = {
              position: { ...snap.position! },
              rotation: snap.rotation,
              ...(snap.wallPoints ? { wallPoints: snap.wallPoints.map(p => ({ ...p })), width: afterObj.width, height: afterObj.height } : {}),
            };
            const after: Partial<import('@/types/mapObjectTypes').MapObject> = {
              position: { ...afterObj.position },
              rotation: afterObj.rotation,
              ...(afterObj.wallPoints ? { wallPoints: afterObj.wallPoints.map(p => ({ ...p })), width: afterObj.width, height: afterObj.height } : {}),
            };
            mobjEntries.push({ id: memberId, before, after });
          } else if (snap.type === 'region') {
            const afterRegion = currentRegions.find(r => r.id === memberId);
            if (!afterRegion) continue;
            const before: Partial<CanvasRegion> = {
              x: snap.x, y: snap.y, width: snap.width, height: snap.height,
              rotation: snap.regRotation,
              ...(snap.pathPoints ? { pathPoints: snap.pathPoints.map(p => ({ ...p })) } : {}),
            };
            const after: Partial<CanvasRegion> = {
              x: afterRegion.x, y: afterRegion.y, width: afterRegion.width, height: afterRegion.height,
              rotation: afterRegion.rotation,
              ...(afterRegion.pathPoints ? { pathPoints: afterRegion.pathPoints.map(p => ({ ...p })) } : {}),
            };
            regionEntries.push({ id: memberId, before, after });
          }
        }

        if (mobjEntries.length > 0 || regionEntries.length > 0) {
          undoRedoManager.push({
            type: 'BATCH_GROUP_ROTATION',
            description: 'Rotate group',
            execute: () => {
              const { updateMapObject: umo } = useMapObjectStore.getState();
              const { updateRegion: ur } = useRegionStore.getState();
              for (const e of mobjEntries) umo(e.id, e.after);
              for (const e of regionEntries) ur(e.id, e.after);
            },
            undo: () => {
              const { updateMapObject: umo } = useMapObjectStore.getState();
              const { updateRegion: ur } = useRegionStore.getState();
              for (const e of mobjEntries) umo(e.id, e.before);
              for (const e of regionEntries) ur(e.id, e.before);
            },
          });
        }

        setIsRotatingMapObject(false);
        setRotatingMapObjectId(null);
        notifyObstaclesChanged();
      }

      // Handle MapObject drag completion
      if (isDraggingMapObject && draggedMapObjectId) {
        // Build batch undo from snapshots captured at drag start vs current store state
        const snapshots = groupSiblingSnapshotsRef.current;
        const currentMapObjects = useMapObjectStore.getState().mapObjects;
        const currentRegions2 = useRegionStore.getState().regions;

        type MobjDragEntry = { id: string; before: Partial<import('@/types/mapObjectTypes').MapObject>; after: Partial<import('@/types/mapObjectTypes').MapObject> };
        type RegDragEntry = { id: string; before: Partial<CanvasRegion>; after: Partial<CanvasRegion> };
        const mobjDragEntries: MobjDragEntry[] = [];
        const regDragEntries: RegDragEntry[] = [];

        for (const [memberId, snap] of Object.entries(snapshots)) {
          if (snap.type === 'mapObject') {
            const afterObj = currentMapObjects.find(o => o.id === memberId);
            if (!afterObj) continue;
            const before: Partial<import('@/types/mapObjectTypes').MapObject> = {
              position: { ...snap.position! },
              ...(snap.wallPoints ? { wallPoints: snap.wallPoints.map(p => ({ ...p })), width: snap.width, height: snap.height } : {}),
            };
            const after: Partial<import('@/types/mapObjectTypes').MapObject> = {
              position: { ...afterObj.position },
              ...(afterObj.wallPoints ? { wallPoints: afterObj.wallPoints.map(p => ({ ...p })), width: afterObj.width, height: afterObj.height } : {}),
            };
            mobjDragEntries.push({ id: memberId, before, after });
          } else if (snap.type === 'region') {
            const afterReg = currentRegions2.find(r => r.id === memberId);
            if (!afterReg) continue;
            const before: Partial<CanvasRegion> = {
              x: snap.x, y: snap.y,
              ...(snap.pathPoints ? { pathPoints: snap.pathPoints.map(p => ({ ...p })) } : {}),
            };
            const after: Partial<CanvasRegion> = {
              x: afterReg.x, y: afterReg.y,
              ...(afterReg.pathPoints ? { pathPoints: afterReg.pathPoints.map(p => ({ ...p })) } : {}),
            };
            regDragEntries.push({ id: memberId, before, after });
          }
        }

        if (mobjDragEntries.length > 0 || regDragEntries.length > 0) {
          undoRedoManager.push({
            type: 'BATCH_GROUP_DRAG',
            description: 'Move map object',
            execute: () => {
              const { updateMapObject: umo } = useMapObjectStore.getState();
              const { updateRegion: ur } = useRegionStore.getState();
              for (const e of mobjDragEntries) umo(e.id, e.after);
              for (const e of regDragEntries) ur(e.id, e.after);
            },
            undo: () => {
              const { updateMapObject: umo } = useMapObjectStore.getState();
              const { updateRegion: ur } = useRegionStore.getState();
              for (const e of mobjDragEntries) umo(e.id, e.before);
              for (const e of regDragEntries) ur(e.id, e.before);
            },
          });
        }

        setIsDraggingMapObject(false);
        setDraggedMapObjectId(null);
        setMapObjectDragOffset({ x: 0, y: 0 });
        
        // Notify visibility system that obstacles have changed
        notifyObstaclesChanged();
        toast.success("Map object moved");
      }

      // Commit map object resize
      if (isResizingMapObject) {
        setIsResizingMapObject(false);
        setMapObjectResizeHandle(null);
        setMapObjectResizeSnapshot(null);
        notifyObstaclesChanged();
        redrawCanvas();
      }

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
      // Build a batch undo entry covering ALL group members (regions + map objects).
      // groupSiblingSnapshotsRef holds the pre-rotation snapshots; current store
      // state is the post-rotation result (already applied during mousemove).
      const snapshots = groupSiblingSnapshotsRef.current;
      const currentRegions = useRegionStore.getState().regions;
      const currentMapObjects = useMapObjectStore.getState().mapObjects;

      type MapObjEntry2 = { id: string; before: Partial<import('@/types/mapObjectTypes').MapObject>; after: Partial<import('@/types/mapObjectTypes').MapObject> };
      const regionEntries2: Array<{ id: string; before: Partial<CanvasRegion>; after: Partial<CanvasRegion> }> = [];
      const mobjEntries2: MapObjEntry2[] = [];

      for (const [memberId, snap] of Object.entries(snapshots)) {
        if (snap.type === 'region') {
          const afterRegion = currentRegions.find(r => r.id === memberId);
          if (!afterRegion) continue;
          const before: Partial<CanvasRegion> = {
            x: snap.x, y: snap.y, width: snap.width, height: snap.height,
            rotation: snap.regRotation,
            ...(snap.pathPoints ? { pathPoints: snap.pathPoints.map(p => ({ ...p })) } : {}),
          };
          const after: Partial<CanvasRegion> = {
            x: afterRegion.x, y: afterRegion.y, width: afterRegion.width, height: afterRegion.height,
            rotation: afterRegion.rotation,
            ...(afterRegion.pathPoints ? { pathPoints: afterRegion.pathPoints.map(p => ({ ...p })) } : {}),
          };
          regionEntries2.push({ id: memberId, before, after });
        } else if (snap.type === 'mapObject') {
          const afterObj = currentMapObjects.find(o => o.id === memberId);
          if (!afterObj) continue;
          const before: Partial<import('@/types/mapObjectTypes').MapObject> = {
            position: { ...snap.position! },
            rotation: snap.rotation,
            ...(snap.wallPoints ? { wallPoints: snap.wallPoints.map(p => ({ ...p })), width: afterObj.width, height: afterObj.height } : {}),
          };
          const after: Partial<import('@/types/mapObjectTypes').MapObject> = {
            position: { ...afterObj.position },
            rotation: afterObj.rotation,
            ...(afterObj.wallPoints ? { wallPoints: afterObj.wallPoints.map(p => ({ ...p })), width: afterObj.width, height: afterObj.height } : {}),
          };
          mobjEntries2.push({ id: memberId, before, after });
        }
      }

      if (regionEntries2.length > 0 || mobjEntries2.length > 0) {
        // State is already applied — push without re-executing so we only need undo/redo
        undoRedoManager.push({
          type: 'BATCH_GROUP_ROTATION',
          description: 'Rotate group',
          execute: () => {
            const { updateRegion } = useRegionStore.getState();
            const { updateMapObject: umo } = useMapObjectStore.getState();
            for (const e of regionEntries2) updateRegion(e.id, e.after);
            for (const e of mobjEntries2) umo(e.id, e.after);
          },
          undo: () => {
            const { updateRegion } = useRegionStore.getState();
            const { updateMapObject: umo } = useMapObjectStore.getState();
            for (const e of regionEntries2) updateRegion(e.id, e.before);
            for (const e of mobjEntries2) umo(e.id, e.before);
          },
        });
        // Null out so the unified undo block below does NOT double-register the primary region
        setInitialRegionState(null);
        setTransformingRegionId(null);
      }

      // Clear rotation state
      setIsRotatingRegion(false);
      setTempRegionRotation({});
      groupFrozenAABBRef.current = null;
    }


    // Unified region transform undo registration
    // Handles move, scale, rotate - all region spatial changes
    // MUST run AFTER all region updates have been applied above.
    // NOTE: Read from store directly (not closure) so we see the just-committed positions.
    if (initialRegionState && transformingRegionId) {
      const liveRegions = useRegionStore.getState().regions;
      const currentRegion = liveRegions.find((r) => r.id === transformingRegionId);
      if (currentRegion) {
        const currentState = captureRegionTransformState(currentRegion);

        if (hasTransformChanged(initialRegionState, currentState)) {
          // Check if there are group siblings that also moved
          const snapshots = groupSiblingSnapshotsRef.current;
          const siblingKeys = Object.keys(snapshots).filter(k => k !== transformingRegionId);
          const hasSiblings = siblingKeys.length > 0;

          if (hasSiblings) {
            // Build a batch command covering the primary region + all group siblings
            const currentMapObjects3 = useMapObjectStore.getState().mapObjects;

            type MobjBatchEntry = { id: string; before: Partial<import('@/types/mapObjectTypes').MapObject>; after: Partial<import('@/types/mapObjectTypes').MapObject> };
            type RegBatchEntry = { id: string; before: Partial<CanvasRegion>; after: Partial<CanvasRegion> };
            const mobjBatch: MobjBatchEntry[] = [];
            const regBatch: RegBatchEntry[] = [];

            // Primary region
            regBatch.push({ id: transformingRegionId, before: initialRegionState, after: currentState });

            // Siblings
            for (const [memberId, snap] of Object.entries(snapshots)) {
              if (memberId === transformingRegionId) continue;
              if (snap.type === 'mapObject') {
                const afterObj = currentMapObjects3.find(o => o.id === memberId);
                if (!afterObj) continue;
                mobjBatch.push({
                  id: memberId,
                  before: {
                    position: { ...snap.position! },
                    ...(snap.wallPoints ? { wallPoints: snap.wallPoints.map(p => ({ ...p })), width: snap.width, height: snap.height } : {}),
                  },
                  after: {
                    position: { ...afterObj.position },
                    ...(afterObj.wallPoints ? { wallPoints: afterObj.wallPoints.map(p => ({ ...p })), width: afterObj.width, height: afterObj.height } : {}),
                  },
                });
              } else if (snap.type === 'region') {
                const afterReg = liveRegions.find(r => r.id === memberId);
                if (!afterReg) continue;
                regBatch.push({
                  id: memberId,
                  before: {
                    x: snap.x, y: snap.y,
                    ...(snap.pathPoints ? { pathPoints: snap.pathPoints.map(p => ({ ...p })) } : {}),
                  },
                  after: {
                    x: afterReg.x, y: afterReg.y,
                    ...(afterReg.pathPoints ? { pathPoints: afterReg.pathPoints.map(p => ({ ...p })) } : {}),
                  },
                });
              }
            }

            undoRedoManager.push({
              type: 'BATCH_GROUP_DRAG',
              description: 'Move group',
              execute: () => {
                const { updateRegion: ur } = useRegionStore.getState();
                const { updateMapObject: umo } = useMapObjectStore.getState();
                for (const e of regBatch) ur(e.id, e.after);
                for (const e of mobjBatch) umo(e.id, e.after);
              },
              undo: () => {
                const { updateRegion: ur } = useRegionStore.getState();
                const { updateMapObject: umo } = useMapObjectStore.getState();
                for (const e of regBatch) ur(e.id, e.before);
                for (const e of mobjBatch) umo(e.id, e.before);
              },
            });
          } else {
            // No group siblings — single region undo as before
            transformRegionUndoable(transformingRegionId, initialRegionState, currentState);
          }
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
      // Invalidate wall decoration cache so phantom walls don't linger after group moves
      wallDecorationCacheRef.current = null;

      // Clear tokens moved by region tracking
      setTokensMovedByRegion([]);
      
      // Clear stable visibility snapshot after drag ends
      if (stableVisibilityRef.current) {
        stableVisibilityRef.current.remove();
        stableVisibilityRef.current = null;
      }

      // Recalculate lighting and fog after regions/groups move or rotate,
      // since walls and vision-blocking geometry have shifted.
      notifyObstaclesChanged();
      tokenVisibilityCacheRef.current.clear();
      clearVisibilityCache();

      // Redraw canvas to clear ghost token and path
      redrawCanvas();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    // ── FOG REVEAL BRUSH: scroll adjusts brush radius ──
    if (fogRevealBrushActive && fogEnabled && isDM && renderingMode === 'play') {
      setFogRevealBrushRadius(prev => {
        const delta = e.deltaY > 0 ? -5 : 5;
        return Math.max(10, Math.min(300, prev + delta));
      });
      redrawCanvas();
      return;
    }

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

  // Touch event handlers using the useTouchEvents hook
  const touchHandlers = useTouchEvents({
    onPanStart: (x, y) => {
      setIsPanning(true);
      setLastPanPoint({ x, y });
    },
    onPanMove: (x, y, deltaX, deltaY) => {
      if (isPanning) {
        setTransform(prev => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
      }
    },
    onPanEnd: () => {
      setIsPanning(false);
    },
    onZoom: (zoomDelta, centerX, centerY) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = centerX - rect.left;
      const mouseY = centerY - rect.top;

      const zoomFactor = zoomDelta > 0 ? 1 + Math.abs(zoomDelta) * 0.5 : 1 / (1 + Math.abs(zoomDelta) * 0.5);
      const newZoom = Math.max(0.1, Math.min(5, transform.zoom * zoomFactor));

      const zoomRatio = newZoom / transform.zoom;
      const newX = mouseX - (mouseX - transform.x) * zoomRatio;
      const newY = mouseY - (mouseY - transform.y) * zoomRatio;

      setTransform({
        x: newX,
        y: newY,
        zoom: newZoom,
      });
    },
    onTap: (x, y, rect) => {
      // Handle tap as a click - mainly for selection/deselection and door toggle
      const mouseX = x - rect.left;
      const mouseY = y - rect.top;
      const worldPos = screenToWorld(mouseX, mouseY);

      // Check for token tap
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      if (clickedToken) {
        if (!selectedTokenIds.includes(clickedToken.id)) {
          setSelectedTokenIds([clickedToken.id]);
        }
        return;
      }

      // Check for map object tap (including doors)
      const clickedMapObject = findMapObjectAtPoint(worldPos.x, worldPos.y, mapObjects, isDM && renderingMode === 'play', transform.zoom);
      if (clickedMapObject) {
        if (renderingMode === "edit") {
          // In edit mode, select the map object
          selectMapObject(clickedMapObject.id, false);
          setSelectedTokenIds([]);
          clearSelection();
          setSelectedRegionIds([]);
        } else if (renderingMode === "play" && isDM && clickedMapObject.category === 'door') {
          // DM can toggle doors in play mode
          const isOpening = !clickedMapObject.isOpen;
          triggerDoorAnimation(clickedMapObject.id, isOpening);
          toggleDoor(clickedMapObject.id);
          toast.success(isOpening ? "Door opened" : "Door closed", { duration: 1500 });
        }
        return;
      }

      // Check for region tap
      const clickedRegion = getRegionAtPosition(worldPos.x, worldPos.y);
      if (clickedRegion) {
        if (!clickedRegion.selected) {
          // Clear other selections and select this one
          selectedRegionIds.forEach(id => deselectRegion(id));
          selectRegion(clickedRegion.id);
          setSelectedRegionIds([clickedRegion.id]);
        }
        return;
      }

      // Tap on empty space - deselect everything
      setSelectedTokenIds([]);
      selectedRegionIds.forEach(id => deselectRegion(id));
      setSelectedRegionIds([]);
      clearMapObjectSelection();
      redrawCanvas();
    },
    onDragStart: (x, y, rect) => {
      const mouseX = x - rect.left;
      const mouseY = y - rect.top;
      const worldPos = screenToWorld(mouseX, mouseY);

      // Check for token
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      if (clickedToken) {
        // Check movement restrictions
        if (restrictMovement) {
          if (isInCombat) {
            const currentEntry = initiativeOrder[currentTurnIndex];
            if (currentEntry?.tokenId !== clickedToken.id) {
              toast.error("Can only move the active token during their turn");
              return false;
            }
          } else {
            toast.error("Token movement is locked. Unlock to move tokens.");
            return false;
          }
        }

        setIsDraggingToken(true);
        setDraggedTokenId(clickedToken.id);
        setDragOffset({
          x: worldPos.x - clickedToken.x,
          y: worldPos.y - clickedToken.y,
        });
        setDragStartPos({ x: clickedToken.x, y: clickedToken.y });
        setDragPath([{ x: clickedToken.x, y: clickedToken.y }]);

        // ── Emit drag begin (touch path) ──
        emitDragBegin({ tokenId: clickedToken.id, startPos: { x: clickedToken.x, y: clickedToken.y }, mode: "freehand" });
        
        if (currentVisibilityRef.current) {
          stableVisibilityRef.current = currentVisibilityRef.current.clone({ insert: false }) as paper.Path;
        }
        
        setInitialTokenState({ id: clickedToken.id, x: clickedToken.x, y: clickedToken.y });

        if (!selectedTokenIds.includes(clickedToken.id)) {
          setSelectedTokenIds([clickedToken.id]);
        }
        return true;
      }

      // Check for region drag (edit mode only)
      if (renderingMode === "edit") {
        const clickedRegion = getRegionAtPosition(worldPos.x, worldPos.y);
        if (clickedRegion && clickedRegion.selected && !clickedRegion.locked) {
          setIsDraggingRegion(true);
          setDraggedRegionId(clickedRegion.id);
          
          if (currentVisibilityRef.current) {
            stableVisibilityRef.current = currentVisibilityRef.current.clone({ insert: false }) as paper.Path;
          }
          
          setInitialRegionState(captureRegionTransformState(clickedRegion));
          setTransformingRegionId(clickedRegion.id);

          setRegionDragOffset({
            x: worldPos.x - clickedRegion.x,
            y: worldPos.y - clickedRegion.y,
          });

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
          return true;
        }
      }

      return false; // Nothing to drag, will pan instead
    },
    onDragMove: (x, y, rect) => {
      const mouseX = x - rect.left;
      const mouseY = y - rect.top;
      const worldPos = screenToWorld(mouseX, mouseY);

      if (isDraggingToken && draggedTokenId) {
        const token = tokens.find(t => t.id === draggedTokenId);
        if (!token) return;

        const newX = worldPos.x - dragOffset.x;
        const newY = worldPos.y - dragOffset.y;

        // Update drag path
        setDragPath(prev => [...prev, { x: newX, y: newY }]);

        // Update token position
        updateTokenPosition(draggedTokenId, newX, newY);
        updateAllTokenHighlights();
        requestAnimationFrame(() => redrawCanvas());
      } else if (isDraggingRegion && draggedRegionId) {
        const region = regions.find(r => r.id === draggedRegionId);
        if (!region) return;

        const newX = worldPos.x - regionDragOffset.x;
        const newY = worldPos.y - regionDragOffset.y;
        const dx = newX - region.x;
        const dy = newY - region.y;

        if (region.regionType === "path" && region.pathPoints) {
          const newPathPoints = region.pathPoints.map(p => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
          const newBezierPoints = region.bezierControlPoints?.map(bp => ({
            cp1: { x: bp.cp1.x + dx, y: bp.cp1.y + dy },
            cp2: { x: bp.cp2.x + dx, y: bp.cp2.y + dy },
          }));
          
          setDragPreview({
            regionId: draggedRegionId,
            pathPoints: newPathPoints,
            bezierControlPoints: newBezierPoints,
            x: newX,
            y: newY,
            width: region.width,
            height: region.height,
          });
        } else {
          setDragPreview({
            regionId: draggedRegionId,
            x: newX,
            y: newY,
            width: region.width,
            height: region.height,
          });
        }

        // Move grouped tokens
        if (groupedTokens.length > 0) {
          const positions: { [id: string]: { x: number; y: number } } = {};
          groupedTokens.forEach(({ tokenId, startX, startY }) => {
            positions[tokenId] = { x: startX + dx, y: startY + dy };
          });
          setTempTokenPositions(positions);
        }

        requestAnimationFrame(() => redrawCanvas());
      }
    },
    onDragEnd: (x, y, rect) => {
      const mouseX = x - rect.left;
      const mouseY = y - rect.top;
      const worldPos = screenToWorld(mouseX, mouseY);

      // Token drag end - reuse existing logic from handleMouseUp
      if (isDraggingToken && draggedTokenId) {
        const token = tokens.find(t => t.id === draggedTokenId);
        if (token) {
          // Check collision using correct store state
          const { enforceMovementBlocking, enforceRegionBounds, renderingMode } = useDungeonStore.getState();
          const shouldEnforceCollisions = renderingMode === 'play';
          
          let movementBlocked = false;
          
          if (shouldEnforceCollisions && (enforceMovementBlocking || enforceRegionBounds)) {
            const tokenRadius = 0;
            const blockingObjects = enforceMovementBlocking ? getBlockingObjects(mapObjects) : [];
            const checkRegions = enforceRegionBounds ? regions : [];
            
            const collisionResult = checkMovementCollision(
              dragStartPos,
              { x: token.x, y: token.y },
              tokenRadius,
              blockingObjects,
              checkRegions,
              { enforceMovementBlocking, enforceRegionBounds }
            );
            
            if (collisionResult.blocked) {
              movementBlocked = true;
              const blockReason = collisionResult.collidedWith === 'region_bounds' 
                ? 'Cannot leave region boundary' 
                : 'Movement blocked by obstacle';
              toast.error(blockReason);
              updateTokenPosition(draggedTokenId, dragStartPos.x, dragStartPos.y);
            }
          }
          
          // Only apply snapping if movement wasn't blocked
          if (!movementBlocked) {
            // Find local region at token position
            const localRegion = regions.find((r) => isPointInRegion(token.x, token.y, r));
            
            // Priority 1: Local region snapping
            if (localRegion && localRegion.gridSnapping && localRegion.gridType !== "free") {
              let regionPoints: Array<{ x: number; y: number }>;
              if (localRegion.regionType === "path" && localRegion.pathPoints) {
                regionPoints = localRegion.pathPoints;
              } else {
                regionPoints = [
                  { x: localRegion.x, y: localRegion.y },
                  { x: localRegion.x + localRegion.width, y: localRegion.y },
                  { x: localRegion.x + localRegion.width, y: localRegion.y + localRegion.height },
                  { x: localRegion.x, y: localRegion.y + localRegion.height },
                ];
              }
              const regionForSnap = {
                map: {} as any,
                region: {
                  gridType: localRegion.gridType,
                  gridSize: localRegion.gridSize * localRegion.gridScale,
                  points: regionPoints,
                } as any,
              };
              const isRectWithRotation = localRegion.regionType !== 'path' && !!localRegion.rotation;
              const rectCenter = isRectWithRotation ? { x: localRegion.x + localRegion.width / 2, y: localRegion.y + localRegion.height / 2 } : undefined;
              const snappedPos = snapToMapGrid(token.x, token.y, regionForSnap, isRectWithRotation ? localRegion.rotation : undefined, rectCenter);
              updateTokenPosition(draggedTokenId, snappedPos.x, snappedPos.y);
            }
            // Priority 2: World space snapping
            else if (isGridSnappingEnabled && !localRegion) {
              const worldGridSize = 40;
              const snappedX = Math.round(token.x / worldGridSize) * worldGridSize;
              const snappedY = Math.round(token.y / worldGridSize) * worldGridSize;
              updateTokenPosition(draggedTokenId, snappedX, snappedY);
            }

            if (initialTokenState && (initialTokenState.x !== token.x || initialTokenState.y !== token.y)) {
              moveTokenUndoable(
                draggedTokenId,
                { x: initialTokenState.x, y: initialTokenState.y },
                { x: token.x, y: token.y },
                token.label || token.name
              );
              // Emit token move to network
              emitLocalOp({ kind: 'token.move', data: { tokenId: draggedTokenId, x: token.x, y: token.y } });
              // ── Emit drag end (touch path) ──
              emitDragEnd({ tokenId: draggedTokenId, finalPos: { x: token.x, y: token.y } });
            }
            
            // Check for portal teleportation after valid movement
            checkPortalTeleport(draggedTokenId);
          }
        }

        setIsDraggingToken(false);
        setDraggedTokenId(null);
        setDragOffset({ x: 0, y: 0 });
        setDragStartPos({ x: 0, y: 0 });
        setDragPath([]);
        setInitialTokenState(null);
        
        if (stableVisibilityRef.current) {
          stableVisibilityRef.current.remove();
          stableVisibilityRef.current = null;
        }

        updateAllTokenHighlights();
      }

      // Region drag end
      if (isDraggingRegion && draggedRegionId) {
        if (dragPreview) {
          const draggedRegion = regions.find(r => r.id === draggedRegionId);
          if (draggedRegion) {
            let finalState: Partial<CanvasRegion>;
            
            if (draggedRegion.regionType === "path" && dragPreview.pathPoints) {
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
                rotation: draggedRegion.rotation,
              };
              
              updateRegion(draggedRegionId, finalState);
            } else {
              finalState = {
                x: dragPreview.x,
                y: dragPreview.y,
                width: dragPreview.width,
                height: dragPreview.height,
                rotation: draggedRegion.rotation,
              };
              
              updateRegion(draggedRegionId, finalState);
            }
          }
        }

        if (tempTokenPositions) {
          Object.entries(tempTokenPositions).forEach(([tokenId, position]) => {
            updateTokenPosition(tokenId, position.x, position.y);
          });
        }

        if (initialRegionState && transformingRegionId) {
          // Read from store directly — closure `regions` is stale after updateRegion above
          const liveRegion = useRegionStore.getState().regions.find(r => r.id === transformingRegionId);
          if (liveRegion) {
            const currentState = captureRegionTransformState(liveRegion);
            if (hasTransformChanged(initialRegionState, currentState)) {
              transformRegionUndoable(transformingRegionId, initialRegionState, currentState);
            }
          }
          setInitialRegionState(null);
          setTransformingRegionId(null);
        }

        setIsDraggingRegion(false);
        setDraggedRegionId(null);
        setRegionDragOffset({ x: 0, y: 0 });
        setDragPreview(null);
        setGroupedTokens([]);
        setTempTokenPositions(undefined);
        
        if (stableVisibilityRef.current) {
          stableVisibilityRef.current.remove();
          stableVisibilityRef.current = null;
        }

        redrawCanvas();
      }
    },
  });

  // Token manipulation functions for FloatingMenu
  const handleTokenColorChange = (tokenId: string, color: string) => {
    updateTokenColor(tokenId, color);
    toast.success("Token color updated");
  };

  const handleCanvasUpdate = () => {
    // Force immediate redraw for illumination/visibility changes
    redrawCanvas();
  };

  // ── Fog Reveal Brush: stamp a circle into exploredArea (reveal or hide mode) ──
  const stampFogBrushCircle = useCallback((worldX: number, worldY: number) => {
    if (!fogEnabled) return;
    const scope = fogScopeRef.current || getFogScope();
    scope.activate();
    const circle = new scope.Path.Circle(new scope.Point(worldX, worldY), fogRevealBrushRadius);

    if (fogBrushMode === 'reveal') {
      // Union: add circle to explored area (remove fog)
      setActiveExploredArea(addVisibleToExplored(getActiveExploredArea(), circle));
    } else {
      // Subtract: remove circle from explored area (add fog back)
      const currentExplored = getActiveExploredArea();
      if (currentExplored && !currentExplored.isEmpty()) {
        const result = currentExplored.subtract(circle, { insert: false });
        if (currentExplored.remove) currentExplored.remove();
        if (result instanceof scope.CompoundPath) {
          setActiveExploredArea(result);
        } else if (result instanceof scope.Path) {
          setActiveExploredArea(new scope.CompoundPath({ children: [result] }));
        }
      }
    }
    circle.remove();
  }, [fogEnabled, fogRevealBrushRadius, fogBrushMode, getActiveExploredArea, setActiveExploredArea]);

   // Poll fog mask refresh while painting — fixed 90ms interval
   const fogBrushPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recompute fog masks from current explored+visible state (used during brush painting)
  const recomputeFogMasksInline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fogScopeRef.current) return;
    fogScopeRef.current.activate();

    const worldBounds = {
      x: -transform.x / transform.zoom - 5000,
      y: -transform.y / transform.zoom - 5000,
      width: canvas.width / transform.zoom + 10000,
      height: canvas.height / transform.zoom + 10000,
    };

    const masks = computeFogMasks(
      getActiveExploredArea(),
      currentVisibilityRef.current,
      worldBounds,
    );
    fogMasksRef.current = masks;
  }, [transform, getActiveExploredArea]);

  useEffect(() => {
    if (isFogBrushPainting) {
      // Fixed 90ms polling interval for fog brush redraws
      fogBrushPollRef.current = setInterval(() => {
        // Recompute masks inline instead of nulling them (which would trigger full-black safety overlay)
        recomputeFogMasksInline();
        redrawCanvas();
      }, 90);
    } else {
      if (fogBrushPollRef.current) {
        clearInterval(fogBrushPollRef.current);
        fogBrushPollRef.current = null;
      }
    }
    return () => {
      if (fogBrushPollRef.current) {
        clearInterval(fogBrushPollRef.current);
        fogBrushPollRef.current = null;
      }
    };
  }, [isFogBrushPainting, fogRevealBrushRadius, recomputeFogMasksInline]);

  const commitFogBrush = useCallback(() => {
    const activeExplored = getActiveExploredArea();
    if (!activeExplored) return;
    const currentMapId = selectedMapId || 'default-map';
    const serialized = serializeFogGeometry(activeExplored);
    if (serialized) {
      fogSerializeSourceRef.current = true;
      setSerializedExploredAreasForMap(currentMapId, serialized);
      ephemeralBus.emit("fog.reveal.preview", {
        shape: "committed",
        points: [],
        serializedExploredAreas: serialized,
        mapId: currentMapId,
      });
    }
    // Recompute masks inline to avoid black flash from null masks
    recomputeFogMasksInline();
    // Broadcast cursor clear
    ephemeralBus.emit("fog.cursor.preview", { pos: { x: 0, y: 0 }, radius: 0, tool: "reveal" });
    redrawCanvas();
  }, [setSerializedExploredAreasForMap, recomputeFogMasksInline, getActiveExploredArea, selectedMapId]);

  // Mark selected regions as explored (DM fog reveal)
  const handleMarkRegionsExplored = useCallback((regionIds: string[]) => {
    if (!fogEnabled) {
      toast.error('Fog of war must be enabled to reveal regions');
      return;
    }
    const scope = fogScopeRef.current || getFogScope();
    scope.activate();

    const targetRegions = regions.filter(r => regionIds.includes(r.id));
    if (targetRegions.length === 0) return;

    let updated = getActiveExploredArea();

    for (const region of targetRegions) {
      let regionPath: paper.Path;

      if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length >= 3) {
        // Free-form polygon region
        regionPath = new scope.Path();
        region.pathPoints.forEach(pt => {
          regionPath.add(new scope.Point(region.x + pt.x, region.y + pt.y));
        });
        regionPath.closed = true;
      } else {
        // Rectangle region (apply rotation if present)
        const cx = region.x + region.width / 2;
        const cy = region.y + region.height / 2;
        regionPath = new scope.Path.Rectangle({
          point: [region.x, region.y],
          size: [region.width, region.height],
        });
        if (region.rotation) {
          regionPath.rotate(region.rotation, new scope.Point(cx, cy));
        }
      }

      updated = addVisibleToExplored(updated, regionPath);
      regionPath.remove();
    }

    setActiveExploredArea(updated);

    // Serialize for persistence
    const currentMapId = selectedMapId || 'default-map';
    const serialized = serializeFogGeometry(updated);
    if (serialized) {
      fogSerializeSourceRef.current = true;
      setSerializedExploredAreasForMap(currentMapId, serialized);
      // Broadcast to connected players so they redraw with the revealed area
      ephemeralBus.emit("fog.reveal.preview", {
        shape: "committed",
        points: [],
        serializedExploredAreas: serialized,
        mapId: currentMapId,
      });
    }

    toast.success(`Revealed ${targetRegions.length} region(s) through fog`);
    redrawCanvas();
  }, [fogEnabled, regions, setSerializedExploredAreasForMap, getActiveExploredArea, setActiveExploredArea, selectedMapId]);

  // Unmark selected regions as explored (DM fog unreveal — subtract from explored polygon)
  const handleUnmarkRegionsExplored = useCallback((regionIds: string[]) => {
    if (!fogEnabled) {
      toast.error('Fog of war must be enabled to unreveal regions');
      return;
    }
    if (!getActiveExploredArea()) {
      toast.error('No explored area to subtract from');
      return;
    }
    const scope = fogScopeRef.current || getFogScope();
    scope.activate();

    const targetRegions = regions.filter(r => regionIds.includes(r.id));
    if (targetRegions.length === 0) return;

    let updated: paper.PathItem | null = getActiveExploredArea();

    for (const region of targetRegions) {
      if (!updated) break;

      let regionPath: paper.Path;

      if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length >= 3) {
        regionPath = new scope.Path();
        region.pathPoints.forEach(pt => {
          regionPath.add(new scope.Point(region.x + pt.x, region.y + pt.y));
        });
        regionPath.closed = true;
      } else {
        const cx = region.x + region.width / 2;
        const cy = region.y + region.height / 2;
        regionPath = new scope.Path.Rectangle({
          point: [region.x, region.y],
          size: [region.width, region.height],
        });
        if (region.rotation) {
          regionPath.rotate(region.rotation, new scope.Point(cx, cy));
        }
      }

      const subtracted = updated.subtract(regionPath);
      updated.remove();
      regionPath.remove();
      // If the result is empty, set to null
      updated = subtracted.bounds.width > 0 && subtracted.bounds.height > 0 ? subtracted : null;
    }

    setActiveExploredArea(updated as paper.CompoundPath | null);

    const currentMapId = selectedMapId || 'default-map';
    const serialized = updated ? serializeFogGeometry(updated as paper.CompoundPath) : '';
    fogSerializeSourceRef.current = true;
    setSerializedExploredAreasForMap(currentMapId, serialized);
    ephemeralBus.emit("fog.reveal.preview", {
      shape: "committed",
      points: [],
      serializedExploredAreas: serialized,
      mapId: currentMapId,
    });

    toast.success(`Unrevealed ${targetRegions.length} region(s)`);
    redrawCanvas();
  }, [fogEnabled, regions, setSerializedExploredAreasForMap, getActiveExploredArea, setActiveExploredArea, selectedMapId]);

  const addTokenToCanvas = async (
    imageUrl: string,
    x?: number,
    y?: number,
    gridWidth: number = 1,
    gridHeight: number = 1,
    color?: string,
  ) => {
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    ephemeralBus.emit("presence.activity", { activity: "placing token" });

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
      const isRectWithRotation = localRegion.regionType !== 'path' && !!localRegion.rotation;
      const rectCenter = isRectWithRotation ? { x: localRegion.x + localRegion.width / 2, y: localRegion.y + localRegion.height / 2 } : undefined;
      const snappedPos = snapToMapGrid(tokenX, tokenY, regionForSnap, isRectWithRotation ? localRegion.rotation : undefined, rectCenter);
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

      {/* Floor Navigation Widget */}
      <FloorNavigationWidget />

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
        fogRevealBrushActive={fogRevealBrushActive}
        onToggleFogRevealBrush={() => {
          setFogRevealBrushActive(prev => {
            const next = !prev;
            if (next) {
              // Clear all selections to prevent selection flashing during brush use
              setSelectedTokenIds([]);
              selectedRegionIds.forEach(id => deselectRegion(id));
              setSelectedRegionIds([]);
              clearMapObjectSelection();
              clearLightSelection();
              // Seed reticle position from last known mouse pos
              if (lastMousePosRef.current) {
                fogBrushCursorRef.current = screenToWorld(lastMousePosRef.current.x, lastMousePosRef.current.y);
              }
              requestAnimationFrame(() => redrawCanvas());
            }
            return next;
          });
        }}
        isDM={isDM}
      />

      {/* Per-Region Snap Button (shows when region is selected) - REMOVED */}

      {/* Region Control Panel - removed, now using Region Controls Card */}

      {/* Main Canvas Container — outer div clips UI; inner div allows PixiJS canvas to overhang via negative CSS offset */}
      <div className="flex-1 relative overflow-hidden" style={{ isolation: 'isolate' }}>
      <div ref={canvasContainerRef} className="absolute inset-0 overflow-visible">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{
            background: "hsl(var(--canvas-background))",
            cursor: isPanning
              ? "grabbing"
              : fogRevealBrushActive && fogEnabled && isDM && renderingMode === 'play'
                ? "crosshair"
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
          onTouchStart={touchHandlers.handleTouchStart}
          onTouchMove={touchHandlers.handleTouchMove}
          onTouchEnd={touchHandlers.handleTouchEnd}
          onTouchCancel={touchHandlers.handleTouchCancel}
        />
        {/* Overlay canvas for UI elements above fog post-processing */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: Z_INDEX.CANVAS_ELEMENTS.CANVAS_UI_OVERLAY }}
        />
        {/* Remote cursor overlay */}
        <CursorOverlay transform={transform} />
        {/* DOM marquee — rendered above fog (z-index above FOG_POST_PROCESSING).
            Position/size is driven directly via ref to avoid React re-renders and flicker. */}
        <div
          ref={marqueeDivRef}
          className="absolute pointer-events-none"
          style={{
            display: 'none',
            zIndex: Z_INDEX.CANVAS_ELEMENTS.CANVAS_UI_OVERLAY + 10,
            border: `2px dashed ${renderingMode === 'play' ? '#10b981' : '#4f46e5'}`,
            backgroundColor: renderingMode === 'play' ? 'rgba(16,185,129,0.10)' : 'rgba(79,70,229,0.12)',
            boxSizing: 'border-box',
          }}
        />
      </div>
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
      <InitiativePanel selectedTokenIds={selectedTokenIds} />

      {/* Unified Selection Toolbar - Shows when 2+ entities or a group is selected */}
      <UnifiedSelectionToolbar
        selectedTokenIds={selectedTokenIds}
        selectedRegionIds={selectedRegionIds}
        selectedMapObjectIds={selectedMapObjectIds}
        selectedLightIds={selectedLightIds}
        onClearAll={() => {
          setSelectedTokenIds([]);
          selectedRegionIds.forEach(id => deselectRegion(id));
          setSelectedRegionIds([]);
          clearMapObjectSelection();
          clearLightSelection();
          redrawCanvas();
        }}
      />

      {/* Type-specific toolbars - always rendered alongside unified bar */}
      <>
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
            regions.forEach(region => selectRegion(region.id));
            setSelectedRegionIds(regions.map(r => r.id));
            redrawCanvas();
          }}
          isDM={isDM}
          onMarkExplored={handleMarkRegionsExplored}
          onUnmarkExplored={handleUnmarkRegionsExplored}
        />

        {/* Map Object Control Bar - Shows when map object(s) are selected */}
        <MapObjectControlBar
          pointEditMode={wallPointEditMode}
          onTogglePointEditMode={() => {
            setWallPointEditMode(prev => !prev);
            setMapObjectTool('points');
          }}
          mapObjectTool={mapObjectTool}
          onSetMapObjectTool={setMapObjectTool}
          onUpdateCanvas={handleCanvasUpdate}
        />
      </>


      {/* Fog Brush Toolbar - Shows when fog brush is active */}
      {fogRevealBrushActive && fogEnabled && isDM && renderingMode === 'play' && (
        <FogBrushToolbar
          brushRadius={fogRevealBrushRadius}
          onRadiusChange={setFogRevealBrushRadius}
          brushMode={fogBrushMode}
          onBrushModeChange={setFogBrushMode}
          onClose={() => setFogRevealBrushActive(false)}
        />
      )}

      {/* Movement Lock Indicator - Shows when token movement is locked */}
      <MovementLockIndicator />

      {/* DM Cursor Sharing Toggle — only visible to DMs */}
      {isDM && (
        <div
          className="absolute bottom-4 left-28 select-none"
          style={{ zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS }}
        >
          <Button
            variant={useCursorStore.getState().cursorSharingEnabled ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              const next = !useCursorStore.getState().cursorSharingEnabled;
              useCursorStore.getState().setCursorSharingEnabled(next);
              ephemeralBus.emit("cursor.visibility", { visible: next });
              toast.success(next ? "Cursor sharing enabled" : "Cursor sharing disabled");
            }}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            Cursors
          </Button>
        </div>
      )}

      {/* Version Indicator - Bottom Left */}
      <div
        className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-muted-foreground shadow-sm select-none pointer-events-none"
        style={{ zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS }}
      >
        v{APP_VERSION}
      </div>

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
          const annotation = mapObjects.find((a) => a.id === selectedAnnotationId && a.category === 'annotation');
          if (!annotation || !annotation.annotationText) return null;

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
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {annotation.annotationReference ?? annotation.label}
                  </div>
                  <span className="text-sm font-semibold">Marker {annotation.annotationReference ?? annotation.label}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setSelectedAnnotationId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{annotation.annotationText}</p>
            </div>
          );
        })()}

      {/* MapObject Context Menu */}
      {mapObjectContextMenu && (
        <MapObjectContextMenuWrapper
          mapObjectId={mapObjectContextMenu.mapObjectId}
          position={{ x: mapObjectContextMenu.x, y: mapObjectContextMenu.y }}
          onClose={() => setMapObjectContextMenu(null)}
          onUpdateCanvas={() => {
            redrawCanvas();
            setMapObjectContextMenu(null);
          }}
        />
      )}

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

      {/* Portal Teleport DM Confirmation Dialog */}
      <AlertDialog open={!!pendingTeleport} onOpenChange={(open) => { if (!open) setPendingTeleport(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Teleportation</AlertDialogTitle>
            <AlertDialogDescription>
              Teleport <strong>{pendingTeleport?.tokenName}</strong> from{' '}
              <strong>{pendingTeleport?.sourcePortalName}</strong> to{' '}
              <strong>{pendingTeleport?.targetPortalName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTeleport(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingTeleport) {
                executeTeleport(pendingTeleport.tokenId, pendingTeleport.sourcePortalId, pendingTeleport.targetPortalId, pendingTeleport.dropPosition);
                setPendingTeleport(null);
              }
            }}>Teleport</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SimpleTabletop;
