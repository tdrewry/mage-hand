import React, { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, Circle, FabricImage, Line, Polygon, Text, Point } from 'fabric';
import { Toolbar } from './Toolbar';
import { TokenContextManager } from './TokenContextManager';
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

    // Calculate full viewport canvas size
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - 80; // Account for toolbar height

    const canvas = new FabricCanvas(canvasRef.current, {
      width: viewportWidth,
      height: viewportHeight,
      backgroundColor: '#1a1a1a', // Default to RGB(26,26,26) to match UI
    });

    // Configure canvas for gaming with pan/zoom
    canvas.selection = true;
    canvas.preserveObjectStacking = true;
    
    // Enable zoom and pan functionality
    setupCanvasControls(canvas);

    setFabricCanvas(canvas);
    
    // Draw initial grid
    drawGrid(canvas, gridType, gridSize, isGridVisible);
    
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

    // Get current zoom and viewport transform
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;
    const canvasWidth = canvas.width || 1200;
    const canvasHeight = canvas.height || 800;
    
    // Calculate visible area with some padding
    const padding = 1000; // Extra grid lines beyond visible area
    const visibleLeft = -vpt[4] / zoom - padding;
    const visibleTop = -vpt[5] / zoom - padding;
    const visibleWidth = canvasWidth / zoom + padding * 2;
    const visibleHeight = canvasHeight / zoom + padding * 2;

    if (type === 'square') {
      drawSquareGrid(canvas, size, visibleLeft, visibleTop, visibleWidth, visibleHeight);
    } else if (type === 'hex') {
      drawHexGrid(canvas, size, visibleLeft, visibleTop, visibleWidth, visibleHeight);
    }

    canvas.renderAll();
  };

  const drawSquareGrid = (canvas: FabricCanvas, size: number, left: number, top: number, width: number, height: number) => {
    const gridColor = 'hsl(var(--grid-color))';
    
    // Calculate grid boundaries aligned to grid
    const startX = Math.floor(left / size) * size;
    const endX = Math.ceil((left + width) / size) * size;
    const startY = Math.floor(top / size) * size;
    const endY = Math.ceil((top + height) / size) * size;
    
    // Vertical lines
    for (let x = startX; x <= endX; x += size) {
      const line = new Line([x, startY, x, endY], {
        stroke: gridColor,
        strokeWidth: 1 / canvas.getZoom(), // Scale stroke with zoom
        selectable: false,
        evented: false,
        isGrid: true,
      } as any);
      canvas.add(line);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += size) {
      const line = new Line([startX, y, endX, y], {
        stroke: gridColor,
        strokeWidth: 1 / canvas.getZoom(), // Scale stroke with zoom
        selectable: false,
        evented: false,
        isGrid: true,
      } as any);
      canvas.add(line);
    }
  };

  const drawHexGrid = (canvas: FabricCanvas, size: number, left: number, top: number, width: number, height: number) => {
    const gridColor = 'hsl(var(--grid-color))';
    const hexWidth = size * Math.sqrt(3);
    const hexHeight = size * 2;
    const vertSpacing = hexHeight * 0.75;

    // Calculate hex grid boundaries
    const startCol = Math.floor(left / hexWidth);
    const endCol = Math.ceil((left + width) / hexWidth);
    const startRow = Math.floor(top / vertSpacing);
    const endRow = Math.ceil((top + height) / vertSpacing);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const offsetX = (row % 2) * (hexWidth / 2);
        const centerX = col * hexWidth + offsetX + hexWidth / 2;
        const centerY = row * vertSpacing + hexHeight / 2;

        const hex = createHexagon(centerX, centerY, size, gridColor, canvas.getZoom());
        canvas.add(hex);
      }
    }
  };

  const createHexagon = (centerX: number, centerY: number, radius: number, color: string, zoom: number) => {
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
      strokeWidth: 1 / zoom, // Scale stroke with zoom
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
  const setupCanvasControls = (canvas: FabricCanvas) => {
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let rightMouseDown = false;
    const dragThreshold = 5; // Minimum pixels to consider it a drag vs click

    // Mouse wheel zoom
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
      
      // Redraw grid at new zoom level
      drawGrid(canvas, gridType, gridSize, isGridVisible);
      
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Right mouse button pan and context menu handling
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e as MouseEvent;
      console.log('FABRIC mouse:down', { 
        button: evt.button, 
        which: evt.which,
        type: evt.type,
        target: opt.target, 
        hasTokenId: !!(opt.target as any)?.tokenId,
        originalEvent: evt
      });
      
      if (evt.button === 2 || evt.which === 3) { // Try both properties
        const target = opt.target;
        
        // If clicking on a token, don't start panning - let context menu handle it
        if (target && (target as any).tokenId) {
          console.log('Right-click on token:', (target as any).tokenId);
          // Store the clicked token for context menu
          setSelectedTokens([(target as any).tokenId]);
          return;
        }
        
        console.log('Starting right-click pan mode');
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
        console.log('Mouse move during right mouse down');
        const deltaX = Math.abs(evt.clientX - dragStartX);
        const deltaY = Math.abs(evt.clientY - dragStartY);
        
        // Start dragging if we've moved beyond threshold
        if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
          console.log('Starting drag mode');
          isDragging = true;
          canvas.selection = false;
          canvas.setCursor('grabbing');
        }
        
        if (isDragging) {
          console.log('Panning map');
          const vpt = canvas.viewportTransform;
          if (vpt) {
            vpt[4] += evt.clientX - lastPosX;
            vpt[5] += evt.clientY - lastPosY;
            canvas.requestRenderAll();
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
            
            // Redraw grid to show new visible area
            drawGrid(canvas, gridType, gridSize, isGridVisible);
          }
        }
        
        evt.preventDefault();
        evt.stopPropagation();
      }
    });

    canvas.on('mouse:up', (opt) => {
      const evt = opt.e as MouseEvent;
      console.log('FABRIC mouse:up', { 
        button: evt.button, 
        which: evt.which,
        type: evt.type,
        rightMouseDown, 
        isDragging, 
        target: opt.target,
        originalEvent: evt
      });
      
      // Handle right mouse button up
      if (evt.button === 2 || evt.which === 3) {
        console.log('Right mouse up detected, rightMouseDown:', rightMouseDown);
        
        if (rightMouseDown) {
          const target = opt.target;
          
          if (isDragging) {
            console.log('Ending pan mode');
            // Was dragging - end pan mode
            isDragging = false;
            canvas.selection = true;
            canvas.setCursor('default');
          } else if (target && (target as any).tokenId) {
            console.log('Showing context menu for token:', (target as any).tokenId);
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
      console.log('Context menu prevented');
    });
    
    canvas.upperCanvasEl.addEventListener('mousedown', (e) => {
      console.log('DOM mousedown:', { 
        button: e.button, 
        which: e.which, 
        type: e.type,
        target: e.target,
        currentTarget: e.currentTarget
      });
      if (e.button === 2 || e.which === 3) {
        console.log('DOM RIGHT CLICK DETECTED!');
        
        // Get the Fabric.js target and pointer
        const pointer = canvas.getPointer(e);
        const target = canvas.findTarget(e);
        
        console.log('Right-click target analysis:', { target, pointer, hasTokenId: !!(target as any)?.tokenId });
        
        // Handle right-click logic directly here since Fabric.js events aren't working
        if (target && (target as any).tokenId) {
          console.log('Right-click on token:', (target as any).tokenId);
          // Store the clicked token for context menu
          setSelectedTokens([(target as any).tokenId]);
          // Don't start panning
          return;
        }
        
        // Start panning for right-click on empty space
        console.log('Starting right-click pan mode');
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
          drawGrid(canvas, gridType, gridSize, isGridVisible);
          e.preventDefault();
        } else if (e.key === '=' || e.key === '+') {
          // Zoom in
          let zoom = canvas.getZoom();
          zoom = Math.min(zoom * 1.1, 5);
          const center = canvas.getCenter();
          canvas.zoomToPoint(new Point(center.left, center.top), zoom);
          drawGrid(canvas, gridType, gridSize, isGridVisible);
          e.preventDefault();
        } else if (e.key === '-') {
          // Zoom out
          let zoom = canvas.getZoom();
          zoom = Math.max(zoom / 1.1, 0.1);
          const center = canvas.getCenter();
          canvas.zoomToPoint(new Point(center.left, center.top), zoom);
          drawGrid(canvas, gridType, gridSize, isGridVisible);
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
      <div className="flex-1 relative">
        {/* Single container for the canvas */}
        <div className="relative w-full h-full">
          {/* Floating Menu - Positioned at upper left of map */}
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
          
          {/* Full-Screen Canvas Container */}
          <div className="absolute inset-0 canvas-container">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full block"
            />
          </div>
        </div>
      </div>
      
      {/* Token Context Manager - Handles right-click menus */}
      <TokenContextManager
        fabricCanvas={fabricCanvas}
        onColorChange={handleTokenColorChange}
        onUpdateCanvas={handleCanvasUpdate}
      />
    </div>
  );
};