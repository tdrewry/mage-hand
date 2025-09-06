import React, { useEffect, useRef, useState } from 'react';
import { Toolbar } from './Toolbar';
import { MapManager } from './MapManager';
import { FloatingMenu } from './FloatingMenu';
import { TokenContextManager } from './TokenContextManager';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';

export const SimpleTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showMapManager, setShowMapManager] = useState(false);
  
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
  
  // Region state
  interface Region {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    selected: boolean;
    color: string;
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

  const { maps, getVisibleMaps } = useMapStore();

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
    const tokenSize = 20; // Half of token diameter (40)
    
    // Check tokens in reverse order (top to bottom)
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];
      const distance = Math.sqrt(
        Math.pow(worldX - token.x, 2) + Math.pow(worldY - token.y, 2)
      );
      
      if (distance <= tokenSize) {
        return token;
      }
    }
    
    return null;
  };

  // Hit test for regions
  const getRegionAtPosition = (worldX: number, worldY: number): Region | null => {
    // Check regions in reverse order (top to bottom)
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
    const handleSize = 8 / transform.zoom;
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
    
    // Draw dark background
    const viewWidth = canvas.width / transform.zoom;
    const viewHeight = canvas.height / transform.zoom;
    const viewX = -transform.x / transform.zoom;
    const viewY = -transform.y / transform.zoom;
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(viewX - 1000, viewY - 1000, viewWidth + 2000, viewHeight + 2000);
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 / transform.zoom; // Keep line width consistent
    
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
    
    // Draw tokens that are in viewport
    const visibleTokens: any[] = [];
    const offScreenTokens: any[] = [];
    
    tokens.forEach(token => {
      const tokenSize = 40; // Default token size
      const tokenLeft = token.x - tokenSize / 2;
      const tokenRight = token.x + tokenSize / 2;
      const tokenTop = token.y - tokenSize / 2;
      const tokenBottom = token.y + tokenSize / 2;
      
      // Check if token is in viewport
      if (tokenRight >= viewX && tokenLeft <= viewX + viewWidth &&
          tokenBottom >= viewY && tokenTop <= viewY + viewHeight) {
        visibleTokens.push(token);
      } else {
        offScreenTokens.push(token);
      }
    });
    
    // Draw regions
    regions.forEach(region => {
      drawRegion(ctx, region);
    });
    
    // Draw visible tokens
    visibleTokens.forEach(token => {
      drawToken(ctx, token);
    });
    
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
    const tokenSize = 40;
    
    // Save context to restore alpha
    ctx.save();
    ctx.globalAlpha = 0.3;
    
    // Draw ghost token circle
    ctx.fillStyle = token.color || '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, tokenSize / 2, 0, 2 * Math.PI);
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

  // Function to draw regions
  const drawRegion = (ctx: CanvasRenderingContext2D, region: Region) => {
    const isSelected = region.selected;
    
    // Draw region background
    ctx.fillStyle = region.color || 'rgba(100, 100, 100, 0.3)';
    ctx.fillRect(region.x, region.y, region.width, region.height);
    
    // Draw region border
    ctx.strokeStyle = isSelected ? '#ffffff' : '#666666';
    ctx.lineWidth = (isSelected ? 2 : 1) / transform.zoom;
    ctx.strokeRect(region.x, region.y, region.width, region.height);
    
    // Draw selection handles if selected
    if (isSelected) {
      drawRegionHandles(ctx, region);
    }
  };

  // Function to draw region resize handles
  const drawRegionHandles = (ctx: CanvasRenderingContext2D, region: Region) => {
    const handleSize = 6 / transform.zoom;
    const { x, y, width, height } = region;
    
    ctx.fillStyle = '#4f46e5';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / transform.zoom;
    
    // Corner handles
    const corners = [
      { x: x, y: y }, // nw
      { x: x + width, y: y }, // ne
      { x: x, y: y + height }, // sw
      { x: x + width, y: y + height }, // se
    ];
    
    // Edge handles
    const edges = [
      { x: x + width/2, y: y }, // n
      { x: x + width, y: y + height/2 }, // e
      { x: x + width/2, y: y + height }, // s
      { x: x, y: y + height/2 }, // w
    ];
    
    [...corners, ...edges].forEach(handle => {
      ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
    });
  };

  // Function to add a new region
  const addRegion = () => {
    const regionId = `region-${Date.now()}`;
    const centerX = -transform.x / transform.zoom;
    const centerY = -transform.y / transform.zoom;
    
    const newRegion: Region = {
      id: regionId,
      x: centerX - 10, // 20 units wide
      y: centerY - 20, // 40 units tall
      width: 20,
      height: 40,
      selected: false,
      color: 'rgba(100, 150, 200, 0.3)'
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

  // Redraw when transform, tokens, or regions change
  useEffect(() => {
    redrawCanvas();
  }, [transform, tokens, regions]);

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
        // Region selection logic
        setRegions(prev => prev.map(r => ({ ...r, selected: r.id === clickedRegion.id })));
        setSelectedRegionId(clickedRegion.id);
        setSelectedTokenIds([]); // Deselect tokens when selecting region
      } else {
        // Clicked on empty space: deselect all or add token
        if (e.shiftKey) {
          // Shift+click: add token at clicked position
          addTokenToCanvas('', worldPos.x, worldPos.y);
        } else {
          // Normal click: deselect all
          setSelectedTokenIds([]);
          setRegions(prev => prev.map(r => ({ ...r, selected: false })));
          setSelectedRegionId(null);
        }
      }
    }
  };

  // Handle right-click context menu for tokens
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const worldPos = screenToWorld(clickX, clickY);
    
    // Check if we right-clicked on a token
    const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
    
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
    }
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);
    
    if (e.button === 2) { // Right click
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0) { // Left click
      // Check what we're clicking on for dragging (tokens first, then regions)
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
        // Check if we're clicking on a resize handle
        const handle = getResizeHandle(clickedRegion, worldPos.x, worldPos.y);
        
        if (handle) {
          setIsResizingRegion(true);
          setResizeHandle(handle);
          setDraggedRegionId(clickedRegion.id);
        } else {
          // Start dragging the region
          setIsDraggingRegion(true);
          setDraggedRegionId(clickedRegion.id);
          setRegionDragOffset({
            x: worldPos.x - clickedRegion.x,
            y: worldPos.y - clickedRegion.y
          });
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
      // Region dragging
      const worldPos = screenToWorld(mouseX, mouseY);
      const newX = worldPos.x - regionDragOffset.x;
      const newY = worldPos.y - regionDragOffset.y;
      
      setRegions(prev => prev.map(region => 
        region.id === draggedRegionId 
          ? { ...region, x: newX, y: newY }
          : region
      ));
      
      redrawCanvas();
    } else if (isResizingRegion && draggedRegionId && resizeHandle) {
      // Region resizing
      const worldPos = screenToWorld(mouseX, mouseY);
      
      setRegions(prev => prev.map(region => {
        if (region.id !== draggedRegionId) return region;
        
        const { x, y, width, height } = region;
        let newRegion = { ...region };
        
        switch (resizeHandle) {
          case 'nw':
            newRegion.x = worldPos.x;
            newRegion.y = worldPos.y;
            newRegion.width = width + (x - worldPos.x);
            newRegion.height = height + (y - worldPos.y);
            break;
          case 'ne':
            newRegion.y = worldPos.y;
            newRegion.width = worldPos.x - x;
            newRegion.height = height + (y - worldPos.y);
            break;
          case 'sw':
            newRegion.x = worldPos.x;
            newRegion.width = width + (x - worldPos.x);
            newRegion.height = worldPos.y - y;
            break;
          case 'se':
            newRegion.width = worldPos.x - x;
            newRegion.height = worldPos.y - y;
            break;
          case 'n':
            newRegion.y = worldPos.y;
            newRegion.height = height + (y - worldPos.y);
            break;
          case 'e':
            newRegion.width = worldPos.x - x;
            break;
          case 's':
            newRegion.height = worldPos.y - y;
            break;
          case 'w':
            newRegion.x = worldPos.x;
            newRegion.width = width + (x - worldPos.x);
            break;
        }
        
        // Ensure minimum size
        newRegion.width = Math.max(10, newRegion.width);
        newRegion.height = Math.max(10, newRegion.height);
        
        return newRegion;
      }));
      
      redrawCanvas();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) { // Right click
      setIsPanning(false);
    } else if (e.button === 0) { // Left click
      setIsDraggingToken(false);
      setDraggedTokenId(null);
      setDragOffset({ x: 0, y: 0 });
      setDragStartPos({ x: 0, y: 0 });
      setDragPath([]);
      
      // Stop region interactions
      setIsDraggingRegion(false);
      setIsResizingRegion(false);
      setDraggedRegionId(null);
      setRegionDragOffset({ x: 0, y: 0 });
      setResizeHandle(null);
      
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

  const addTokenToCanvas = async (imageUrl: string, x?: number, y?: number) => {
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use provided coordinates or default to center of viewport
    const tokenX = x ?? (-transform.x / transform.zoom);
    const tokenY = y ?? (-transform.y / transform.zoom);
    
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

  return (
    <div className="w-full h-screen bg-surface flex flex-col relative">
      {/* Toolbar */}
      <Toolbar 
        sessionId={sessionId} 
        addTokenToCanvas={addTokenToCanvas}
      />
      
      {/* Map Manager Button */}
      <div className="absolute top-4 right-4 z-10">
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
      <div className="absolute top-16 right-4 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={addRegion}
          className="flex items-center gap-2"
        >
          Add Region
        </Button>
      </div>

      {/* Main Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
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

      {/* Floating Menu */}
      <FloatingMenu
        fabricCanvas={null}
        gridType="square"
        gridSize={40}
        isGridVisible={true}
        gridColor="#333"
        gridOpacity={80}
        onGridTypeChange={() => {}}
        onGridSizeChange={() => {}}
        onGridVisibilityChange={() => {}}
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
    </div>
  );
};

export default SimpleTabletop;