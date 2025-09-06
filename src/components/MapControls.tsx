import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Upload, Link2, Trash2 } from 'lucide-react';
import { Canvas as FabricCanvas, FabricImage } from 'fabric';
import { toast } from 'sonner';

interface MapControlsProps {
  fabricCanvas: FabricCanvas | null;
}

export const MapControls = ({ fabricCanvas }: MapControlsProps) => {
  const [mapUrl, setMapUrl] = useState('');
  const [zoom, setZoom] = useState(100);

  const handleZoomChange = (newZoom: number[]) => {
    const zoomValue = newZoom[0];
    setZoom(zoomValue);
    
    if (fabricCanvas) {
      const zoomLevel = zoomValue / 100;
      fabricCanvas.setZoom(zoomLevel);
      fabricCanvas.renderAll();
    }
  };

  const resetZoom = () => {
    setZoom(100);
    if (fabricCanvas) {
      fabricCanvas.setZoom(1);
      fabricCanvas.renderAll();
    }
  };

  const handleMapFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && fabricCanvas) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          loadBackgroundImage(result);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Please select an image file');
      }
    }
  };

  const handleMapUrlSubmit = () => {
    if (mapUrl.trim()) {
      loadBackgroundImage(mapUrl.trim());
      setMapUrl('');
    } else {
      toast.error('Please enter a valid URL');
    }
  };

  const loadBackgroundImage = (imageUrl: string) => {
    if (!fabricCanvas) return;

    FabricImage.fromURL(imageUrl).then((img) => {
      // Remove existing background image
      const existingBg = fabricCanvas.getObjects().find((obj: any) => obj.isBackground);
      if (existingBg) {
        fabricCanvas.remove(existingBg);
      }

      // Scale image to fit canvas while maintaining aspect ratio
      const canvasWidth = fabricCanvas.width || 1200;
      const canvasHeight = fabricCanvas.height || 800;
      
      const imageAspect = (img.width || 1) / (img.height || 1);
      const canvasAspect = canvasWidth / canvasHeight;
      
      let scaleX, scaleY;
      if (imageAspect > canvasAspect) {
        // Image is wider than canvas
        scaleX = canvasWidth / (img.width || 1);
        scaleY = scaleX;
      } else {
        // Image is taller than canvas
        scaleY = canvasHeight / (img.height || 1);
        scaleX = scaleY;
      }

      img.set({
        left: 0,
        top: 0,
        scaleX,
        scaleY,
        selectable: false,
        evented: false,
        isBackground: true,
      } as any);

      fabricCanvas.add(img);
      fabricCanvas.renderAll();
      
      toast.success('Map background loaded');
    }).catch(() => {
      toast.error('Failed to load map image');
    });
  };

  const clearMap = () => {
    if (!fabricCanvas) return;
    
    const backgroundImg = fabricCanvas.getObjects().find((obj: any) => obj.isBackground);
    if (backgroundImg) {
      fabricCanvas.remove(backgroundImg);
      fabricCanvas.renderAll();
      toast.success('Map background cleared');
    }
  };

  return (
    <Card className="m-4 bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-card-foreground">Map Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Zoom Controls */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Zoom: {zoom}%
          </Label>
          <Slider
            value={[zoom]}
            onValueChange={handleZoomChange}
            min={25}
            max={300}
            step={25}
            className="w-full"
          />
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleZoomChange([Math.max(25, zoom - 25)])}
              className="flex-1 text-xs"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetZoom}
              className="flex-1 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleZoomChange([Math.min(300, zoom + 25)])}
              className="flex-1 text-xs"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Map Background */}
        <div>
          <Label className="text-xs text-muted-foreground">Map Background</Label>
          <Tabs defaultValue="upload" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
              <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-2 mt-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleMapFileUpload}
                className="text-xs"
              />
            </TabsContent>
            
            <TabsContent value="url" className="space-y-2 mt-2">
              <Input
                type="url"
                placeholder="https://example.com/map.jpg"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                className="text-xs"
              />
              <Button 
                onClick={handleMapUrlSubmit}
                size="sm"
                className="w-full text-xs"
              >
                <Link2 className="h-3 w-3 mr-1" />
                Load Map
              </Button>
            </TabsContent>
          </Tabs>
          
          <Button 
            onClick={clearMap}
            variant="outline"
            size="sm"
            className="w-full mt-2 text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear Map
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};