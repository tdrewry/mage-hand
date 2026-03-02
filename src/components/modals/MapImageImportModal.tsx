/**
 * Modal for creating a new map from a source image.
 * Provides grid overlay preview, scale adjustment, and pixel-nudge controls
 * for precise grid alignment.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Upload,
  Link,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Grid3X3,
} from 'lucide-react';
import { toast } from 'sonner';

export interface MapImageImportResult {
  imageUrl: string;
  imageScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  naturalWidth: number;
  naturalHeight: number;
  gridSize: number;
  mapName: string;
}

interface MapImageImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: MapImageImportResult) => void;
}

export const MapImageImportModal: React.FC<MapImageImportModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [mapName, setMapName] = useState('New Map');
  const [imageScale, setImageScale] = useState(1);
  const [imageOffsetX, setImageOffsetX] = useState(0);
  const [imageOffsetY, setImageOffsetY] = useState(0);
  const [gridSize, setGridSize] = useState(40);
  const [showGrid, setShowGrid] = useState(true);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview viewport panning
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [viewZoom, setViewZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  const resetState = useCallback(() => {
    setImageUrl('');
    setUrlInput('');
    setMapName('New Map');
    setImageScale(1);
    setImageOffsetX(0);
    setImageOffsetY(0);
    setGridSize(40);
    setShowGrid(true);
    setNaturalSize({ width: 0, height: 0 });
    setViewOffset({ x: 0, y: 0 });
    setViewZoom(1);
    imageRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  // Load image when URL changes
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      // Auto-fit the view
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const fitZoom = Math.min(
          (canvas.width * 0.9) / img.naturalWidth,
          (canvas.height * 0.9) / img.naturalHeight
        );
        setViewZoom(fitZoom);
        setViewOffset({
          x: (canvas.width - img.naturalWidth * fitZoom) / 2,
          y: (canvas.height - img.naturalHeight * fitZoom) / 2,
        });
      }
    };
    img.onerror = () => toast.error('Failed to load image');
    img.src = imageUrl;
  }, [imageUrl]);

  // Render preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(viewOffset.x, viewOffset.y);
    ctx.scale(viewZoom, viewZoom);

    // Draw image
    if (imageRef.current && naturalSize.width > 0) {
      const sw = naturalSize.width * imageScale;
      const sh = naturalSize.height * imageScale;
      ctx.drawImage(imageRef.current, imageOffsetX, imageOffsetY, sw, sh);
    }

    // Draw grid overlay
    if (showGrid && gridSize > 0) {
      const scaledGrid = gridSize;
      const imgW = (naturalSize.width || 800) * imageScale;
      const imgH = (naturalSize.height || 600) * imageScale;

      // Extend grid beyond image to show alignment context
      const startX = imageOffsetX - scaledGrid * 2;
      const startY = imageOffsetY - scaledGrid * 2;
      const endX = imageOffsetX + imgW + scaledGrid * 2;
      const endY = imageOffsetY + imgH + scaledGrid * 2;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1 / viewZoom;

      // Vertical lines
      const firstCol = Math.floor(startX / scaledGrid) * scaledGrid;
      for (let x = firstCol; x <= endX; x += scaledGrid) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      // Horizontal lines
      const firstRow = Math.floor(startY / scaledGrid) * scaledGrid;
      for (let y = firstRow; y <= endY; y += scaledGrid) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }

      // Highlight image bounds
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 2 / viewZoom;
      ctx.setLineDash([6 / viewZoom, 4 / viewZoom]);
      ctx.strokeRect(imageOffsetX, imageOffsetY, imgW, imgH);
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Info overlay
    if (naturalSize.width > 0) {
      const scaledW = Math.round(naturalSize.width * imageScale);
      const scaledH = Math.round(naturalSize.height * imageScale);
      const cols = Math.round(scaledW / gridSize);
      const rows = Math.round(scaledH / gridSize);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(4, height - 24, 260, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      ctx.fillText(`${scaledW}×${scaledH}px · ${cols}×${rows} cells · grid ${gridSize}px`, 8, height - 10);
    }
  }, [viewOffset, viewZoom, imageScale, imageOffsetX, imageOffsetY, gridSize, showGrid, naturalSize]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      if (mapName === 'New Map') {
        setMapName(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlConfirm = () => {
    if (!urlInput.trim()) return;
    setImageUrl(urlInput.trim());
  };

  const handleConfirm = () => {
    if (!imageUrl || naturalSize.width === 0) {
      toast.error('Please load an image first');
      return;
    }
    onConfirm({
      imageUrl,
      imageScale,
      imageOffsetX,
      imageOffsetY,
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
      gridSize,
      mapName,
    });
    onOpenChange(false);
  };

  // Canvas mouse handlers for panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPanPoint.x;
    const dy = e.clientY - lastPanPoint.y;
    setViewOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPanPoint({ x: e.clientX, y: e.clientY });
  };
  const handleCanvasMouseUp = () => setIsPanning(false);
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setViewZoom((z) => Math.max(0.05, Math.min(10, z * factor)));
  };

  const computedCols = naturalSize.width > 0 ? Math.round((naturalSize.width * imageScale) / gridSize) : 0;
  const computedRows = naturalSize.height > 0 ? Math.round((naturalSize.height * imageScale) / gridSize) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" /> New Map from Image
          </DialogTitle>
          <DialogDescription>
            Upload or link to a map image. Adjust scaling and offset to align with the grid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Map name */}
          <div>
            <Label>Map Name</Label>
            <Input value={mapName} onChange={(e) => setMapName(e.target.value)} />
          </div>

          {/* Image source */}
          <div className="flex gap-2">
            <Button
              variant={inputMode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('file')}
            >
              <Upload className="h-4 w-4 mr-1" /> File
            </Button>
            <Button
              variant={inputMode === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('url')}
            >
              <Link className="h-4 w-4 mr-1" /> URL
            </Button>
          </div>
          {inputMode === 'file' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {imageUrl ? 'Change Image' : 'Choose Image File'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/map.jpg"
                onKeyDown={(e) => e.key === 'Enter' && handleUrlConfirm()}
              />
              <Button size="sm" onClick={handleUrlConfirm}>Load</Button>
            </div>
          )}

          {/* Preview canvas */}
          <div className="border rounded-md overflow-hidden bg-muted">
            <canvas
              ref={canvasRef}
              width={640}
              height={400}
              className="w-full cursor-grab active:cursor-grabbing"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onWheel={handleWheel}
            />
          </div>

          {/* Controls — only shown when image is loaded */}
          {naturalSize.width > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {/* Left column: scale & grid */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Image Scale: {imageScale.toFixed(2)}×</Label>
                  <div className="flex items-center gap-2">
                    <ZoomOut className="h-3 w-3 text-muted-foreground" />
                    <Slider
                      value={[imageScale]}
                      onValueChange={([v]) => setImageScale(v)}
                      min={0.1}
                      max={4}
                      step={0.01}
                    />
                    <ZoomIn className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Grid Size: {gridSize}px</Label>
                  <Slider
                    value={[gridSize]}
                    onValueChange={([v]) => setGridSize(v)}
                    min={10}
                    max={120}
                    step={1}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showGrid ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowGrid(!showGrid)}
                  >
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    {showGrid ? 'Grid On' : 'Grid Off'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImageScale(1);
                      setImageOffsetX(0);
                      setImageOffsetY(0);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Reset
                  </Button>
                </div>
                {/* Computed info */}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Image: {naturalSize.width}×{naturalSize.height}px</div>
                  <div>Scaled: {Math.round(naturalSize.width * imageScale)}×{Math.round(naturalSize.height * imageScale)}px</div>
                  <div>Grid: {computedCols}×{computedRows} cells</div>
                </div>
              </div>

              {/* Right column: nudge controls */}
              <div className="space-y-3">
                <Label className="text-xs">Pixel Nudge (offset: {imageOffsetX}, {imageOffsetY})</Label>
                <div className="flex flex-col items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setImageOffsetY((v) => v - 1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setImageOffsetX((v) => v - 1)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground border rounded-md">
                      1px
                    </div>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setImageOffsetX((v) => v + 1)}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setImageOffsetY((v) => v + 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
                {/* 10px nudge row */}
                <Label className="text-xs">10px Nudge</Label>
                <div className="flex flex-col items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setImageOffsetY((v) => v - 10)}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setImageOffsetX((v) => v - 10)}>
                      <ArrowLeft className="h-3 w-3" />
                    </Button>
                    <div className="h-7 w-7 flex items-center justify-center text-[10px] text-muted-foreground">10</div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setImageOffsetX((v) => v + 10)}>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setImageOffsetY((v) => v + 10)}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!imageUrl || naturalSize.width === 0}>
            Create Map
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
