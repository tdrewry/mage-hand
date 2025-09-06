import paper from 'paper';

export interface PaperViewport {
  center: paper.Point;
  zoom: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PaperToken {
  id: string;
  raster: paper.Raster;
  label?: paper.PointText;
  position: paper.Point;
  gridPosition?: paper.Point;
  color?: string;
}

export interface PaperMapRegion {
  id: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  gridType: 'square' | 'hex';
  gridSize: number;
  gridColor: string;
  gridOpacity: number;
  background?: paper.Raster;
  gridPath?: paper.Path;
}

export interface PaperGameMap {
  id: string;
  name: string;
  group: paper.Group;
  background?: paper.Raster;
  regions: PaperMapRegion[];
  zIndex: number;
  visible: boolean;
}

export class PaperMapSystem {
  private project: paper.Project;
  private canvas: HTMLCanvasElement;
  private tokens: Map<string, PaperToken> = new Map();
  private maps: Map<string, PaperGameMap> = new Map();
  private selectedTokens: Set<string> = new Set();
  private panTool?: paper.Tool;
  private selectTool?: paper.Tool;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.project = new paper.Project(canvas);
    this.setupTools();
  }

  private setupTools() {
    // Setup pan tool
    this.panTool = new paper.Tool();
    this.panTool.onMouseDrag = (event) => {
      this.project.view.translate(event.delta);
    };

    // Setup select tool  
    this.selectTool = new paper.Tool();
    this.selectTool.onMouseDown = (event) => {
      const hitTest = this.project.hitTest(event.point);
      if (hitTest?.item) {
        const tokenId = (hitTest.item as any).tokenId;
        if (tokenId) {
          this.selectToken(tokenId, !event.modifiers.shift);
        }
      } else {
        this.clearSelection();
      }
    };

    // Activate select tool by default
    this.selectTool.activate();
  }

  addMap(mapData: {
    id: string;
    name: string;
    imageUrl?: string;
    bounds: { x: number; y: number; width: number; height: number };
    zIndex: number;
  }): Promise<PaperGameMap> {
    return new Promise((resolve, reject) => {
      const mapGroup = new paper.Group();
      mapGroup.name = mapData.name;
      
      const paperMap: PaperGameMap = {
        id: mapData.id,
        name: mapData.name,
        group: mapGroup,
        regions: [],
        zIndex: mapData.zIndex,
        visible: true
      };

      if (mapData.imageUrl) {
        const raster = new paper.Raster(mapData.imageUrl);
        raster.onLoad = () => {
          raster.position = new paper.Point(
            mapData.bounds.x + mapData.bounds.width / 2,
            mapData.bounds.y + mapData.bounds.height / 2
          );
          raster.size = new paper.Size(mapData.bounds.width, mapData.bounds.height);
          mapGroup.addChild(raster);
          paperMap.background = raster;
          
          this.maps.set(mapData.id, paperMap);
          this.updateLayerOrder();
          resolve(paperMap);
        };
        raster.onError = reject;
      } else {
        this.maps.set(mapData.id, paperMap);
        this.updateLayerOrder();
        resolve(paperMap);
      }
    });
  }

  addMapRegion(mapId: string, regionData: {
    id: string;
    bounds: { x: number; y: number; width: number; height: number };
    gridType: 'square' | 'hex';
    gridSize: number;
    gridColor: string;
    gridOpacity: number;
  }): PaperMapRegion | null {
    const map = this.maps.get(mapId);
    if (!map) return null;

    const region: PaperMapRegion = {
      ...regionData,
      gridPath: this.createGridPath(regionData)
    };

    map.regions.push(region);
    map.group.addChild(region.gridPath!);
    
    return region;
  }

  private createGridPath(regionData: {
    bounds: { x: number; y: number; width: number; height: number };
    gridType: 'square' | 'hex';
    gridSize: number;
    gridColor: string;
    gridOpacity: number;
  }): paper.Path {
    const path = new paper.Path();
    path.strokeColor = regionData.gridColor as any;
    path.opacity = regionData.gridOpacity / 100;
    path.strokeWidth = 1;

    const { bounds, gridType, gridSize } = regionData;

    if (gridType === 'square') {
      // Draw vertical lines
      for (let x = bounds.x; x <= bounds.x + bounds.width; x += gridSize) {
        path.moveTo(new paper.Point(x, bounds.y));
        path.lineTo(new paper.Point(x, bounds.y + bounds.height));
      }
      
      // Draw horizontal lines
      for (let y = bounds.y; y <= bounds.y + bounds.height; y += gridSize) {
        path.moveTo(new paper.Point(bounds.x, y));
        path.lineTo(new paper.Point(bounds.x + bounds.width, y));
      }
    } else if (gridType === 'hex') {
      // Simplified hex grid - would need full hex math for production
      const hexWidth = gridSize;
      const hexHeight = gridSize * 0.866; // √3/2
      
      for (let row = 0; row * hexHeight < bounds.height; row++) {
        const y = bounds.y + row * hexHeight;
        const offset = (row % 2) * (hexWidth / 2);
        
        for (let col = 0; col * hexWidth + offset < bounds.width; col++) {
          const x = bounds.x + col * hexWidth + offset;
          this.drawHexagon(path, new paper.Point(x, y), hexWidth / 2);
        }
      }
    }

    return path;
  }

  private drawHexagon(path: paper.Path, center: paper.Point, radius: number) {
    const points: paper.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      points.push(new paper.Point(
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle)
      ));
    }
    
    path.moveTo(points[0]);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i]);
    }
    path.closePath();
  }

  addToken(tokenData: {
    id: string;
    imageUrl: string;
    position: paper.Point;
    label?: string;
    color?: string;
  }): Promise<PaperToken> {
    return new Promise((resolve, reject) => {
      const raster = new paper.Raster(tokenData.imageUrl);
      raster.onLoad = () => {
        raster.position = tokenData.position;
        (raster as any).tokenId = tokenData.id;
        
        const token: PaperToken = {
          id: tokenData.id,
          raster,
          position: tokenData.position,
          color: tokenData.color
        };

        if (tokenData.label) {
          const label = new paper.PointText(new paper.Point(
            tokenData.position.x,
            tokenData.position.y + raster.bounds.height / 2 + 15
          ));
          label.content = tokenData.label;
          label.fillColor = tokenData.color || '#ffffff' as any;
          label.fontSize = 12;
          label.justification = 'center' as any;
          token.label = label;
        }

        this.tokens.set(tokenData.id, token);
        this.updateLayerOrder();
        resolve(token);
      };
      raster.onError = reject;
    });
  }

  selectToken(tokenId: string, clearOthers: boolean = true) {
    if (clearOthers) {
      this.clearSelection();
    }
    
    this.selectedTokens.add(tokenId);
    const token = this.tokens.get(tokenId);
    if (token) {
      token.raster.selected = true;
    }
  }

  clearSelection() {
    this.selectedTokens.forEach(tokenId => {
      const token = this.tokens.get(tokenId);
      if (token) {
        token.raster.selected = false;
      }
    });
    this.selectedTokens.clear();
  }

  private updateLayerOrder() {
    const sortedMaps = Array.from(this.maps.values())
      .filter(map => map.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    // Remove all items
    this.project.activeLayer.removeChildren();

    // Add maps in order
    sortedMaps.forEach(map => {
      this.project.activeLayer.addChild(map.group);
    });

    // Add tokens on top
    this.tokens.forEach(token => {
      this.project.activeLayer.addChild(token.raster);
      if (token.label) {
        this.project.activeLayer.addChild(token.label);
      }
    });
  }

  snapToGrid(point: paper.Point): paper.Point {
    // Find the active region at this point
    for (const map of this.maps.values()) {
      if (!map.visible) continue;
      
      for (const region of map.regions) {
        const { bounds } = region;
        if (point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
            point.y >= bounds.y && point.y <= bounds.y + bounds.height) {
          
          if (region.gridType === 'square') {
            const snappedX = Math.round((point.x - bounds.x) / region.gridSize) * region.gridSize + bounds.x;
            const snappedY = Math.round((point.y - bounds.y) / region.gridSize) * region.gridSize + bounds.y;
            return new paper.Point(snappedX, snappedY);
          }
          // Add hex snapping logic here
        }
      }
    }
    
    return point;
  }

  getViewport(): PaperViewport {
    const view = this.project.view;
    return {
      center: view.center,
      zoom: view.zoom,
      bounds: {
        x: view.bounds.x,
        y: view.bounds.y,
        width: view.bounds.width,
        height: view.bounds.height
      }
    };
  }

  dispose() {
    this.project.remove();
  }
}