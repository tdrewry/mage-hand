import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { Toolbar } from './Toolbar';
import { FloatingMenu } from './FloatingMenu';
import { TokenContextManager } from './TokenContextManager';
import { MapManager } from './MapManager';
import paper from 'paper';

interface Region {
  id: string;
  path: paper.Path;
  selected: boolean;
  handles: paper.Group | null;
}

interface Token {
  id: string;
  item: paper.Item;
  color: string;
  position: { x: number; y: number };
}

export const PaperTabletop = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { sessionId, tokens, addToken, updateTokenPosition, removeToken } = useSessionStore();
  const { } = useMapStore();
  
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [showMapManager, setShowMapManager] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize Paper.js
  useEffect(() => {
    if (!canvasRef.current) return;

    paper.setup(canvasRef.current);
    
    // Set up infinite canvas view
    paper.view.center = new paper.Point(0, 0);
    paper.view.zoom = 1;

    // Create initial tokens from store
    tokens.forEach(token => {
      createTokenItem(token);
    });

    // Set up mouse event handlers
    const tool = new paper.Tool();
    
    tool.onMouseDown = handleMouseDown;
    tool.onMouseDrag = handleMouseDrag;
    tool.onMouseUp = handleMouseUp;

    // Handle zoom with mouse wheel
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY;
      const zoomFactor = delta > 0 ? 0.9 : 1.1;
      
      const mousePoint = paper.view.viewToProject(new paper.Point(event.offsetX, event.offsetY));
      paper.view.zoom *= zoomFactor;
      
      const newMousePoint = paper.view.viewToProject(new paper.Point(event.offsetX, event.offsetY));
      const offset = mousePoint.subtract(newMousePoint);
      paper.view.center = paper.view.center.add(offset);
    };

    canvasRef.current.addEventListener('wheel', handleWheel);

    return () => {
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('wheel', handleWheel);
      }
      paper.project.clear();
    };
  }, []);

  const createTokenItem = (token: any) => {
    const circle = new paper.Path.Circle({
      center: new paper.Point(token.x || 0, token.y || 0),
      radius: 20,
      fillColor: token.color || '#3b82f6',
      strokeColor: '#1e40af',
      strokeWidth: 2,
      data: { type: 'token', id: token.id }
    });

    const text = new paper.PointText({
      point: new paper.Point(token.x || 0, (token.y || 0) + 5),
      content: token.name || 'Token',
      fillColor: 'white',
      fontSize: 12,
      justification: 'center',
      data: { type: 'tokenText', id: token.id }
    });

    const group = new paper.Group([circle, text]);
    group.data = { type: 'token', id: token.id };
    
    return group;
  };

  const addRegion = () => {
    const regionId = `region-${Date.now()}`;
    const centerX = paper.view.center.x;
    const centerY = paper.view.center.y;
    
    // Create a 20x40 rectangle region
    const rectangle = new paper.Rectangle(
      new paper.Point(centerX - 10, centerY - 20),
      new paper.Size(20, 40)
    );
    
    const path = new paper.Path.Rectangle(rectangle);
    path.fillColor = new paper.Color(0.29, 0.33, 0.39, 0.3); // Semi-transparent gray
    path.strokeColor = new paper.Color('#666');
    path.strokeWidth = 2;
    path.data = { type: 'region', id: regionId };

    const newRegion: Region = {
      id: regionId,
      path,
      selected: false,
      handles: null
    };

    setRegions(prev => [...prev, newRegion]);
    toast.success('Region added');
  };

  const createRegionHandles = (region: Region) => {
    if (region.handles) {
      region.handles.remove();
    }

    const bounds = region.path.bounds;
    const handleSize = 6 / paper.view.zoom;
    
    const handles = new paper.Group();
    
    // Corner handles
    const corners = [
      bounds.topLeft,
      bounds.topRight,
      bounds.bottomLeft,
      bounds.bottomRight
    ];

    corners.forEach((corner, index) => {
      const handle = new paper.Path.Rectangle({
        center: corner,
        size: new paper.Size(handleSize, handleSize),
        fillColor: '#4f46e5',
        strokeColor: '#3730a3',
        strokeWidth: 1,
        data: { type: 'regionHandle', regionId: region.id, handleType: 'corner', index }
      });
      handles.addChild(handle);
    });

    // Side handles
    const sides = [
      new paper.Point(bounds.center.x, bounds.top), // top
      new paper.Point(bounds.right, bounds.center.y), // right
      new paper.Point(bounds.center.x, bounds.bottom), // bottom
      new paper.Point(bounds.left, bounds.center.y) // left
    ];

    sides.forEach((side, index) => {
      const handle = new paper.Path.Rectangle({
        center: side,
        size: new paper.Size(handleSize, handleSize),
        fillColor: '#06b6d4',
        strokeColor: '#0891b2',
        strokeWidth: 1,
        data: { type: 'regionHandle', regionId: region.id, handleType: 'side', index }
      });
      handles.addChild(handle);
    });

    region.handles = handles;
    return handles;
  };

  const selectRegion = (regionId: string) => {
    setRegions(prev => prev.map(region => {
      if (region.id === regionId) {
        region.selected = true;
        createRegionHandles(region);
        return region;
      } else {
        region.selected = false;
        if (region.handles) {
          region.handles.remove();
          region.handles = null;
        }
        return region;
      }
    }));
    setSelectedRegion(regionId);
  };

  const deselectAllRegions = () => {
    setRegions(prev => prev.map(region => {
      region.selected = false;
      if (region.handles) {
        region.handles.remove();
        region.handles = null;
      }
      return region;
    }));
    setSelectedRegion(null);
  };

  const handleMouseDown = (event: paper.ToolEvent) => {
    const hitResult = paper.project.hitTest(event.point, {
      fill: true,
      stroke: true,
      tolerance: 5
    });

    if (hitResult) {
      const item = hitResult.item;
      const data = item.data;

      if (data.type === 'region') {
        selectRegion(data.id);
        setIsDragging(true);
      } else if (data.type === 'token') {
        setSelectedToken(data.id);
        setIsDragging(true);
      } else if (data.type === 'regionHandle') {
        // Handle region transformation
        setIsDragging(true);
      }
    } else {
      // Clicked on empty space
      deselectAllRegions();
      setSelectedToken(null);
      
      // Pan the view
      setIsDragging(true);
    }
  };

  const handleMouseDrag = (event: paper.ToolEvent) => {
    if (!isDragging) return;

    const hitResult = paper.project.hitTest(event.downPoint, {
      fill: true,
      stroke: true,
      tolerance: 5
    });

    if (hitResult) {
      const data = hitResult.item.data;
      
      if (data.type === 'region' && selectedRegion) {
        // Move region
        const region = regions.find(r => r.id === selectedRegion);
        if (region) {
          region.path.position = region.path.position.add(event.delta);
          if (region.handles) {
            region.handles.position = region.handles.position.add(event.delta);
          }
        }
      } else if (data.type === 'token' && selectedToken) {
        // Move token
        const tokenGroup = paper.project.getItems({
          data: { type: 'token', id: selectedToken }
        })[0];
        
        if (tokenGroup) {
          tokenGroup.position = tokenGroup.position.add(event.delta);
          
          // Update store
          updateTokenPosition(selectedToken, tokenGroup.position.x, tokenGroup.position.y);
        }
      }
    } else {
      // Pan the view
      paper.view.center = paper.view.center.subtract(event.delta);
    }
  };

  const handleMouseUp = (event: paper.ToolEvent) => {
    setIsDragging(false);
  };

  const addTokenToCanvas = (imageUrl?: string, x?: number, y?: number) => {
    const tokenId = `token-${Date.now()}`;
    const position = {
      x: x || paper.view.center.x,
      y: y || paper.view.center.y
    };
    
    const newToken = {
      id: tokenId,
      name: 'New Token',
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      x: position.x,
      y: position.y,
      gridWidth: 1,
      gridHeight: 1,
      label: 'New Token',
      imageUrl: imageUrl || ''
    };

    addToken(newToken);
    createTokenItem(newToken);
    toast.success('Token added');
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      <Toolbar
        sessionId={sessionId}
        addTokenToCanvas={addTokenToCanvas}
      />
      
      {/* Add Region Button */}
      <div className="absolute top-16 left-4 z-10">
        <button
          onClick={addRegion}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Add Region
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          width={window.innerWidth}
          height={window.innerHeight - 60}
        />
      </div>

      <TokenContextManager 
        fabricCanvas={null}
        onUpdateCanvas={() => paper.view.update()}
      />

      {showMapManager && (
        <MapManager onClose={() => setShowMapManager(false)} />
      )}
    </div>
  );
};