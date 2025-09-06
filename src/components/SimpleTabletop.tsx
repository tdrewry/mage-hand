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
    
    // Draw visible tokens
    visibleTokens.forEach(token => {
      drawToken(ctx, token);
    });
    
    // Restore context before drawing off-screen indicators
    ctx.restore();
    
    // Draw off-screen token indicators
    offScreenTokens.forEach(token => {
      drawOffScreenIndicator(ctx, token, viewX, viewY, viewWidth, viewHeight);
    });
  };

  // Function to draw a single token
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

  // Redraw when transform or tokens change
  useEffect(() => {
    redrawCanvas();
  }, [transform, tokens]);

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
      
      // Check if we clicked on a token
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      
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
      } else {
        // Clicked on empty space: deselect all or add token
        if (e.shiftKey) {
          // Shift+click: add token at clicked position
          addTokenToCanvas('', worldPos.x, worldPos.y);
        } else {
          // Normal click: deselect all
          setSelectedTokenIds([]);
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
      // Check if we're clicking on a token for dragging
      const clickedToken = getTokenAtPosition(worldPos.x, worldPos.y);
      
      if (clickedToken) {
        setIsDraggingToken(true);
        setDraggedTokenId(clickedToken.id);
        setDragOffset({
          x: worldPos.x - clickedToken.x,
          y: worldPos.y - clickedToken.y
        });
        
        // If token not selected, select it
        if (!selectedTokenIds.includes(clickedToken.id)) {
          setSelectedTokenIds([clickedToken.id]);
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
      
      // Update token position in store
      updateTokenPosition(draggedTokenId, newX, newY);
      
      // Force immediate redraw for smooth dragging feedback
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