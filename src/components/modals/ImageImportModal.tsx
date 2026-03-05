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
import { Upload, Link, ZoomIn, ZoomOut, Move, RotateCcw, Repeat } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export interface ImageImportResult {
  imageUrl: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  repeat?: boolean;
}

export type ShapeType = 'circle' | 'rectangle' | 'path';

export interface ShapeConfig {
  type: ShapeType;
  // For circles: width = height = diameter
  // For rectangles: width and height
  // For paths: bounding box width/height, with optional pathPoints for precise shape
  width: number;
  height: number;
  // Optional path points for complex shapes (normalized 0-1 coordinates)
  pathPoints?: { x: number; y: number }[];
}

interface ImageImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: ImageImportResult) => void;
  shape: ShapeConfig;
  title?: string;
  description?: string;
  initialImageUrl?: string;
  initialScale?: number;
  initialOffsetX?: number;
  initialOffsetY?: number;
  initialRepeat?: boolean;
  /** Show repeat/tile toggle in the modal */
  showRepeatToggle?: boolean;
}

export const ImageImportModal: React.FC<ImageImportModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  shape,
  title = 'Import Image',
  description = 'Upload or enter a URL for the image, then position it within the shape.',
  initialImageUrl = '',
  initialScale = 1,
  initialOffsetX = 0,
  initialOffsetY = 0,
  initialRepeat = false,
  showRepeatToggle = false,
}) => {
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file');
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [urlInput, setUrlInput] = useState('');
  const [scale, setScale] = useState(initialScale);
  const [offsetX, setOffsetX] = useState(initialOffsetX);
  const [offsetY, setOffsetY] = useState(initialOffsetY);
  const [repeat, setRepeat] = useState(initialRepeat);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Preview area size
  const PREVIEW_SIZE = 300;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setImageUrl(initialImageUrl);
      setUrlInput(initialImageUrl);
      setScale(initialScale);
      setOffsetX(initialOffsetX);
      setOffsetY(initialOffsetY);
      setRepeat(initialRepeat);
      setImageLoaded(false);
    }
  }, [open, initialImageUrl, initialScale, initialOffsetX, initialOffsetY, initialRepeat]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImageUrl(dataUrl);
      setImageLoaded(false);
    };
    reader.readAsDataURL(file);
  };

  // Handle URL submit
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    
    try {
      new URL(urlInput);
      setImageUrl(urlInput);
      setImageLoaded(false);
    } catch {
      toast.error('Please enter a valid URL');
    }
  };

  // Image loading is now handled in the useEffect that manages the canvas

  // Reset to defaults
  const handleReset = () => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setRepeat(false);
  };

  // Mouse/touch handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageLoaded) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle scroll for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.1, Math.min(5, prev + delta)));
  };

  // Draw preview with shape overlay
  const drawCanvas = useCallback((img?: HTMLImageElement) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = PREVIEW_SIZE * dpr;
    canvas.height = PREVIEW_SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Calculate shape dimensions to fit in preview
    const shapeAspect = shape.width / shape.height;
    let shapeW: number, shapeH: number;
    
    if (shapeAspect > 1) {
      shapeW = PREVIEW_SIZE * 0.8;
      shapeH = shapeW / shapeAspect;
    } else {
      shapeH = PREVIEW_SIZE * 0.8;
      shapeW = shapeH * shapeAspect;
    }
    
    const shapeX = (PREVIEW_SIZE - shapeW) / 2;
    const shapeY = (PREVIEW_SIZE - shapeH) / 2;

    // Draw checkerboard background (to show transparency)
    const checkerSize = 10;
    for (let y = 0; y < PREVIEW_SIZE; y += checkerSize) {
      for (let x = 0; x < PREVIEW_SIZE; x += checkerSize) {
        ctx.fillStyle = ((x + y) / checkerSize) % 2 === 0 ? '#333' : '#444';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    if (img && imageSize.width > 0) {
      // Create shape clipping path
      ctx.save();
      ctx.beginPath();
      
      if (shape.type === 'circle') {
        const radius = Math.min(shapeW, shapeH) / 2;
        ctx.arc(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, radius, 0, Math.PI * 2);
      } else if (shape.type === 'path' && shape.pathPoints && shape.pathPoints.length > 0) {
        // Draw custom path
        const points = shape.pathPoints;
        ctx.moveTo(shapeX + points[0].x * shapeW, shapeY + points[0].y * shapeH);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(shapeX + points[i].x * shapeW, shapeY + points[i].y * shapeH);
        }
        ctx.closePath();
      } else {
        // Rectangle
        ctx.rect(shapeX, shapeY, shapeW, shapeH);
      }
      
      ctx.clip();

      if (repeat) {
        // Tile/repeat mode: draw repeating pattern
        const scaledW = imageSize.width * scale * 0.5;
        const scaledH = imageSize.height * scale * 0.5;
        const patternOffsetX = offsetX % scaledW;
        const patternOffsetY = offsetY % scaledH;
        const startX = shapeX + patternOffsetX - scaledW;
        const startY = shapeY + patternOffsetY - scaledH;
        
        for (let py = startY; py < shapeY + shapeH + scaledH; py += scaledH) {
          for (let px = startX; px < shapeX + shapeW + scaledW; px += scaledW) {
            ctx.drawImage(img, px, py, scaledW, scaledH);
          }
        }
      } else {
        // Cover-fit mode: scale image to cover the shape, centered, with user scale & offset
        const imgAspect = imageSize.width / imageSize.height;
        const shapeAspectRatio = shapeW / shapeH;
        let drawW: number, drawH: number;
        if (imgAspect > shapeAspectRatio) {
          drawH = shapeH;
          drawW = shapeH * imgAspect;
        } else {
          drawW = shapeW;
          drawH = shapeW / imgAspect;
        }
        drawW *= scale;
        drawH *= scale;
        
        const cx = shapeX + shapeW / 2;
        const cy = shapeY + shapeH / 2;
        ctx.drawImage(img, cx - drawW / 2 + offsetX, cy - drawH / 2 + offsetY, drawW, drawH);
      }
      ctx.restore();
    }

    // Draw shape outline
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    
    if (shape.type === 'circle') {
      const radius = Math.min(shapeW, shapeH) / 2;
      ctx.arc(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, radius, 0, Math.PI * 2);
    } else if (shape.type === 'path' && shape.pathPoints && shape.pathPoints.length > 0) {
      const points = shape.pathPoints;
      ctx.moveTo(shapeX + points[0].x * shapeW, shapeY + points[0].y * shapeH);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(shapeX + points[i].x * shapeW, shapeY + points[i].y * shapeH);
      }
      ctx.closePath();
    } else {
      ctx.rect(shapeX, shapeY, shapeW, shapeH);
    }
    
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw corner markers for the shape
    ctx.fillStyle = '#ffffff';
    const markerSize = 6;
    
    if (shape.type === 'rectangle') {
      // Corner markers
      ctx.fillRect(shapeX - markerSize/2, shapeY - markerSize/2, markerSize, markerSize);
      ctx.fillRect(shapeX + shapeW - markerSize/2, shapeY - markerSize/2, markerSize, markerSize);
      ctx.fillRect(shapeX - markerSize/2, shapeY + shapeH - markerSize/2, markerSize, markerSize);
      ctx.fillRect(shapeX + shapeW - markerSize/2, shapeY + shapeH - markerSize/2, markerSize, markerSize);
    }
  }, [shape, imageSize, scale, offsetX, offsetY]);

  // Store loaded image reference for redrawing
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Load image and draw canvas when imageUrl changes or when parameters change
  useEffect(() => {
    if (!imageUrl) {
      loadedImageRef.current = null;
      drawCanvas();
      return;
    }

    // If we already have a loaded image with the same URL, just redraw
    if (loadedImageRef.current && loadedImageRef.current.src === imageUrl && imageLoaded) {
      drawCanvas(loadedImageRef.current);
      return;
    }

    // Load the image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
      drawCanvas(img);
    };
    img.onerror = () => {
      loadedImageRef.current = null;
      setImageLoaded(false);
      drawCanvas();
      // Show appropriate error message
      if (imageUrl.startsWith('data:')) {
        toast.error('Failed to load image data');
      } else {
        toast.error('Failed to load image - the server may block cross-origin requests. Try uploading the image file instead.');
      }
    };
    img.src = imageUrl;
  }, [imageUrl, drawCanvas, imageLoaded]);

  // Redraw when parameters change and we have a loaded image
  useEffect(() => {
    if (loadedImageRef.current && imageLoaded) {
      drawCanvas(loadedImageRef.current);
    }
  }, [scale, offsetX, offsetY, imageLoaded, drawCanvas]);

  const handleConfirm = () => {
    if (!imageUrl) {
      toast.error('Please select an image first');
      return;
    }
    
    onConfirm({
      imageUrl,
      scale,
      offsetX,
      offsetY,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={inputMode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('file')}
              className="flex-1"
            >
              <Upload className="mr-1 h-3 w-3" />
              Upload
            </Button>
            <Button
              variant={inputMode === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('url')}
              className="flex-1"
            >
              <Link className="mr-1 h-3 w-3" />
              URL
            </Button>
          </div>

          {/* File/URL input */}
          {inputMode === 'file' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose Image File
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.png"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              />
              <Button size="sm" onClick={handleUrlSubmit}>
                Load
              </Button>
            </div>
          )}

          {/* Preview area */}
          <div
            ref={previewRef}
            className="relative mx-auto border rounded-lg overflow-hidden bg-muted cursor-move"
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
          >
            <canvas
              ref={canvasRef}
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            />
            
            {/* Image loading is handled in useEffect */}

            {/* Instructions overlay */}
            {!imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                Select an image to preview
              </div>
            )}
            
            {imageUrl && imageLoaded && (
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1 text-xs text-white/70 bg-black/50 rounded px-2 py-1">
                <Move className="h-3 w-3" />
                Drag to pan • Scroll to zoom
              </div>
            )}
          </div>

          {/* Scale control */}
          {imageLoaded && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Scale: {scale.toFixed(2)}x</Label>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <ZoomOut className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[scale]}
                  onValueChange={([v]) => setScale(v)}
                  min={0.1}
                  max={5}
                  step={0.05}
                  className="flex-1"
                />
                <ZoomIn className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Offset: ({offsetX.toFixed(0)}, {offsetY.toFixed(0)})
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!imageUrl || !imageLoaded}>
            Apply Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
