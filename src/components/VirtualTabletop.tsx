import React, { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, Circle, FabricImage, Line, Polygon, Text } from 'fabric';
import { Toolbar } from './Toolbar';
import { TokenContextMenu } from './TokenContextMenu';
import { FloatingMenu } from './FloatingMenu';
import { useSessionStore } from '../stores/sessionStore';
import { toast } from 'sonner';

export type GridType = 'square' | 'hex' | 'none';

export const VirtualTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [gridType, setGridType] = useState<GridType>('square');
  const [gridSize, setGridSize] = useState(40);
  const [isGridVisible, setIsGridVisible] = useState(true);
  
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
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 1200,
      height: 800,
      backgroundColor: 'hsl(var(--canvas-background))',
    });

    // Configure canvas for gaming
    canvas.selection = true;
    canvas.preserveObjectStacking = true;

    setFabricCanvas(canvas);
    
    // Draw initial grid
    drawGrid(canvas, gridType, gridSize, isGridVisible);
    
    // Ensure proper layer ordering: background -> grid -> map -> tokens
    enforceLayerOrder(canvas);

    toast.success('Virtual Tabletop Ready!');

    return () => {
      canvas.dispose();
    };
  }, []);

  // Update grid when settings change
  useEffect(() => {
    if (fabricCanvas) {
      drawGrid(fabricCanvas, gridType, gridSize, isGridVisible);
      enforceLayerOrder(fabricCanvas);
      updateAllTokenLabels();
    }
  }, [fabricCanvas, gridType, gridSize, isGridVisible]);

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
        // Snap to grid if enabled
        if (gridType !== 'none') {
          const snappedPos = snapToGrid(obj.left, obj.top, gridSize, gridType);
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

  const drawGrid = (canvas: FabricCanvas, type: GridType, size: number, visible: boolean) => {
    // Remove existing grid
    const existingGrid = canvas.getObjects().filter((obj: any) => obj.isGrid);
    existingGrid.forEach(obj => canvas.remove(obj));

    if (!visible || type === 'none') {
      canvas.renderAll();
      return;
    }

    const canvasWidth = canvas.width || 1200;
    const canvasHeight = canvas.height || 800;

    if (type === 'square') {
      drawSquareGrid(canvas, size, canvasWidth, canvasHeight);
    } else if (type === 'hex') {
      drawHexGrid(canvas, size, canvasWidth, canvasHeight);
    }

    canvas.renderAll();
  };

  const drawSquareGrid = (canvas: FabricCanvas, size: number, width: number, height: number) => {
    const gridColor = 'hsl(var(--grid-color))';
    
    // Vertical lines
    for (let x = 0; x <= width; x += size) {
      const line = new Line([x, 0, x, height], {
        stroke: gridColor,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        isGrid: true,
      } as any);
      canvas.add(line);
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += size) {
      const line = new Line([0, y, width, y], {
        stroke: gridColor,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        isGrid: true,
      } as any);
      canvas.add(line);
    }
  };

  const drawHexGrid = (canvas: FabricCanvas, size: number, width: number, height: number) => {
    const gridColor = 'hsl(var(--grid-color))';
    const hexWidth = size * Math.sqrt(3);
    const hexHeight = size * 2;
    const vertSpacing = hexHeight * 0.75;

    for (let row = 0; row * vertSpacing < height + hexHeight; row++) {
      for (let col = 0; col * hexWidth < width + hexWidth; col++) {
        const offsetX = (row % 2) * (hexWidth / 2);
        const centerX = col * hexWidth + offsetX + hexWidth / 2;
        const centerY = row * vertSpacing + hexHeight / 2;

        if (centerX > -hexWidth/2 && centerX < width + hexWidth/2 && 
            centerY > -hexHeight/2 && centerY < height + hexHeight/2) {
          const hex = createHexagon(centerX, centerY, size, gridColor);
          canvas.add(hex);
        }
      }
    }
  };

  const createHexagon = (centerX: number, centerY: number, radius: number, color: string) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push({ x, y });
    }

    return new Polygon(points, {
      fill: 'transparent',
      stroke: color,
      strokeWidth: 1,
      selectable: false,
      evented: false,
      isGrid: true,
    } as any);
  };

  const snapToGrid = (x: number, y: number, size: number, type: GridType) => {
    if (type === 'square') {
      return {
        x: Math.round(x / size) * size,
        y: Math.round(y / size) * size,
      };
    } else if (type === 'hex') {
      // Simplified hex snapping - can be improved
      const hexWidth = size * Math.sqrt(3);
      const hexHeight = size * 2;
      return {
        x: Math.round(x / hexWidth) * hexWidth,
        y: Math.round(y / (hexHeight * 0.75)) * (hexHeight * 0.75),
      };
    }
    return { x, y };
  };

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

  // Enforce layer ordering: background -> grid -> map -> tokens
  const enforceLayerOrder = (canvas: FabricCanvas) => {
    if (!canvas || !canvas.getObjects) return; // Safety check
    
    const objects = canvas.getObjects();
    
    // Group objects by type
    const backgrounds = objects.filter((obj: any) => obj.isBackground);
    const grids = objects.filter((obj: any) => obj.isGrid);
    const maps = objects.filter((obj: any) => obj.isMap);
    const tokens = objects.filter((obj: any) => obj.tokenId);
    const labels = objects.filter((obj: any) => obj.isTokenLabel);
    const others = objects.filter((obj: any) => 
      !obj.isBackground && !obj.isGrid && !obj.isMap && !obj.tokenId && !obj.isTokenLabel
    );
    
    // Remove all objects first
    objects.forEach(obj => canvas.remove(obj));
    
    // Add in order: background, grid, map, tokens, labels, others
    [...backgrounds, ...grids, ...maps, ...tokens, ...labels, ...others].forEach(obj => {
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

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header Toolbar */}
      <Toolbar sessionId={sessionId} fabricCanvas={fabricCanvas} />
      
      <div className="flex-1 flex">
        {/* Main Canvas Area - Full Width */}
        <TokenContextMenu 
          tokenId={selectedTokenIds[0] || ''}
          onColorChange={handleTokenColorChange}
          onUpdateCanvas={handleCanvasUpdate}
        >
          <div className="flex-1 p-4 relative">
            {/* Floating Menu */}
            <FloatingMenu
              fabricCanvas={fabricCanvas}
              gridType={gridType}
              gridSize={gridSize}
              isGridVisible={isGridVisible}
              onGridTypeChange={setGridType}
              onGridSizeChange={setGridSize}
              onGridVisibilityChange={setIsGridVisible}
              onAddToken={addTokenToCanvas}
              onColorChange={handleTokenColorChange}
              onUpdateCanvas={handleCanvasUpdate}
            />
            
            {/* Canvas */}
            <div className="canvas-container rounded-lg overflow-hidden shadow-lg">
              <canvas 
                ref={canvasRef} 
                className="max-w-full max-h-full"
              />
            </div>
          </div>
        </TokenContextMenu>
      </div>
    </div>
  );
};