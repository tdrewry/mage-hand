import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CanvasRegion } from '@/stores/regionStore';
import { ImageImportModal, ImageImportResult, ShapeConfig } from './ImageImportModal';
import { toast } from 'sonner';
import { Image, Trash2 } from 'lucide-react';
import { saveRegionTexture, removeRegionTexture, hashImageData, saveTextureByHash } from '@/lib/textureStorage';

interface RegionBackgroundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region: CanvasRegion | null;
  onUpdateRegion: (id: string, updates: Partial<CanvasRegion>) => void;
}

export const RegionBackgroundModal = ({ 
  open, 
  onOpenChange, 
  region,
  onUpdateRegion 
}: RegionBackgroundModalProps) => {
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [backgroundScale, setBackgroundScale] = useState(1);
  const [backgroundRepeat, setBackgroundRepeat] = useState<'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'>('repeat');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [showImageImport, setShowImageImport] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Track the original URL when modal opens so we know if anything changed
  const [originalUrl, setOriginalUrl] = useState('');

  useEffect(() => {
    if (region && open) {
      const url = region.backgroundImage || '';
      setBackgroundUrl(url);
      setOriginalUrl(url);
      setBackgroundScale(region.backgroundScale || 1);
      setBackgroundRepeat(region.backgroundRepeat || 'repeat');
      setOffsetX(region.backgroundOffsetX || 0);
      setOffsetY(region.backgroundOffsetY || 0);
    }
  }, [region, open]);

  // Build shape config based on region type
  const getShapeConfig = (): ShapeConfig => {
    if (!region) {
      return { type: 'rectangle', width: 200, height: 200 };
    }

    if (region.regionType === 'path' && region.pathPoints && region.pathPoints.length > 0) {
      const minX = Math.min(...region.pathPoints.map(p => p.x));
      const maxX = Math.max(...region.pathPoints.map(p => p.x));
      const minY = Math.min(...region.pathPoints.map(p => p.y));
      const maxY = Math.max(...region.pathPoints.map(p => p.y));
      const pathWidth = maxX - minX || 1;
      const pathHeight = maxY - minY || 1;

      const normalizedPoints = region.pathPoints.map(p => ({
        x: (p.x - minX) / pathWidth,
        y: (p.y - minY) / pathHeight
      }));

      return {
        type: 'path',
        width: region.width,
        height: region.height,
        pathPoints: normalizedPoints
      };
    }

    return {
      type: 'rectangle',
      width: region.width,
      height: region.height
    };
  };

  const handleImageImportConfirm = (result: ImageImportResult) => {
    setBackgroundUrl(result.imageUrl);
    setBackgroundScale(result.scale);
    setOffsetX(result.offsetX);
    setOffsetY(result.offsetY);
    setShowImageImport(false);
  };

  // Stage a remove — does NOT apply immediately. User must click Apply Changes.
  const stageRemove = () => {
    setBackgroundUrl('');
    setBackgroundScale(1);
    setBackgroundRepeat('repeat');
    setOffsetX(0);
    setOffsetY(0);
  };

  const applyBackground = async () => {
    if (!region) return;
    setIsApplying(true);

    try {
      if (backgroundUrl) {
        // ── New/changed image: hash, save to IDB, stamp on region, push to Jazz ──
        let textureHash: string | undefined;
        try {
          // saveRegionTexture handles hash computation + IDB in one step
          textureHash = await saveRegionTexture(region.id, backgroundUrl);
          // Also save by raw hash so pushTexturesToJazz (which keys by hash) can find it
          if (textureHash) {
            await saveTextureByHash(textureHash, backgroundUrl);
          }
        } catch (error) {
          // Fallback: compute hash manually if saveRegionTexture fails
          console.error('[RegionBackground] saveRegionTexture failed, falling back:', error);
          try {
            textureHash = await hashImageData(backgroundUrl);
            await saveTextureByHash(textureHash, backgroundUrl);
          } catch (e2) {
            console.error('[RegionBackground] Fallback hash also failed:', e2);
          }
        }

        onUpdateRegion(region.id, {
          backgroundImage: backgroundUrl,
          textureHash,
          backgroundScale,
          backgroundRepeat,
          backgroundOffsetX: offsetX,
          backgroundOffsetY: offsetY,
        });

        // Explicitly trigger Jazz FileStream push — belt+suspenders alongside the Zustand watcher
        // in bridge.ts which keys on textureHash changes.
        if (textureHash) {
          Promise.all([
            import('@/lib/jazz/textureSync'),
            import('@/lib/jazz/bridge'),
          ]).then(async ([{ pushTexturesToJazz }, { getSessionRoot }]) => {
            try {
              const sessionRoot = getSessionRoot();
              if (sessionRoot) {
                await pushTexturesToJazz(sessionRoot);
              }
            } catch (e) {
              // Jazz not active — sync will happen next time bridge pushes
            }
          });
        }

        toast.success('Region background updated');
      } else {
        // ── Staged remove: clear IDB reference and wipe region fields ──
        try {
          await removeRegionTexture(region.id);
        } catch (error) {
          console.error('[RegionBackground] Failed to remove texture from IDB:', error);
        }

        onUpdateRegion(region.id, {
          backgroundImage: undefined,
          textureHash: undefined,
          backgroundScale: 1,
          backgroundRepeat: 'repeat',
          backgroundOffsetX: 0,
          backgroundOffsetY: 0,
        });

        toast.success('Region background removed');
      }

      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  };

  // Apply is enabled when something has actually changed from what the region had on open
  const hasChanges = backgroundUrl !== originalUrl || 
    backgroundScale !== (region?.backgroundScale || 1) ||
    backgroundRepeat !== (region?.backgroundRepeat || 'repeat') ||
    offsetX !== (region?.backgroundOffsetX || 0) ||
    offsetY !== (region?.backgroundOffsetY || 0);
  const canApply = hasChanges && !isApplying;

  if (!region) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Region Background</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image Preview / Select Button */}
            <div className="space-y-2">
              <Label>Background Image</Label>
              {backgroundUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img 
                    src={backgroundUrl} 
                    alt="Background preview" 
                    className="w-full h-32 object-cover"
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
                      onClick={stageRemove}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    Scale: {(backgroundScale * 100).toFixed(0)}% | Offset: ({offsetX.toFixed(0)}, {offsetY.toFixed(0)})
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full h-24 border-dashed"
                    onClick={() => setShowImageImport(true)}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Image className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click to select image</span>
                    </div>
                  </Button>
                  {/* Inform user when a remove has been staged */}
                  {originalUrl && (
                    <p className="text-xs text-muted-foreground text-center">
                      Background staged for removal — click <strong>Apply Changes</strong> to confirm.
                    </p>
                  )}
                </div>
              )}
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

            {/* Action Buttons */}
            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
                Cancel
              </Button>
              <Button onClick={applyBackground} disabled={!canApply}>
                {isApplying ? 'Applying…' : 'Apply Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Import Modal */}
      <ImageImportModal
        open={showImageImport}
        onOpenChange={setShowImageImport}
        onConfirm={handleImageImportConfirm}
        shape={getShapeConfig()}
        title="Select Region Background"
        description="Position the image as a repeating texture for the region background."
        initialImageUrl={backgroundUrl}
        initialScale={backgroundScale}
        initialOffsetX={offsetX}
        initialOffsetY={offsetY}
      />
    </>
  );
};
