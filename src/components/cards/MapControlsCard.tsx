import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link2, Trash2, Crosshair } from 'lucide-react';
import { Canvas as FabricCanvas, FabricImage } from 'fabric';
import { toast } from 'sonner';
import { useSessionStore } from '@/stores/sessionStore';
import { useMapStore } from '@/stores/mapStore';
import { useRoleStore } from '@/stores/roleStore';
import { emitMapFocus } from '@/lib/net/ephemeral/mapHandlers';

interface MapControlsCardContentProps {
  fabricCanvas: FabricCanvas | null;
}

export const MapControlsCardContent = ({ fabricCanvas }: MapControlsCardContentProps) => {
  const [mapUrl, setMapUrl] = useState('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          addMapToCanvas(result);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Please select an image file');
      }
    }
  };

  const handleUrlSubmit = () => {
    if (mapUrl.trim()) {
      addMapToCanvas(mapUrl.trim());
      setMapUrl('');
    } else {
      toast.error('Please enter a valid URL');
    }
  };

  const addMapToCanvas = (imageUrl: string) => {
    if (!fabricCanvas) return;

    FabricImage.fromURL(imageUrl).then((img) => {
      (img as any).isMap = true;
      
      // Scale to fit canvas while maintaining aspect ratio
      const canvasWidth = fabricCanvas.width || 1200;
      const canvasHeight = fabricCanvas.height || 800;
      const imgWidth = img.width || 1;
      const imgHeight = img.height || 1;
      
      const scaleX = canvasWidth / imgWidth;
      const scaleY = canvasHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
      
      img.set({
        left: 0,
        top: 0,
        scaleX: scale,
        scaleY: scale,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      fabricCanvas.add(img);
      fabricCanvas.renderAll();
      toast.success('Map added to canvas');
    }).catch((error) => {
      console.error('Map load error:', error);
      toast.error('Failed to load map image');
    });
  };

  const clearMaps = () => {
    if (!fabricCanvas) return;
    
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj: any) => {
      if (obj.isMap) {
        fabricCanvas.remove(obj);
      }
    });
    fabricCanvas.renderAll();
    toast.success('All maps cleared');
  };

  return (
    <div className="p-4">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted">
          <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
          <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="map-upload" className="text-xs text-muted-foreground">
              Select Map Image
            </Label>
            <Input
              id="map-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="mt-1 text-xs"
            />
          </div>
          
          <Button 
            onClick={clearMaps}
            size="sm" 
            variant="outline"
            className="w-full text-xs text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All Maps
          </Button>
        </TabsContent>
        
        <TabsContent value="url" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="map-url" className="text-xs text-muted-foreground">
              Map Image URL
            </Label>
            <Input
              id="map-url"
              type="url"
              placeholder="https://example.com/map.jpg"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleUrlSubmit}
              size="sm"
              className="flex-1 text-xs"
            >
              <Link2 className="h-3 w-3 mr-1" />
              Add Map
            </Button>
            <Button 
              onClick={clearMaps}
              size="sm" 
              variant="outline"
              className="text-xs text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="text-xs text-muted-foreground mt-4">
        Maps will be placed at the origin and can be moved/resized after placement.
      </div>
    </div>
  );
};