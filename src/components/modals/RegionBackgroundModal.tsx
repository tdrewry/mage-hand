import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CanvasRegion } from '@/stores/regionStore';
import { ImageImportModal, ImageImportResult, ShapeConfig } from './ImageImportModal';
import { toast } from 'sonner';
import { Image, Trash2 } from 'lucide-react';
import { saveRegionTexture, removeRegionTexture } from '@/lib/textureStorage';

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

  useEffect(() => {
    if (region && open) {
      setBackgroundUrl(region.backgroundImage || '');
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
      // Normalize path points to 0-1 range for the shape overlay
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

  const applyBackground = async () => {
    if (!region) return;

    // Save to IndexedDB for persistence
    try {
      await saveRegionTexture(region.id, backgroundUrl);
    } catch (error) {
      console.error('Failed to persist texture to IndexedDB:', error);
    }

    onUpdateRegion(region.id, {
      backgroundImage: backgroundUrl,
      backgroundScale,
      backgroundRepeat,
      backgroundOffsetX: offsetX,
      backgroundOffsetY: offsetY
    });

    toast.success('Region background updated');
    onOpenChange(false);
  };

  const clearBackground = async () => {
    if (!region) return;

    // Remove from IndexedDB
    try {
      await removeRegionTexture(region.id);
    } catch (error) {
      console.error('Failed to remove texture from IndexedDB:', error);
    }

    onUpdateRegion(region.id, {
      backgroundImage: undefined,
      backgroundScale: 1,
      backgroundRepeat: 'repeat',
      backgroundOffsetX: 0,
      backgroundOffsetY: 0
    });

    setBackgroundUrl('');
    setBackgroundScale(1);
    setBackgroundRepeat('repeat');
    setOffsetX(0);
    setOffsetY(0);

    toast.success('Region background cleared');
  };

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
                      onClick={clearBackground}
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={applyBackground} disabled={!backgroundUrl}>
                Apply Background
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
