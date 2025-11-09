import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CanvasRegion } from '@/stores/regionStore';
import { toast } from 'sonner';

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
  const [backgroundRepeat, setBackgroundRepeat] = useState<'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'>('no-repeat');
  const [offsetX, setOffsetX] = useState([0]);
  const [offsetY, setOffsetY] = useState([0]);

  useEffect(() => {
    if (region && open) {
      setBackgroundUrl(region.backgroundImage || '');
      setBackgroundRepeat(region.backgroundRepeat || 'no-repeat');
      setOffsetX([region.backgroundOffsetX || 0]);
      setOffsetY([region.backgroundOffsetY || 0]);
    }
  }, [region, open]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setBackgroundUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyBackground = () => {
    if (!region) return;

    onUpdateRegion(region.id, {
      backgroundImage: backgroundUrl,
      backgroundRepeat,
      backgroundOffsetX: offsetX[0],
      backgroundOffsetY: offsetY[0]
    });

    toast.success('Region background updated');
    onOpenChange(false);
  };

  const clearBackground = () => {
    if (!region) return;

    onUpdateRegion(region.id, {
      backgroundImage: undefined,
      backgroundRepeat: 'no-repeat',
      backgroundOffsetX: 0,
      backgroundOffsetY: 0
    });

    setBackgroundUrl('');
    setBackgroundRepeat('no-repeat');
    setOffsetX([0]);
    setOffsetY([0]);

    toast.success('Region background cleared');
  };

  if (!region) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Region Background</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="background-file">Upload Background Image</Label>
            <Input
              id="background-file"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="background-url">Or Enter Image URL</Label>
            <Input
              id="background-url"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={backgroundUrl}
              onChange={(e) => setBackgroundUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Repeat Mode</Label>
            <Select value={backgroundRepeat} onValueChange={(value: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y') => setBackgroundRepeat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-repeat">No Repeat</SelectItem>
                <SelectItem value="repeat">Repeat</SelectItem>
                <SelectItem value="repeat-x">Repeat X</SelectItem>
                <SelectItem value="repeat-y">Repeat Y</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {backgroundUrl && (
            <>
              <div className="space-y-2">
                <Label>Horizontal Offset: {offsetX[0]}px</Label>
                <Slider
                  value={offsetX}
                  onValueChange={setOffsetX}
                  min={-200}
                  max={200}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Vertical Offset: {offsetY[0]}px</Label>
                <Slider
                  value={offsetY}
                  onValueChange={setOffsetY}
                  min={-200}
                  max={200}
                  step={1}
                  className="w-full"
                />
              </div>
            </>
          )}

          <div className="flex justify-between gap-2 pt-4">
            <Button variant="destructive" onClick={clearBackground}>
              Clear Background
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={applyBackground} disabled={!backgroundUrl}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};