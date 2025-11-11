import React from 'react';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useRegionStore } from '@/stores/regionStore';
import { WATABOU_STYLES } from '@/lib/watabouStyles';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { EDGE_STYLES, type WallEdgeStyle } from '@/lib/wallTexturePatterns';

export const StylesCardContent: React.FC = () => {
  const { 
    wallEdgeStyle, 
    wallThickness, 
    textureScale,
    renderingMode,
    watabouStyle,
    setWallEdgeStyle, 
    setWallThickness,
    setTextureScale,
    setWatabouStyle
  } = useDungeonStore();
  
  const { regions } = useRegionStore();

  const edgeStyleLabels: Record<WallEdgeStyle, string> = {
    stone: 'Stone',
    wood: 'Wood',
    metal: 'Metal',
    simple: 'Simple',
  };
  
  const isPlayMode = renderingMode === 'play';
  
  const quickSetStyle = (styleName: string) => {
    const style = WATABOU_STYLES[styleName];
    if (style) {
      setWatabouStyle(style);
      toast.success(`Applied ${styleName} style`);
    }
  };

  return (
    <div className="p-4 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto">
      {/* Quick Style Presets */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Quick Presets</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(WATABOU_STYLES).map((styleName) => (
            <Button
              key={styleName}
              variant="outline"
              size="sm"
              onClick={() => quickSetStyle(styleName)}
              className="h-auto py-2 px-3 flex flex-col items-start gap-1"
            >
              <span className="text-xs font-medium capitalize">{styleName}</span>
              <span className="text-xs text-muted-foreground">
                Quick Style
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Current Style Display */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Current Style</Label>
        <div className="border rounded-md p-3 bg-muted/30">
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Edge:</span>
              <span className="font-medium">{edgeStyleLabels[wallEdgeStyle]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thickness:</span>
              <span className="font-medium">{wallThickness}px</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Detail:</span>
              <span className="font-medium">{textureScale}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Controls */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold">Manual Controls</Label>
        
        {/* Edge Style */}
        <div className="space-y-2">
          <Label className="text-xs">Edge Style</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(edgeStyleLabels).map(([value, label]) => (
              <Button
                key={value}
                variant={wallEdgeStyle === value ? "default" : "outline"}
                size="sm"
                onClick={() => setWallEdgeStyle(value as typeof wallEdgeStyle)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Wall Thickness */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">Wall Thickness</Label>
            <span className="text-xs text-muted-foreground">{wallThickness}px</span>
          </div>
          <Slider
            value={[wallThickness]}
            onValueChange={([value]) => setWallThickness(value)}
            min={1}
            max={20}
            step={1}
            className="w-full"
          />
        </div>

        {/* Texture Scale */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">Detail Scale</Label>
            <span className="text-xs text-muted-foreground">{textureScale}%</span>
          </div>
          <Slider
            value={[textureScale]}
            onValueChange={([value]) => setTextureScale(value)}
            min={50}
            max={200}
            step={10}
            className="w-full"
          />
        </div>

        {/* TODO: Light Direction and Shadow Distance
             These controls are hidden until rendering implementation is complete.
             See CONTRIBUTING/Card-Based-UI-Refactor.md for details. */}
      </div>
    </div>
  );
};
