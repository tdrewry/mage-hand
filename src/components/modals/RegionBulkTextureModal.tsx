import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useRegionStore, type CanvasRegion } from '@/stores/regionStore';
import { ImageImportModal, ImageImportResult } from './ImageImportModal';
import { toast } from 'sonner';
import { Image, Trash2, Upload, Grid, AlertTriangle, Move, RotateCcw } from 'lucide-react';
import { saveRegionTexture, removeRegionTexture } from '@/lib/textureStorage';
import { uploadTexture } from '@/lib/textureSync';

interface RegionBulkTextureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRegionIds: string[];
  onUpdateCanvas?: () => void;
}

export const RegionBulkTextureModal = ({ 
  open, 
  onOpenChange, 
  selectedRegionIds,
  onUpdateCanvas 
}: RegionBulkTextureModalProps) => {
  const { regions, updateRegion } = useRegionStore();
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [backgroundScale, setBackgroundScale] = useState(1);
  const [backgroundRepeat, setBackgroundRepeat] = useState<'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'>('repeat');
  const [worldAligned, setWorldAligned] = useState(true); // Default to world-aligned for continuous textures
  const [showImageImport, setShowImageImport] = useState(false);
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
  const [hasMixedTextures, setHasMixedTextures] = useState(false);
  
  // Preview pan/zoom state
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPanX, setPreviewPanX] = useState(0);
  const [previewPanY, setPreviewPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const selectedRegions = regions.filter(r => selectedRegionIds.includes(r.id));

  // Analyze selected regions for common texture settings
  const textureAnalysis = useMemo(() => {
    if (selectedRegions.length === 0) {
      return { commonTexture: null, commonScale: 1, commonRepeat: 'repeat' as const, commonWorldAligned: true, allSame: true, hasTextures: false };
    }

    const texturedRegions = selectedRegions.filter(r => r.backgroundImage);
    if (texturedRegions.length === 0) {
      return { commonTexture: null, commonScale: 1, commonRepeat: 'repeat' as const, commonWorldAligned: true, allSame: true, hasTextures: false };
    }

    const firstTexture = texturedRegions[0].backgroundImage;
    const firstScale = texturedRegions[0].backgroundScale || 1;
    const firstRepeat = texturedRegions[0].backgroundRepeat || 'repeat';
    const firstHash = texturedRegions[0].textureHash;
    
    // Determine if world-aligned based on offset pattern
    // World-aligned regions have offsets calculated from world origin
    // We can infer this by checking if offsets are non-zero (world-aligned usually has calculated offsets)
    const firstHasOffset = (texturedRegions[0].backgroundOffsetX !== 0 || texturedRegions[0].backgroundOffsetY !== 0);

    // Check if all textured regions have the same texture (comparing by hash if available, otherwise URL)
    const allSame = texturedRegions.every(r => {
      const sameTexture = firstHash 
        ? r.textureHash === firstHash 
        : r.backgroundImage === firstTexture;
      const sameScale = (r.backgroundScale || 1) === firstScale;
      const sameRepeat = (r.backgroundRepeat || 'repeat') === firstRepeat;
      return sameTexture && sameScale && sameRepeat;
    });

    return {
      commonTexture: firstTexture,
      commonScale: firstScale,
      commonRepeat: firstRepeat as 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y',
      commonWorldAligned: firstHasOffset, // Infer from offset presence
      allSame,
      hasTextures: true
    };
  }, [selectedRegions]);

  // Initialize state when modal opens
  useEffect(() => {
    if (open) {
      if (textureAnalysis.hasTextures && textureAnalysis.allSame && textureAnalysis.commonTexture) {
        // All selected regions have the same texture - pre-populate
        setBackgroundUrl(textureAnalysis.commonTexture);
        setBackgroundScale(textureAnalysis.commonScale);
        setBackgroundRepeat(textureAnalysis.commonRepeat);
        setWorldAligned(textureAnalysis.commonWorldAligned);
        setHasMixedTextures(false);
      } else if (textureAnalysis.hasTextures && !textureAnalysis.allSame) {
        // Mixed textures - show warning, start fresh
        setBackgroundUrl('');
        setBackgroundScale(1);
        setBackgroundRepeat('repeat');
        setWorldAligned(true);
        setHasMixedTextures(true);
      } else {
        // No textures - start fresh
        setBackgroundUrl('');
        setBackgroundScale(1);
        setBackgroundRepeat('repeat');
        setWorldAligned(true);
        setHasMixedTextures(false);
      }
      // Reset preview pan/zoom when modal opens
      setPreviewZoom(1);
      setPreviewPanX(0);
      setPreviewPanY(0);
    }
  }, [open, textureAnalysis]);

  // Load preview image when URL changes
  useEffect(() => {
    if (backgroundUrl) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setPreviewImage(img);
      };
      img.src = backgroundUrl;
    } else {
      setPreviewImage(null);
    }
  }, [backgroundUrl]);

  // Preview pan handlers
  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - previewPanX, y: e.clientY - previewPanY });
  }, [previewPanX, previewPanY]);

  const handlePreviewMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    setPreviewPanX(e.clientX - panStart.x);
    setPreviewPanY(e.clientY - panStart.y);
  }, [isPanning, panStart]);

  const handlePreviewMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Attach global mouse listeners for panning
  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handlePreviewMouseMove);
      window.addEventListener('mouseup', handlePreviewMouseUp);
      return () => {
        window.removeEventListener('mousemove', handlePreviewMouseMove);
        window.removeEventListener('mouseup', handlePreviewMouseUp);
      };
    }
  }, [isPanning, handlePreviewMouseMove, handlePreviewMouseUp]);

  // Preview zoom handler
  const handlePreviewWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setPreviewZoom(prev => Math.max(0.25, Math.min(4, prev + delta)));
  }, []);

  // Reset preview view
  const resetPreviewView = useCallback(() => {
    setPreviewZoom(1);
    setPreviewPanX(0);
    setPreviewPanY(0);
  }, []);

  // Draw preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !previewImage || selectedRegions.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate bounds of all selected regions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedRegions.forEach(region => {
      if (region.regionType === 'path' && region.pathPoints) {
        region.pathPoints.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      } else {
        minX = Math.min(minX, region.x);
        minY = Math.min(minY, region.y);
        maxX = Math.max(maxX, region.x + region.width);
        maxY = Math.max(maxY, region.y + region.height);
      }
    });

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const padding = 20;

    // Calculate base scale to fit in preview (before user zoom)
    const baseScale = Math.min(
      (canvas.width - padding * 2) / boundsWidth,
      (canvas.height - padding * 2) / boundsHeight
    );
    
    // Apply user zoom
    const finalScale = baseScale * previewZoom;

    // Clear canvas
    ctx.fillStyle = 'hsl(var(--muted))';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // Apply pan and zoom transforms
    // Center the view, then apply user pan offset
    const centerX = canvas.width / 2 + previewPanX;
    const centerY = canvas.height / 2 + previewPanY;
    const boundsCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    
    ctx.translate(centerX, centerY);
    ctx.scale(finalScale, finalScale);
    ctx.translate(-boundsCenter.x, -boundsCenter.y);

    // Draw each region with texture preview
    selectedRegions.forEach(region => {
      ctx.save();

      // Create clip path
      ctx.beginPath();
      if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 2) {
        ctx.moveTo(region.pathPoints[0].x, region.pathPoints[0].y);
        for (let i = 1; i < region.pathPoints.length; i++) {
          ctx.lineTo(region.pathPoints[i].x, region.pathPoints[i].y);
        }
        ctx.closePath();
      } else {
        ctx.rect(region.x, region.y, region.width, region.height);
      }
      ctx.clip();

      // Calculate world-aligned offset if enabled
      const scaledWidth = previewImage.naturalWidth * backgroundScale;
      const scaledHeight = previewImage.naturalHeight * backgroundScale;

      let regionMinX = region.x;
      let regionMinY = region.y;
      if (region.regionType === 'path' && region.pathPoints) {
        regionMinX = Math.min(...region.pathPoints.map(p => p.x));
        regionMinY = Math.min(...region.pathPoints.map(p => p.y));
      }

      // World-aligned: offset based on world position
      // Region-aligned: start texture at region's top-left
      const offsetX = worldAligned ? -(regionMinX % scaledWidth) : 0;
      const offsetY = worldAligned ? -(regionMinY % scaledHeight) : 0;

      // Create pattern
      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = Math.ceil(scaledWidth);
      patternCanvas.height = Math.ceil(scaledHeight);
      const patternCtx = patternCanvas.getContext('2d');
      if (patternCtx) {
        patternCtx.drawImage(previewImage, 0, 0, scaledWidth, scaledHeight);
        const pattern = ctx.createPattern(patternCanvas, backgroundRepeat);
        if (pattern) {
          const matrix = new DOMMatrix();
          matrix.translateSelf(regionMinX + offsetX, regionMinY + offsetY);
          pattern.setTransform(matrix);
          ctx.fillStyle = pattern;
          ctx.fillRect(region.x - scaledWidth, region.y - scaledHeight, 
                       region.width + scaledWidth * 2, region.height + scaledHeight * 2);
        }
      }

      // Draw region outline
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2 / finalScale;
      ctx.stroke();

      ctx.restore();
    });

    ctx.restore();
  }, [previewImage, selectedRegions, backgroundScale, backgroundRepeat, worldAligned, previewZoom, previewPanX, previewPanY]);

  const handleImageImportConfirm = (result: ImageImportResult) => {
    setBackgroundUrl(result.imageUrl);
    setBackgroundScale(result.scale);
    setShowImageImport(false);
  };

  const applyTexture = async () => {
    if (!backgroundUrl || !previewImage) {
      toast.error('Please select an image first');
      return;
    }

    // Re-fetch regions fresh from store to ensure we have latest state
    const currentRegions = useRegionStore.getState().regions;
    const regionsToUpdate = currentRegions.filter(r => selectedRegionIds.includes(r.id));
    
    if (regionsToUpdate.length === 0) {
      toast.error('No regions selected');
      return;
    }

    const scaledWidth = previewImage.naturalWidth * backgroundScale;
    const scaledHeight = previewImage.naturalHeight * backgroundScale;

    // Calculate the largest region dimensions for compression
    let maxRegionWidth = 0;
    let maxRegionHeight = 0;
    regionsToUpdate.forEach(region => {
      maxRegionWidth = Math.max(maxRegionWidth, region.width);
      maxRegionHeight = Math.max(maxRegionHeight, region.height);
    });

    // Save texture to IndexedDB for persistence (with deduplication)
    // All regions will share the same texture hash
    let textureHash: string | undefined;
    try {
      // Save for first region to get the hash
      textureHash = await saveRegionTexture(regionsToUpdate[0].id, backgroundUrl);
      
      // Upload to server for multiplayer sync - use largest region size for compression
      if (textureHash) {
        await uploadTexture(textureHash, backgroundUrl, maxRegionWidth, maxRegionHeight);
      }
      
      // Save for remaining regions
      await Promise.all(regionsToUpdate.slice(1).map(region => 
        saveRegionTexture(region.id, backgroundUrl)
      ));
    } catch (error) {
      console.error('Failed to persist texture to IndexedDB:', error);
      // Continue anyway - texture will work in current session
    }

    regionsToUpdate.forEach(region => {
      let regionMinX = region.x;
      let regionMinY = region.y;
      if (region.regionType === 'path' && region.pathPoints) {
        regionMinX = Math.min(...region.pathPoints.map(p => p.x));
        regionMinY = Math.min(...region.pathPoints.map(p => p.y));
      }

      // Calculate world-space offset for continuous tiling
      // The texture pattern is conceptually "painted" at world origin (0,0)
      // Each region reveals the portion of the pattern at its position
      const offsetX = worldAligned ? -(regionMinX % scaledWidth) : 0;
      const offsetY = worldAligned ? -(regionMinY % scaledHeight) : 0;

      updateRegion(region.id, {
        backgroundImage: backgroundUrl,
        textureHash, // Include hash for sync
        backgroundScale,
        backgroundRepeat,
        backgroundOffsetX: offsetX,
        backgroundOffsetY: offsetY
      });
    });

    onUpdateCanvas?.();
    toast.success(`Applied texture to ${regionsToUpdate.length} region(s)`);
    onOpenChange(false);
  };

  const clearTexture = async () => {
    // Re-fetch regions fresh from store to ensure we have latest state
    const currentRegions = useRegionStore.getState().regions;
    const regionsToUpdate = currentRegions.filter(r => selectedRegionIds.includes(r.id));
    
    // Remove from IndexedDB
    try {
      await Promise.all(regionsToUpdate.map(region => 
        removeRegionTexture(region.id)
      ));
    } catch (error) {
      console.error('Failed to remove textures from IndexedDB:', error);
    }
    
    regionsToUpdate.forEach(region => {
      updateRegion(region.id, {
        backgroundImage: undefined,
        textureHash: undefined, // Clear hash for sync
        backgroundScale: 1,
        backgroundRepeat: 'repeat',
        backgroundOffsetX: 0,
        backgroundOffsetY: 0
      });
    });

    setBackgroundUrl('');
    setBackgroundScale(1);
    setBackgroundRepeat('repeat');
    onUpdateCanvas?.();
    toast.success(`Cleared texture from ${regionsToUpdate.length} region(s)`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply Texture to {selectedRegions.length} Region(s)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Mixed textures warning */}
            {hasMixedTextures && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Mixed Textures Detected</p>
                  <p className="text-muted-foreground">
                    Selected regions have different textures. Applying a new texture will override all existing textures.
                  </p>
                </div>
              </div>
            )}

            {/* Image Selection */}
            <div className="space-y-2">
              <Label>Background Texture</Label>
              {backgroundUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img 
                    src={backgroundUrl} 
                    alt="Texture preview" 
                    className="w-full h-24 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setShowImageImport(true)}
                    >
                      <Image className="h-4 w-4 mr-1" />
                      Change
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={clearTexture}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full h-20 border-dashed"
                  onClick={() => setShowImageImport(true)}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Select texture image</span>
                  </div>
                </Button>
              )}
            </div>

            {/* Preview Canvas */}
            {backgroundUrl && selectedRegions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Preview</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {(previewZoom * 100).toFixed(0)}%
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2"
                      onClick={resetPreviewView}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>
                <div
                  ref={previewContainerRef}
                  className="relative rounded-lg border border-border bg-muted overflow-hidden cursor-grab active:cursor-grabbing"
                  onMouseDown={handlePreviewMouseDown}
                  onWheel={handlePreviewWheel}
                >
                  <canvas 
                    ref={previewCanvasRef}
                    width={400}
                    height={200}
                    className="w-full"
                  />
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1 text-xs text-white/70 bg-black/50 rounded px-2 py-1">
                    <Move className="h-3 w-3" />
                    Drag to pan • Scroll to zoom
                  </div>
                </div>
              </div>
            )}

            {/* Scale Slider */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Scale</Label>
                <span className="text-sm text-muted-foreground">{(backgroundScale * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[backgroundScale]}
                onValueChange={([value]) => setBackgroundScale(value)}
                min={0.1}
                max={3}
                step={0.05}
              />
            </div>

            {/* Repeat Mode */}
            <div className="space-y-2">
              <Label>Repeat Mode</Label>
              <Select 
                value={backgroundRepeat} 
                onValueChange={(value: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y') => setBackgroundRepeat(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repeat">Repeat (Tile)</SelectItem>
                  <SelectItem value="no-repeat">No Repeat</SelectItem>
                  <SelectItem value="repeat-x">Repeat Horizontally</SelectItem>
                  <SelectItem value="repeat-y">Repeat Vertically</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* World Alignment Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>World-Aligned (Continuous)</Label>
                <p className="text-xs text-muted-foreground">
                  Texture appears continuous across all regions
                </p>
              </div>
              <Switch
                checked={worldAligned}
                onCheckedChange={setWorldAligned}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={applyTexture} disabled={!backgroundUrl}>
              <Grid className="h-4 w-4 mr-1" />
              Apply to {selectedRegions.length} Region(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Import Modal */}
      <ImageImportModal
        open={showImageImport}
        onOpenChange={setShowImageImport}
        onConfirm={handleImageImportConfirm}
        shape={{ type: 'rectangle', width: 200, height: 200 }}
        title="Select Texture Image"
        description="Choose an image to use as a repeating texture across selected regions."
        initialImageUrl={backgroundUrl}
        initialScale={backgroundScale}
      />
    </>
  );
};
