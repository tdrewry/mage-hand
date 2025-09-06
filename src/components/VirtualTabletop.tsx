import React, { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, Circle, FabricImage, Line, Polygon } from 'fabric';
import { Toolbar } from './Toolbar';
import { GridControls } from './GridControls';
import { TokenPanel } from './TokenPanel';
import { MapControls } from './MapControls';
import { useSessionStore } from '../stores/sessionStore';
import { toast } from 'sonner';

export type GridType = 'square' | 'hex' | 'none';

export const VirtualTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [gridType, setGridType] = useState<GridType>('square');
  const [gridSize, setGridSize] = useState(40);
  const [isGridVisible, setIsGridVisible] = useState(true);
  
  const { sessionId, tokens, addToken, updateTokenPosition } = useSessionStore();

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

    toast.success('Virtual Tabletop Ready!');

    return () => {
      canvas.dispose();
    };
  }, []);

  // Update grid when settings change
  useEffect(() => {
    if (fabricCanvas) {
      drawGrid(fabricCanvas, gridType, gridSize, isGridVisible);
    }
  }, [fabricCanvas, gridType, gridSize, isGridVisible]);

  // Handle token movement
  useEffect(() => {
    if (!fabricCanvas) return;

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
      }
    };

    const handleObjectMoved = (e: any) => {
      const obj = e.target;
      if (obj.tokenId) {
        updateTokenPosition(obj.tokenId, obj.left, obj.top);
        toast.info('Token moved');
      }
    };

    fabricCanvas.on('object:moving', handleObjectMoving);
    fabricCanvas.on('object:modified', handleObjectMoved);

    return () => {
      fabricCanvas.off('object:moving', handleObjectMoving);
      fabricCanvas.off('object:modified', handleObjectMoved);
    };
  }, [fabricCanvas, gridType, gridSize, updateTokenPosition]);

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

  const addTokenToCanvas = (imageUrl: string, x: number = 100, y: number = 100) => {
    if (!fabricCanvas) return;

    FabricImage.fromURL(imageUrl).then((img) => {
      const tokenId = Date.now().toString();
      img.set({
        left: x,
        top: y,
        scaleX: 0.5,
        scaleY: 0.5,
        tokenId,
        hasControls: true,
        hasBorders: true,
        borderColor: 'hsl(var(--token-selection))',
        cornerColor: 'hsl(var(--accent))',
      } as any);

      fabricCanvas.add(img);
      addToken({
        id: tokenId,
        imageUrl,
        x,
        y,
        name: `Token ${tokenId}`,
      });
      
      toast.success('Token added to map');
    }).catch(() => {
      toast.error('Failed to load token image');
    });
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header Toolbar */}
      <Toolbar sessionId={sessionId} />
      
      <div className="flex-1 flex">
        {/* Left Panel */}
        <div className="w-64 bg-card border-r border-border flex flex-col">
          <GridControls
            gridType={gridType}
            gridSize={gridSize}
            isGridVisible={isGridVisible}
            onGridTypeChange={setGridType}
            onGridSizeChange={setGridSize}
            onGridVisibilityChange={setIsGridVisible}
          />
          
          <TokenPanel onAddToken={addTokenToCanvas} />
          
          <MapControls fabricCanvas={fabricCanvas} />
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 p-4">
          <div className="canvas-container rounded-lg overflow-hidden shadow-lg">
            <canvas 
              ref={canvasRef} 
              className="max-w-full max-h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};