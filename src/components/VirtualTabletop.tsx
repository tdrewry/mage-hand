import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Circle, FabricImage, Line, Polygon, Text, Point } from 'fabric';
import { Toolbar } from './Toolbar';
import { TokenContextManager } from './TokenContextManager';
import { FloatingMenu } from './FloatingMenu';
import { MapManager } from './MapManager';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { toast } from 'sonner';
import { 
  GridType, 
  createGridRenderer, 
  GridRenderer, 
  Viewport 
} from '../lib/gridSystem';
import { renderMapGrids, snapToMapGrid } from '../lib/mapGridSystem';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';

export const VirtualTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [gridRenderer, setGridRenderer] = useState<GridRenderer | null>(null);
  const [gridType, setGridType] = useState<GridType>('square');
  const [gridSize, setGridSize] = useState(40);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [gridColor, setGridColor] = useState('#ffffff');
  const [gridOpacity, setGridOpacity] = useState(80);
  
  const { 
    sessionId, 
    tokens, 
    addToken, 
    updateTokenPosition, 
    updateTokenLabel,
    updateTokenColor,
    selectedTokenIds, 
    setSelectedTokens, 
    tokenVisibility,
    labelVisibility, 
    currentPlayerId, 
    players,
    removeToken 
  } = useSessionStore();

  useEffect(() => {
    if (!canvasRef.current || !gridCanvasRef.current) return;

    // Calculate full viewport canvas size
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 80; // Account for toolbar height

    // Setup main Fabric.js canvas
    const canvas = new FabricCanvas(canvasRef.current, {
      width: viewportWidth,
      height: viewportHeight,
      backgroundColor: 'transparent', // Make transparent to see grid behind
    });

    // Setup background grid canvas
    const gridCanvas = gridCanvasRef.current;
    gridCanvas.width = viewportWidth;
    gridCanvas.height = viewportHeight;
    
    // Set grid canvas background
    const gridCtx = gridCanvas.getContext('2d');
    if (gridCtx) {
      // Fill background
      gridCtx.fillStyle = '#1a1a1a';
      gridCtx.fillRect(0, 0, viewportWidth, viewportHeight);
    }
    
    const renderer = createGridRenderer(gridCanvas);
    if (!renderer) return;

    // Configure canvas for gaming with pan/zoom
    canvas.selection = true;
    canvas.preserveObjectStacking = true;
    
    // Enable zoom and pan functionality
    setupCanvasControls(canvas, renderer);

    setFabricCanvas(canvas);
    setGridRenderer(renderer);
    
    // Draw initial grid
    updateGridDisplay(canvas, renderer);
    
    // Load existing tokens from store onto canvas
    loadStoredTokensOntoCanvas(canvas);
    
    // Ensure proper layer ordering: background -> grid -> map -> tokens
    enforceLayerOrder(canvas);

    toast.success('Virtual Tabletop Ready!');

    // Handle window resize for responsive canvas
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight - 80;
      canvas.setDimensions({ width: newWidth, height: newHeight });
      
      // Resize grid canvas
      gridCanvas.width = newWidth;
      gridCanvas.height = newHeight;
      
      // Redraw grid
      updateGridDisplay(canvas, renderer);
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  // Update grid when settings change
  useEffect(() => {
    if (fabricCanvas && gridRenderer) {
      updateGridDisplay(fabricCanvas, gridRenderer);
      enforceLayerOrder(fabricCanvas);
      updateAllTokenLabels();
    }
  }, [fabricCanvas, gridRenderer, updateGridDisplay]);

  // Update labels when visibility settings change
  useEffect(() => {
    if (fabricCanvas) {
      updateAllTokenLabels();
    }
  }, [fabricCanvas, labelVisibility, selectedTokenIds, tokens]);

  // Handle token movement with throttling
  useEffect(() => {
    if (!fabricCanvas) return;

    let moveTimeout: NodeJS.Timeout;

    const handleObjectMoving = (e: any) => {
      const obj = e.target;
      if (obj.tokenId) {
        // Snap to grid based on active region
        const activeRegion = getActiveRegionAt(obj.left, obj.top);
        if (activeRegion) {
          const snappedPos = snapToMapGrid(obj.left, obj.top, activeRegion);
          obj.set({
            left: snappedPos.x,
            top: snappedPos.y,
          });
        }
        // Update label position - calculate bottom edge properly
        const tokenBottom = obj.top + (obj.height * obj.scaleY);
        updateTokenLabelPosition(obj.tokenId, obj.left, tokenBottom + 5);
      }
    };

    const handleObjectMoved = (e: any) => {
      const obj = e.target;
      if (obj.tokenId) {
        // Throttle position updates to prevent storage overflow
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
          updateTokenPosition(obj.tokenId, obj.left, obj.top);
          // Update label position - calculate bottom edge properly
          const tokenBottom = obj.top + (obj.height * obj.scaleY);
          updateTokenLabelPosition(obj.tokenId, obj.left, tokenBottom + 5);
          toast.info('Token moved', { duration: 1000 });
        }, 100); // Only update after 100ms of no movement
      }
    };

    const handleSelectionCreated = (e: any) => {
      const selectedObjects = fabricCanvas.getActiveObjects();
      const tokenIds = selectedObjects
        .filter((obj: any) => obj.tokenId)
        .map((obj: any) => obj.tokenId);
      setSelectedTokens(tokenIds);
    };

    const handleSelectionUpdated = (e: any) => {
      const selectedObjects = fabricCanvas.getActiveObjects();
      const tokenIds = selectedObjects
        .filter((obj: any) => obj.tokenId)
        .map((obj: any) => obj.tokenId);
      setSelectedTokens(tokenIds);
    };

    const handleSelectionCleared = () => {
      setSelectedTokens([]);
    };

    fabricCanvas.on('object:moving', handleObjectMoving);
    fabricCanvas.on('object:modified', handleObjectMoved);
    fabricCanvas.on('selection:created', handleSelectionCreated);
    fabricCanvas.on('selection:updated', handleSelectionUpdated);
    fabricCanvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      fabricCanvas.off('object:moving', handleObjectMoving);
      fabricCanvas.off('object:modified', handleObjectMoved);
      fabricCanvas.off('selection:created', handleSelectionCreated);
      fabricCanvas.off('selection:updated', handleSelectionUpdated);
      fabricCanvas.off('selection:cleared', handleSelectionCleared);
      clearTimeout(moveTimeout);
    };
  }, [fabricCanvas, gridType, gridSize, updateTokenPosition, setSelectedTokens]);

  // Helper function to get current viewport for grid rendering
  const getCurrentViewport = (canvas: FabricCanvas): Viewport => {
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    return {
      x: -vpt[4] / zoom,
      y: -vpt[5] / zoom,
      zoom: zoom,
      width: canvas.width || 1200,
      height: canvas.height || 800
    };
  };

  // Helper function to get current viewport for grid rendering
  const getCurrentViewport = (canvas: FabricCanvas): Viewport => {
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    return {
      x: -vpt[4] / zoom,
      y: -vpt[5] / zoom,
      zoom: zoom,
      width: canvas.width || 1200,
      height: canvas.height || 800
    };
  };

  // Old grid functions removed - now using efficient grid system

  const addTokenToCanvas = (imageUrl: string, x: number = 100, y: number = 100, gridWidth: number = 1, gridHeight: number = 1, color?: string) => {
    if (!fabricCanvas) return;

    FabricImage.fromURL(imageUrl).then((img) => {
      const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Ensure the tokenId is properly attached to the fabric object
      (img as any).tokenId = tokenId;
      (img as any).isMap = false; // Ensure it's not marked as a map
      
      // Store original image for color changes
      (img as any).originalElement = img.getElement();
      
      // Apply initial color if provided
      if (color) {
        applyTokenColor(img, color);
      }
      
      // Calculate pixel dimensions based on grid size
      const maxPixelWidth = gridWidth * gridSize;
      const maxPixelHeight = gridHeight * gridSize;
      
      // Get image natural dimensions
      const imgWidth = img.width || 100;
      const imgHeight = img.height || 100;
      
      // Calculate scale to fit within bounds while maintaining aspect ratio
      const scaleX = maxPixelWidth / imgWidth;
      const scaleY = maxPixelHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY); // Use smaller scale to maintain aspect ratio
      
      // Calculate final dimensions
      const finalWidth = imgWidth * scale;
      const finalHeight = imgHeight * scale;
      
      // Center the image within the token bounds if it doesn't fill completely
      const offsetX = (maxPixelWidth - finalWidth) / 2;
      const offsetY = (maxPixelHeight - finalHeight) / 2;
      
      img.set({
        left: x + offsetX,
        top: y + offsetY,
        scaleX: scale,
        scaleY: scale,
        hasControls: true,
        hasBorders: true,
        borderColor: 'hsl(var(--token-selection))',
        cornerColor: 'hsl(var(--accent))',
        lockRotation: false, // Allow rotation
      });

      fabricCanvas.add(img);
      
      // Create label for the token - position at bottom edge
      const tokenBottom = y + finalHeight;
      createTokenLabel(tokenId, x, tokenBottom + 5, `Token ${tokenId.slice(-8)}`, color || '#FFFFFF');
      
      enforceLayerOrder(fabricCanvas);
      fabricCanvas.renderAll();
      
      // Add to store with error handling
      try {
        addToken({
          id: tokenId,
          imageUrl,
          x,
          y,
          name: `Token ${tokenId.slice(-8)}`,
          gridWidth,
          gridHeight,
          label: `Token ${tokenId.slice(-8)}`,
          ownerId: currentPlayerId,
          color,
        });
        toast.success('Token added to map');
      } catch (error) {
        console.error('Failed to save token:', error);
        toast.error('Token added but not saved - storage full');
      }
    }).catch((error) => {
      console.error('Token load error:', error);
      toast.error('Failed to load token image');
    });
  };

  // Enforce layer ordering: background -> map -> tokens -> labels (grid is now separate canvas)
  const enforceLayerOrder = (canvas: FabricCanvas) => {
    if (!canvas || !canvas.getObjects) return; // Safety check
    
    const objects = canvas.getObjects();
    
    // Group objects by type (no more grid objects)
    const backgrounds = objects.filter((obj: any) => obj.isBackground);
    const maps = objects.filter((obj: any) => obj.isMap);
    const tokens = objects.filter((obj: any) => obj.tokenId);
    const labels = objects.filter((obj: any) => obj.isTokenLabel);
    const others = objects.filter((obj: any) => 
      !obj.isBackground && !obj.isMap && !obj.tokenId && !obj.isTokenLabel
    );
    
    // Remove all objects first
    objects.forEach(obj => canvas.remove(obj));
    
    // Add in order: background, map, tokens, labels, others
    [...backgrounds, ...maps, ...tokens, ...labels, ...others].forEach(obj => {
      canvas.add(obj);
    });
    
    canvas.renderAll();
  };

  // Apply color tint to token
  const applyTokenColor = (fabricObject: any, color: string) => {
    if (!fabricObject) return;
    
    // Create a colored overlay using filters or direct manipulation
    fabricObject.set({
      backgroundColor: color,
      // You could also use filters for more advanced color manipulation
    });
  };

  // Handle token color changes from context menu
  const handleTokenColorChange = (tokenId: string, color: string) => {
    if (!fabricCanvas) return;
    
    // Find the fabric object
    const objects = fabricCanvas.getObjects();
    const tokenObject = objects.find((obj: any) => obj.tokenId === tokenId);
    
    if (tokenObject) {
      applyTokenColor(tokenObject, color);
      fabricCanvas.renderAll();
    }
    
    // Update store
    updateTokenColor(tokenId, color);
  };

  // Handle canvas updates after token operations
  const handleCanvasUpdate = () => {
    if (fabricCanvas) {
      enforceLayerOrder(fabricCanvas);
      fabricCanvas.renderAll();
    }
  };

  // Wrap tokens in context menu
  const wrapTokenWithContextMenu = (tokenObject: any, tokenId: string) => {
    // This is a conceptual wrapper - in practice, we'll handle this differently
    // since Fabric.js objects can't be directly wrapped with React components
    return tokenObject;
  };

  // Create label for token
  const createTokenLabel = (tokenId: string, x: number, y: number, labelText: string, color: string) => {
    if (!fabricCanvas) return;

    // Remove existing label for this token
    const existingLabel = fabricCanvas.getObjects().find((obj: any) => 
      obj.isTokenLabel && obj.tokenId === tokenId
    );
    if (existingLabel) {
      fabricCanvas.remove(existingLabel);
    }

    // Create new text label
    const label = new Text(labelText, {
      left: x,
      top: y,
      fontSize: 12,
      fill: color,
      fontFamily: 'Arial',
      textAlign: 'center',
      selectable: false,
      evented: false,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: 4,
    });

    // Mark as token label
    (label as any).isTokenLabel = true;
    (label as any).tokenId = tokenId;

    fabricCanvas.add(label);
    updateTokenLabelVisibility(tokenId);
  };

  // Update label position when token moves
  const updateTokenLabelPosition = (tokenId: string, x: number, y: number) => {
    if (!fabricCanvas) return;

    const label = fabricCanvas.getObjects().find((obj: any) => 
      obj.isTokenLabel && obj.tokenId === tokenId
    );
    
    const token = fabricCanvas.getObjects().find((obj: any) => 
      obj.tokenId === tokenId && !obj.isTokenLabel
    );
    
    if (label && token) {
      // Center the label horizontally relative to token
      const tokenWidth = (token.width || 100) * (token.scaleX || 1);
      const labelWidth = label.width || 0;
      const centeredX = x + (tokenWidth / 2) - (labelWidth / 2);
      label.set({ left: centeredX, top: y });
      fabricCanvas.renderAll();
    }
  };

  // Update label visibility based on settings
  const updateTokenLabelVisibility = (tokenId: string) => {
    if (!fabricCanvas) return;

    const token = tokens.find(t => t.id === tokenId);
    const label = fabricCanvas.getObjects().find((obj: any) => 
      obj.isTokenLabel && obj.tokenId === tokenId
    );
    
    if (!label || !token) return;

    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const isDM = currentPlayer?.role === 'dm';

    let shouldShow = false;

    switch (labelVisibility) {
      case 'show':
        shouldShow = true;
        break;
      case 'hide':
        shouldShow = false;
        break;
      case 'selected':
        shouldShow = selectedTokenIds.includes(tokenId);
        break;
    }

    label.set({ visible: shouldShow });
    fabricCanvas.renderAll();
  };

  // Update all token labels
  const updateAllTokenLabels = () => {
    if (!fabricCanvas) return;

    tokens.forEach(token => {
      updateTokenLabelVisibility(token.id);
    });
  };

  // Load stored tokens onto canvas
  const loadStoredTokensOntoCanvas = (canvas: FabricCanvas) => {
    tokens.forEach(token => {
      loadTokenOntoCanvas(canvas, token);
    });
  };

  // Load a single token onto canvas from store data
  const loadTokenOntoCanvas = (canvas: FabricCanvas, token: any) => {
    FabricImage.fromURL(token.imageUrl).then((img) => {
      // Set token properties
      (img as any).tokenId = token.id;
      (img as any).isMap = false;
      
      // Apply stored color if available
      if (token.color) {
        applyTokenColor(img, token.color);
      }
      
      // Calculate dimensions based on grid size
      const maxPixelWidth = token.gridWidth * gridSize;
      const maxPixelHeight = token.gridHeight * gridSize;
      
      // Get image natural dimensions
      const imgWidth = img.width || 100;
      const imgHeight = img.height || 100;
      
      // Calculate scale to fit within bounds while maintaining aspect ratio
      const scaleX = maxPixelWidth / imgWidth;
      const scaleY = maxPixelHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY);
      
      // Calculate final dimensions
      const finalWidth = imgWidth * scale;
      const finalHeight = imgHeight * scale;
      
      // Center the image within the token bounds if needed
      const offsetX = (maxPixelWidth - finalWidth) / 2;
      const offsetY = (maxPixelHeight - finalHeight) / 2;
      
      img.set({
        left: token.x + offsetX,
        top: token.y + offsetY,
        scaleX: scale,
        scaleY: scale,
        hasControls: true,
        hasBorders: true,
        borderColor: 'hsl(var(--token-selection))',
        cornerColor: 'hsl(var(--accent))',
        lockRotation: false,
      });

      canvas.add(img);
      
      // Create label for the token
      const tokenBottom = token.y + finalHeight;
      createTokenLabel(token.id, token.x, tokenBottom + 5, token.label || token.name, token.color || '#FFFFFF');
      
      canvas.renderAll();
    }).catch((error) => {
      console.error('Failed to load stored token:', error);
      toast.error(`Failed to load token: ${token.name}`);
    });
  };

  // Setup canvas pan and zoom controls
  const setupCanvasControls = (canvas: FabricCanvas, renderer: GridRenderer) => {
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let rightMouseDown = false;
    const dragThreshold = 5; // Minimum pixels to consider it a drag vs click

    // Optimized mouse wheel zoom
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      
      // Zoom limits
      const minZoom = 0.1;
      const maxZoom = 5;
      
      zoom *= 0.999 ** delta;
      zoom = Math.min(Math.max(zoom, minZoom), maxZoom);
      
      // Zoom towards mouse position
      const point = new Point(opt.e.offsetX, opt.e.offsetY);
      canvas.zoomToPoint(point, zoom);
      
      // Update grid immediately - no debouncing needed with new system
      updateGridDisplay(canvas, renderer);
      
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Right mouse button pan and context menu handling
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e as MouseEvent;
      
      if (evt.button === 2 || evt.which === 3) { // Try both properties
        const target = opt.target;
        
        // If clicking on a token, don't start panning - let context menu handle it
        if (target && (target as any).tokenId) {
          // Store the clicked token for context menu
          setSelectedTokens([(target as any).tokenId]);
          return;
        }
        
        // Otherwise, start panning
        rightMouseDown = true;
        dragStartX = evt.clientX;
        dragStartY = evt.clientY;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
        
        // Prevent default context menu
        evt.preventDefault();
        evt.stopPropagation();
      }
    });

    canvas.on('mouse:move', (opt) => {
      const evt = opt.e as MouseEvent;
      
      if (rightMouseDown) {
        const deltaX = Math.abs(evt.clientX - dragStartX);
        const deltaY = Math.abs(evt.clientY - dragStartY);
        
        // Start dragging if we've moved beyond threshold
        if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
          isDragging = true;
          canvas.selection = false;
          canvas.setCursor('grabbing');
        }
        
        if (isDragging) {
          const vpt = canvas.viewportTransform;
          if (vpt) {
            vpt[4] += evt.clientX - lastPosX;
            vpt[5] += evt.clientY - lastPosY;
            canvas.requestRenderAll();
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
            
            // Redraw grid to show new visible area
            updateGridDisplay(canvas, renderer);
          }
        }
        
        evt.preventDefault();
        evt.stopPropagation();
      }
    });

    canvas.on('mouse:up', (opt) => {
      const evt = opt.e as MouseEvent;
      
      // Handle right mouse button up
      if (evt.button === 2 || evt.which === 3) {
        if (rightMouseDown) {
          const target = opt.target;
          
          if (isDragging) {
            // Was dragging - end pan mode
            isDragging = false;
            canvas.selection = true;
            canvas.setCursor('default');
          } else if (target && (target as any).tokenId) {
            // Was a click on a token - trigger context menu manually
            // Let's use a simpler approach - just set a flag and let TokenContextManager handle it
          }
          
          rightMouseDown = false;
          evt.preventDefault();
          evt.stopPropagation();
        }
      }
    });

    // Add more aggressive right-click detection
    canvas.upperCanvasEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    canvas.upperCanvasEl.addEventListener('mousedown', (e) => {
      if (e.button === 2 || e.which === 3) {
        // Get the Fabric.js target and pointer
        const pointer = canvas.getPointer(e);
        const target = canvas.findTarget(e);
        
        // Handle right-click logic directly here since Fabric.js events aren't working
        if (target && (target as any).tokenId) {
          // Store the clicked token for context menu
          setSelectedTokens([(target as any).tokenId]);
          // Don't start panning
          return;
        }
        
        // Start panning for right-click on empty space
        rightMouseDown = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        isDragging = false;
        
        canvas.defaultCursor = 'grab';
        canvas.setCursor('grab');
        
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Add DOM-based mousemove and mouseup for right-click panning
    canvas.upperCanvasEl.addEventListener('mousemove', (e) => {
      if (rightMouseDown) {
        const deltaX = Math.abs(e.clientX - dragStartX);
        const deltaY = Math.abs(e.clientY - dragStartY);
        
        if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
          isDragging = true;
          canvas.selection = false;
          canvas.setCursor('grabbing');
        }
        
        if (isDragging) {
          const vpt = canvas.viewportTransform;
          if (vpt) {
            vpt[4] += e.clientX - lastPosX;
            vpt[5] += e.clientY - lastPosY;
            canvas.setViewportTransform(vpt);
            // Update grid immediately - efficient system handles it smoothly
            updateGridDisplay(canvas, renderer);
            canvas.renderAll();
          }
        }
        
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        e.preventDefault();
      }
    });
    
    canvas.upperCanvasEl.addEventListener('mouseup', (e) => {
      if ((e.button === 2 || e.which === 3) && rightMouseDown) {
        const target = canvas.findTarget(e);
        
        if (isDragging) {
          isDragging = false;
          canvas.selection = true;
          canvas.setCursor('default');
          
          // Grid is automatically updated during panning, no need to redraw
          canvas.renderAll();
        } else if (target && (target as any).tokenId) {
          // Trigger context menu via custom event
          window.dispatchEvent(new CustomEvent('showTokenContextMenu', {
            detail: { 
              tokenId: (target as any).tokenId, 
              x: e.clientX, 
              y: e.clientY 
            }
          }));
        }
        
        rightMouseDown = false;
        e.preventDefault();
      }
    });

    // Keyboard shortcuts for zoom
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '0') {
          // Reset zoom
          canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
          updateGridDisplay(canvas, renderer);
          e.preventDefault();
        } else if (e.key === '=' || e.key === '+') {
          // Zoom in
          let zoom = canvas.getZoom();
          zoom = Math.min(zoom * 1.1, 5);
          const center = canvas.getCenter();
          canvas.zoomToPoint(new Point(center.left, center.top), zoom);
          updateGridDisplay(canvas, renderer);
          e.preventDefault();
        } else if (e.key === '-') {
          // Zoom out
          let zoom = canvas.getZoom();
          zoom = Math.max(zoom / 1.1, 0.1);
          const center = canvas.getCenter();
          canvas.zoomToPoint(new Point(center.left, center.top), zoom);
          updateGridDisplay(canvas, renderer);
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header Toolbar - Minimal overlay style */}
      <div className="relative z-40">
        <Toolbar sessionId={sessionId} fabricCanvas={fabricCanvas} />
      </div>
      
      {/* Full-Screen Map Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map Manager Button - Upper Right */}
        <Button
          onClick={() => setShowMapManager(!showMapManager)}
          className="absolute top-4 right-4 z-30"
          variant="secondary"
          size="sm"
        >
          <Settings className="h-4 w-4 mr-2" />
          Maps
        </Button>

        {/* Floating Menu - Positioned at upper left of map */}
        <FloatingMenu
          fabricCanvas={fabricCanvas}
          gridType={'none' as GridType} // Disabled since we use map-based grids now
          gridSize={40}
          isGridVisible={true}
          gridColor={'#ffffff'}
          gridOpacity={80}
          onGridTypeChange={() => {}} // Disabled
          onGridSizeChange={() => {}} // Disabled
          onGridVisibilityChange={() => {}} // Disabled
          onGridColorChange={() => {}} // Disabled
          onGridOpacityChange={() => {}} // Disabled
          onAddToken={addTokenToCanvas}
          onColorChange={handleTokenColorChange}
          onUpdateCanvas={handleCanvasUpdate}
        />
        
        {/* Background Grid Canvas */}
        <canvas 
          ref={gridCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ 
            zIndex: 1,
            background: '#1a1a1a'
          }}
        />
        
        {/* Foreground Fabric Canvas */}
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full"
          style={{ 
            zIndex: 2,
            background: 'transparent'
          }}
        />
      </div>
      
      {/* Map Manager Modal */}
      {showMapManager && (
        <MapManager onClose={() => setShowMapManager(false)} />
      )}
      
      {/* Token Context Manager - Handles right-click menus */}
      <TokenContextManager
        fabricCanvas={fabricCanvas}
        onColorChange={handleTokenColorChange}
        onUpdateCanvas={handleCanvasUpdate}
      />
    </div>
  );
};