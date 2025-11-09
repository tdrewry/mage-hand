import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image } from 'lucide-react';
import { Canvas as FabricCanvas, FabricImage } from 'fabric';
import { toast } from 'sonner';

interface BackgroundGridCardContentProps {
  fabricCanvas: FabricCanvas | null;
  gridColor: string;
  gridOpacity: number;
  onGridColorChange: (color: string) => void;
  onGridOpacityChange: (opacity: number) => void;
}

export const BackgroundGridCardContent = ({ 
  fabricCanvas,
  gridColor,
  gridOpacity,
  onGridColorChange,
  onGridOpacityChange
}: BackgroundGridCardContentProps) => {
  // Background state
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [backgroundOpacity, setBackgroundOpacity] = useState(100);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [backgroundRepeat, setBackgroundRepeat] = useState<'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'>('no-repeat');

  const applyBackgroundColor = () => {
    if (!fabricCanvas) return;
    
    const rgba = hexToRgba(backgroundColor, backgroundOpacity / 100);
    fabricCanvas.backgroundColor = rgba;
    fabricCanvas.renderAll();
    toast.success('Background color applied');
  };

  const applyBackgroundImage = () => {
    if (!fabricCanvas || !backgroundImage.trim()) return;

    FabricImage.fromURL(backgroundImage.trim()).then((img) => {
      // Remove existing background images
      const objects = fabricCanvas.getObjects();
      objects.forEach((obj: any) => {
        if (obj.isBackground) {
          fabricCanvas.remove(obj);
        }
      });

      // Set up the background image
      (img as any).isBackground = true;
      
      const canvasWidth = fabricCanvas.width || 1200;
      const canvasHeight = fabricCanvas.height || 800;
      
      if (backgroundRepeat === 'no-repeat') {
        // Scale to fit canvas
        const scaleX = canvasWidth / (img.width || 1);
        const scaleY = canvasHeight / (img.height || 1);
        const scale = Math.min(scaleX, scaleY);
        
        img.set({
          left: 0,
          top: 0,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
          opacity: backgroundOpacity / 100,
        });
        
        fabricCanvas.add(img);
      } else {
        // Create tiled pattern
        const imgWidth = img.width || 100;
        const imgHeight = img.height || 100;
        
        const tilesX = Math.ceil(canvasWidth / imgWidth);
        const tilesY = backgroundRepeat === 'repeat-x' ? 1 : Math.ceil(canvasHeight / imgHeight);
        
        for (let x = 0; x < tilesX; x++) {
          for (let y = 0; y < tilesY; y++) {
            img.clone().then((clonedImg: any) => {
              clonedImg.isBackground = true;
              clonedImg.set({
                left: x * imgWidth,
                top: y * imgHeight,
                selectable: false,
                evented: false,
                opacity: backgroundOpacity / 100,
              });
              fabricCanvas.add(clonedImg);
              fabricCanvas.renderAll();
            });
          }
        }
      }
      
      fabricCanvas.renderAll();
      toast.success('Background image applied');
    }).catch(() => {
      toast.error('Failed to load background image');
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setBackgroundImage(result);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Please select an image file');
    }
  };

  const clearBackground = () => {
    if (!fabricCanvas) return;
    
    fabricCanvas.backgroundColor = 'transparent';
    const objects = fabricCanvas.getObjects();
    objects.forEach((obj: any) => {
      if (obj.isBackground) {
        fabricCanvas.remove(obj);
      }
    });
    fabricCanvas.renderAll();
    toast.success('Background cleared');
  };

  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
      <Tabs defaultValue="background" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted">
          <TabsTrigger value="background" className="text-xs">Background</TabsTrigger>
          <TabsTrigger value="grid" className="text-xs">Grid</TabsTrigger>
        </TabsList>
        
        <TabsContent value="background" className="space-y-4 mt-3">
          {/* Background Color */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-16 h-8 p-1"
              />
              <Button onClick={applyBackgroundColor} size="sm" className="flex-1 text-xs">
                Apply Color
              </Button>
            </div>
          </div>

          {/* Background Opacity */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Opacity: {backgroundOpacity}%
            </Label>
            <Slider
              value={[backgroundOpacity]}
              onValueChange={(value) => setBackgroundOpacity(value[0])}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Background Image */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Image</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="text-xs"
            />
            <Input
              type="url"
              placeholder="Or enter image URL"
              value={backgroundImage}
              onChange={(e) => setBackgroundImage(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Image Repeat */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Image Repeat</Label>
            <Select value={backgroundRepeat} onValueChange={(value: any) => setBackgroundRepeat(value)}>
              <SelectTrigger className="w-full">
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

          <div className="flex gap-2">
            <Button onClick={applyBackgroundImage} size="sm" className="flex-1 text-xs">
              <Image className="h-3 w-3 mr-1" />
              Apply Image
            </Button>
            <Button onClick={clearBackground} variant="outline" size="sm" className="text-xs">
              Clear
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="grid" className="space-y-4 mt-3">
          {/* Grid Color */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Grid Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={gridColor}
                onChange={(e) => onGridColorChange(e.target.value)}
                className="w-16 h-8 p-1"
              />
              <span className="text-xs text-muted-foreground flex items-center">
                {gridColor}
              </span>
            </div>
          </div>

          {/* Grid Opacity */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Grid Opacity: {gridOpacity}%
            </Label>
            <Slider
              value={[gridOpacity]}
              onValueChange={(value) => onGridOpacityChange(value[0])}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="text-xs text-muted-foreground border-t pt-2">
            Grid settings apply when grid is redrawn
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
