import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createGridRenderer, renderGrid, GridType } from '../lib/gridSystem';
import { renderMapGrids } from '../lib/mapGridSystem';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { snapToMapGrid } from '../lib/mapGridSystem';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Settings, Plus, Map } from 'lucide-react';

interface SimpleTabletopProps {
  onOpenTokenPanel: () => void;
  onOpenMapControls: () => void;
  onOpenBackgroundGrid: () => void;
  onOpenGridControls: () => void;
  onOpenVisibilityModal: () => void;
  onOpenLayerStack: () => void;
}

export const SimpleTabletop: React.FC<SimpleTabletopProps> = ({
  onOpenTokenPanel,
  onOpenMapControls,
  onOpenBackgroundGrid,
  onOpenGridControls,
  onOpenVisibilityModal,
  onOpenLayerStack,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [isDraggingToken, setIsDraggingToken] = useState(false);
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragPath, setDragPath] = useState<{ x: number, y: number }[]>([]);
  
  // Region state
  interface Region {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    selected: boolean;
    color: string;
    gridType: 'square' | 'hex' | 'default';
    gridSize: number;
  }
  
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isDraggingRegion, setIsDraggingRegion] = useState(false);
  const [draggedRegionId, setDraggedRegionId] = useState<string | null>(null);
  const [regionDragOffset, setRegionDragOffset] = useState({ x: 0, y: 0 });
  const [isResizingRegion, setIsResizingRegion] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

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

  const [transform, setTransform] = useState({
    x: 400,
    y: 300,
    zoom: 1
  });

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Grid settings
  const [gridType, setGridType] = useState<GridType>('square');
  const [gridSize, setGridSize] = useState(40);
  const [gridVisible, setGridVisible] = useState(true);

  // Get the clicked region
  const getClickedRegion = (worldX: number, worldY: number): Region | null => {
    // Check from top to bottom (reverse order for proper layering)
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      if (worldX >= region.x && worldX <= region.x + region.width &&
          worldY >= region.y && worldY <= region.y + region.height) {
        return region;
      }
    }
    return null;
  };

  // Get resize handle at position for a region
  const getResizeHandle = (region: Region, worldX: number, worldY: number): string | null => {
    const handleSize = 12 / transform.zoom;
    const { x, y, width, height } = region;
    
    // Check corner handles
    if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - y) <= handleSize) return 'nw';
    if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - y) <= handleSize) return 'ne';
    if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return 'sw';
    if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return 'se';
    
    // Check edge handles
    if (Math.abs(worldX - (x + width/2)) <= handleSize && Math.abs(worldY - y) <= handleSize) return 'n';
    if (Math.abs(worldX - (x + width/2)) <= handleSize && Math.abs(worldY - (y + height)) <= handleSize) return 's';
    if (Math.abs(worldX - x) <= handleSize && Math.abs(worldY - (y + height/2)) <= handleSize) return 'w';
    if (Math.abs(worldX - (x + width)) <= handleSize && Math.abs(worldY - (y + height/2)) <= handleSize) return 'e';
    
    return null;
  };

  // Get the clicked token
  const getClickedToken = (worldX: number, worldY: number) => {
    const tokenSize = 40;
    return tokens.find(token => {
      const dx = worldX - token.x;
      const dy = worldY - token.y;
      return Math.sqrt(dx * dx + dy * dy) <= tokenSize / 2;
    });
  };

  // Function to redraw canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context for transformations
    ctx.save();

    // Apply pan and zoom transformations
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.zoom, transform.zoom);

    // Draw grid if visible
    if (gridVisible) {
      const renderer = createGridRenderer(canvas);
      if (renderer) {
        const viewport = {
          x: -transform.x / transform.zoom,
          y: -transform.y / transform.zoom,
          zoom: transform.zoom,
          width: canvas.width / transform.zoom,
          height: canvas.height / transform.zoom
        };

        // Render main grid
        renderGrid(renderer, gridType, gridSize, viewport, gridVisible);
        
        // Render map-based grids
        const visibleMaps = getVisibleMaps();
        renderMapGrids(renderer, visibleMaps, viewport);
      }
    }

    // Restore context for UI elements that should not be transformed
    ctx.restore();

    // Apply transformation again for game objects
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.zoom, transform.zoom);

    // Draw regions
    drawRegions(ctx);

    // Draw tokens
    tokens.forEach(token => {
      drawToken(ctx, token);
    });

    // Draw drag ghost and path
    drawDragGhostAndPath(ctx);

    // Restore context
    ctx.restore();

    // Draw off-screen indicators (in screen space)
    const viewX = -transform.x / transform.zoom;
    const viewY = -transform.y / transform.zoom;
    const viewWidth = canvas.width / transform.zoom;
    const viewHeight = canvas.height / transform.zoom;

    const offScreenTokens = tokens.filter(token => 
      token.x < viewX || token.x > viewX + viewWidth ||
      token.y < viewY || token.y > viewY + viewHeight
    );

    offScreenTokens.forEach(token => {
      drawOffScreenIndicator(ctx, token, viewX, viewY, viewWidth, viewHeight);
    });
  }, [transform, tokens, regions, selectedTokenIds, draggedTokenId, dragPath, gridType, gridSize, gridVisible, isDraggingToken, getVisibleMaps]);

  // Function to draw drag ghost and path
  const drawDragGhostAndPath = (ctx: CanvasRenderingContext2D) => {
    if (!draggedTokenId) return;
    
    const draggedToken = tokens.find(t => t.id === draggedTokenId);
    if (!draggedToken) return;
    
    // Draw ghost token at original position
    ctx.save();
    ctx.globalAlpha = 0.3;
    
    // Draw original position with dashed circle
    ctx.strokeStyle = draggedToken.color || '#ffffff';
    ctx.lineWidth = 3 / transform.zoom;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(dragStartPos.x, dragStartPos.y, 20, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw movement path if it exists
    if (dragPath.length > 1) {
      drawDragPath(ctx, draggedToken);
    }
    
    ctx.restore();
  };

  // Function to draw drag path
  const drawDragPath = (ctx: CanvasRenderingContext2D, token: any) => {
    // For free movement: draw straight line from start to current position
    // TODO: For grid movement, this will use grid-based pathfinding algorithms
    
    const gridSize = 40; // Grid unit size in pixels
    
    ctx.save();
    ctx.strokeStyle = token.color || '#ffffff';
    ctx.lineWidth = 2 / transform.zoom;
    ctx.globalAlpha = 0.8;
    
    if (dragPath.length > 1) {
      // Draw path line
      ctx.beginPath();
      ctx.moveTo(dragPath[0].x, dragPath[0].y);
      
      for (let i = 1; i < dragPath.length; i++) {
        ctx.lineTo(dragPath[i].x, dragPath[i].y);
      }
      
      ctx.stroke();
      
      // Calculate path distance
      let pathDistance = 0;
      for (let i = 1; i < dragPath.length; i++) {
        const dx = dragPath[i].x - dragPath[i-1].x;
        const dy = dragPath[i].y - dragPath[i-1].y;
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
      
      // Draw distance label at current position
      const currentPos = dragPath[dragPath.length - 1];
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1 / transform.zoom;
      ctx.font = `${12 / transform.zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      const text = `${pathDistanceGridUnits} units`;
      ctx.strokeText(text, currentPos.x, currentPos.y - 25 / transform.zoom);
      ctx.fillText(text, currentPos.x, currentPos.y - 25 / transform.zoom);
    }
    
    ctx.restore();
  };

  // Function to draw regions
  const drawRegions = (ctx: CanvasRenderingContext2D) => {
    regions.forEach(region => {
      // Draw region boundary
      ctx.strokeStyle = region.selected ? '#22c55e' : '#4f46e5';
      ctx.lineWidth = (region.selected ? 3 : 2) / transform.zoom;
      ctx.strokeRect(region.x, region.y, region.width, region.height);
      
      // Draw region handles if selected
      if (region.selected) {
        drawRegionHandles(ctx, region);
      }
      
      // Draw region label
      ctx.fillStyle = '#4f46e5';
      ctx.font = `${14 / transform.zoom}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${region.gridType} (${region.gridSize}px)`, region.x + 5, region.y - 20 / transform.zoom);
    });
  };

  // Function to draw region resize handles
  const drawRegionHandles = (ctx: CanvasRenderingContext2D, region: Region) => {
    const handleSize = 12 / transform.zoom;
    const { x, y, width, height } = region;
    
    ctx.fillStyle = '#4f46e5';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / transform.zoom;
    
    // Corner handles
    const handles = [
      { x: x, y: y }, // top-left
      { x: x + width, y: y }, // top-right
      { x: x, y: y + height }, // bottom-left
      { x: x + width, y: y + height }, // bottom-right
      { x: x + width/2, y: y }, // top-center
      { x: x + width/2, y: y + height }, // bottom-center
      { x: x, y: y + height/2 }, // left-center
      { x: x + width, y: y + height/2 }, // right-center
    ];
    
    handles.forEach(handle => {
      ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
    });
  };

  const addNewRegion = (x: number, y: number, width: number = 200, height: number = 200) => {
    const newRegion: Region = {
      id: `region_${Date.now()}`,
      x,
      y,
      width,
      height,
      selected: false,
      color: '#4f46e5',
      gridType: 'default',
      gridSize: 40  // Match main canvas grid size
    };
    
    setRegions(prev => [...prev, newRegion]);
    toast.success('Region added');
  };
  const drawToken = (ctx: CanvasRenderingContext2D, token: any) => {
    const tokenSize = 40;
    const isSelected = selectedTokenIds.includes(token.id);
    
    // Draw selection highlight
    if (isSelected) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(token.x, token.y, (tokenSize / 2) + 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Draw token circle background
    ctx.fillStyle = token.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(token.x, token.y, tokenSize / 2, 0, 2 * Math.PI);
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

    // Calculate the direction from viewport center to token
    const viewCenterX = viewX + viewWidth / 2;
    const viewCenterY = viewY + viewHeight / 2;
    const dx = token.x - viewCenterX;
    const dy = token.y - viewCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return;
    
    // Normalize direction
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Find intersection with viewport edge
    const margin = 20; // Distance from edge
    let edgeX, edgeY;
    
    // Calculate intersection with viewport rectangle
    const t1 = (viewX + margin - viewCenterX) / dirX;
    const t2 = (viewX + viewWidth - margin - viewCenterX) / dirX;
    const t3 = (viewY + margin - viewCenterY) / dirY;
    const t4 = (viewY + viewHeight - margin - viewCenterY) / dirY;
    
    const validTs = [t1, t2, t3, t4].filter(t => t > 0);
    const minT = Math.min(...validTs);
    
    edgeX = viewCenterX + dirX * minT;
    edgeY = viewCenterY + dirY * minT;
    
    // Convert to screen coordinates
    const screenPos = worldToScreen(edgeX, edgeY);
    
    // Draw indicator
    ctx.save();
    ctx.fillStyle = token.color || '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    // Draw arrow pointing towards the token
    const arrowSize = 8;
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(Math.atan2(dy, dx));
    
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize, -arrowSize);
    ctx.lineTo(-arrowSize/2, 0);
    ctx.lineTo(-arrowSize, arrowSize);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
  };

  // Handle region updates
  const updateRegion = (id: string, updates: Partial<Region>) => {
    setRegions(prev => prev.map(region => 
      region.id === id ? { ...region, ...updates } : region
    ));
  };

  const selectRegion = (id: string | null) => {
    setRegions(prev => prev.map(region => ({
      ...region,
      selected: region.id === id
    })));
    setSelectedRegionId(id);
  };

  // Right-click context menu for regions
  const showRegionContextMenu = (e: React.MouseEvent, region: Region) => {
    e.preventDefault();
    
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'fixed bg-background border border-border rounded-md shadow-lg z-50 py-2';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    
    const setRegionGridType = (regionId: string, gridType: 'square' | 'hex' | 'default') => {
      setRegions(prev => prev.map(region => 
        region.id === regionId ? { ...region, gridType } : region
      ));
      toast.success(`Grid type set to ${gridType}`);
    };

    const deleteRegion = (regionId: string) => {
      setRegions(prev => prev.filter(region => region.id !== regionId));
      toast.success('Region deleted');
    };
    
    const menuItems = [
      { 
        label: 'Default Grid', 
        icon: '📐', 
        action: () => setRegionGridType(region.id, 'default'),
        active: region.gridType === 'default'
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
        action: () => deleteRegion(region.id), 
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
        document.body.removeChild(menu);
      };
      menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // Remove menu when clicking outside
    const removeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        document.body.removeChild(menu);
        document.removeEventListener('click', removeMenu);
      }
    };
    
    setTimeout(() => document.addEventListener('click', removeMenu), 0);
  };

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };

    // Initial size
    resizeCanvas();

    // Listen for resize events
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [redrawCanvas]);

  // Redraw when dependencies change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y);

    if (e.button === 2) { // Right click
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setLastPanPoint({ x: transform.x, y: transform.y });
    } else if (e.button === 0) { // Left click
      // Check for region interactions first
      const clickedRegion = getClickedRegion(worldPos.x, worldPos.y);
      
      if (clickedRegion) {
        // Check for resize handles
        if (clickedRegion.selected) {
          const handle = getResizeHandle(clickedRegion, worldPos.x, worldPos.y);
          if (handle) {
            setIsResizingRegion(true);
            setResizeHandle(handle);
            setDraggedRegionId(clickedRegion.id);
            return;
          }
        }
        
        // Select region and potentially start dragging
        selectRegion(clickedRegion.id);
        setIsDraggingRegion(true);
        setDraggedRegionId(clickedRegion.id);
        setRegionDragOffset({
          x: worldPos.x - clickedRegion.x,
          y: worldPos.y - clickedRegion.y
        });
        return;
      } else {
        // Deselect regions if clicking empty space
        selectRegion(null);
      }

      // Check for token interactions
      const clickedToken = getClickedToken(worldPos.x, worldPos.y);
      
      if (clickedToken) {
        // Token interaction
        if (e.ctrlKey || e.metaKey) {
          // Multi-select
          setSelectedTokenIds(prev => 
            prev.includes(clickedToken.id) 
              ? prev.filter(id => id !== clickedToken.id)
              : [...prev, clickedToken.id]
          );
        } else {
          // Single select and drag
          setSelectedTokenIds([clickedToken.id]);
          setIsDraggingToken(true);
          setDraggedTokenId(clickedToken.id);
          setDragOffset({
            x: worldPos.x - clickedToken.x,
            y: worldPos.y - clickedToken.y
          });
          setDragStartPos({ x: clickedToken.x, y: clickedToken.y });
          setDragPath([{ x: clickedToken.x, y: clickedToken.y }]);

          // Dispatch custom event for token context menu
          window.dispatchEvent(new CustomEvent('showTokenContextMenu', {
            detail: {
              tokenId: clickedToken.id,
              x: e.clientX,
              y: e.clientY
            }
          }));
        }
      } else {
        // Empty space click - deselect all
        setSelectedTokenIds([]);
        
        // Add region if holding Shift
        if (e.shiftKey) {
          addNewRegion(worldPos.x, worldPos.y);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setTransform(prev => ({
        ...prev,
        x: lastPanPoint.x + deltaX,
        y: lastPanPoint.y + deltaY
      }));
    } else if (isDraggingToken && draggedTokenId) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const worldPos = screenToWorld(x, y);
      
      const newX = worldPos.x - dragOffset.x;
      const newY = worldPos.y - dragOffset.y;
      
      updateTokenPosition(draggedTokenId, newX, newY);
      setDragPath(prev => [...prev, { x: newX, y: newY }]);
    } else if (isDraggingRegion && draggedRegionId) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const worldPos = screenToWorld(x, y);
      
      const newX = worldPos.x - regionDragOffset.x;
      const newY = worldPos.y - regionDragOffset.y;
      
      updateRegion(draggedRegionId, { x: newX, y: newY });
    } else if (isResizingRegion && draggedRegionId && resizeHandle) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const worldPos = screenToWorld(x, y);
      
      const region = regions.find(r => r.id === draggedRegionId);
      if (!region) return;
      
      let newX = region.x;
      let newY = region.y;
      let newWidth = region.width;
      let newHeight = region.height;
      
      const minSize = 50;
      
      switch (resizeHandle) {
        case 'nw':
          newWidth = Math.max(minSize, region.x + region.width - worldPos.x);
          newHeight = Math.max(minSize, region.y + region.height - worldPos.y);
          newX = region.x + region.width - newWidth;
          newY = region.y + region.height - newHeight;
          break;
        case 'ne':
          newWidth = Math.max(minSize, worldPos.x - region.x);
          newHeight = Math.max(minSize, region.y + region.height - worldPos.y);
          newY = region.y + region.height - newHeight;
          break;
        case 'sw':
          newWidth = Math.max(minSize, region.x + region.width - worldPos.x);
          newHeight = Math.max(minSize, worldPos.y - region.y);
          newX = region.x + region.width - newWidth;
          break;
        case 'se':
          newWidth = Math.max(minSize, worldPos.x - region.x);
          newHeight = Math.max(minSize, worldPos.y - region.y);
          break;
        case 'n':
          newHeight = Math.max(minSize, region.y + region.height - worldPos.y);
          newY = region.y + region.height - newHeight;
          break;
        case 's':
          newHeight = Math.max(minSize, worldPos.y - region.y);
          break;
        case 'w':
          newWidth = Math.max(minSize, region.x + region.width - worldPos.x);
          newX = region.x + region.width - newWidth;
          break;
        case 'e':
          newWidth = Math.max(minSize, worldPos.x - region.x);
          break;
      }
      
      updateRegion(draggedRegionId, { 
        x: newX, 
        y: newY, 
        width: newWidth, 
        height: newHeight 
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) { // Right click
      setIsPanning(false);
    } else if (e.button === 0) { // Left click
      // Handle token snapping on drag end
      if (isDraggingToken && draggedTokenId) {
        const token = tokens.find(t => t.id === draggedTokenId);
        if (token) {
          // Find the active region at token position
          const activeRegion = getActiveRegionAt(token.x, token.y);
          
          // Apply grid snapping if token is in a region with grid
          if (activeRegion && activeRegion.region.gridType !== 'none') {
            const snappedPos = snapToMapGrid(token.x, token.y, activeRegion);
            updateTokenPosition(draggedTokenId, snappedPos.x, snappedPos.y);
          }
        }
      }
      
      setIsDraggingToken(false);
      setDraggedTokenId(null);
      setDragOffset({ x: 0, y: 0 });
      setDragStartPos({ x: 0, y: 0 });
      setDragPath([]);
      
      setIsDraggingRegion(false);
      setDraggedRegionId(null);
      setRegionDragOffset({ x: 0, y: 0 });
      
      setIsResizingRegion(false);
      setResizeHandle(null);
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
    const worldPosBeforeZoom = screenToWorld(mouseX, mouseY);
    
    setTransform(prev => {
      const newTransform = { ...prev, zoom: newZoom };
      const worldPosAfterZoom = {
        x: (mouseX - newTransform.x) / newZoom,
        y: (mouseY - newTransform.y) / newZoom
      };
      
      return {
        ...newTransform,
        x: newTransform.x + (worldPosAfterZoom.x - worldPosBeforeZoom.x) * newZoom,
        y: newTransform.y + (worldPosAfterZoom.y - worldPosBeforeZoom.y) * newZoom
      };
    });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y);

    // Check if right-clicking on a region
    const clickedRegion = getClickedRegion(worldPos.x, worldPos.y);
    if (clickedRegion) {
      showRegionContextMenu(e, clickedRegion);
      return;
    }
  };

  const addTokenToCanvas = async (imageUrl: string, x?: number, y?: number) => {
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use provided coordinates or default to center of viewport
    let tokenX = x ?? (-transform.x / transform.zoom);
    let tokenY = y ?? (-transform.y / transform.zoom);
    
    // Apply grid snapping for new tokens
    const activeRegion = getActiveRegionAt(tokenX, tokenY);
    if (activeRegion && activeRegion.region.gridType !== 'none') {
      const snappedPos = snapToMapGrid(tokenX, tokenY, activeRegion);
      tokenX = snappedPos.x;
      tokenY = snappedPos.y;
    }
    
    // Generate a random color for the token
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    try {
      // Add to store
      addToken({
        id: tokenId,
        imageUrl,
        x: tokenX,
        y: tokenY,
        name: `Token ${tokenId.slice(-8)}`,
        gridWidth: 1,
        gridHeight: 1,
        label: `T${tokenId.slice(-4)}`,
        ownerId: currentPlayerId,
        color: randomColor
      });

      toast.success('Token added to map');
    } catch (error) {
      console.error('Failed to add token:', error);
      toast.error('Failed to add token');
    }
  };

  const handleTokenColorChange = (tokenId: string, color: string) => {
    updateTokenColor(tokenId, color);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGridVisible(!gridVisible)}
            className={gridVisible ? 'bg-accent' : ''}
          >
            {gridVisible ? '🔲' : '⬜'} Grid
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGridType(gridType === 'square' ? 'hex' : 'square')}
          >
            {gridType === 'square' ? '⬜' : '⬢'} {gridType}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenGridControls()}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Zoom: {Math.round(transform.zoom * 100)}% | Shift+Click: Add Region | Right-click: Pan
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ 
            background: 'hsl(var(--surface))',
            cursor: isPanning ? 'grabbing' : isDraggingToken ? 'move' : 'default'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
        />
      </div>

      {/* Floating Menu - Simplified without Fabric.js dependencies */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => addTokenToCanvas('/placeholder.svg', -transform.x / transform.zoom, -transform.y / transform.zoom)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Token
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenMapControls}
        >
          <Map className="h-4 w-4 mr-2" />
          Maps
        </Button>
      </div>
    </div>
  );
};

export default SimpleTabletop;