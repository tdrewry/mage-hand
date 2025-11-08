import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { X, Sun, MoveDown, MoveRight, MoveLeft } from 'lucide-react';
import { useDungeonStore } from '@/stores/dungeonStore';
import { StylePreviewCanvas } from './StylePreviewCanvas';

interface NegativeSpaceControlPanelProps {
  onClose: () => void;
}

export const NegativeSpaceControlPanel: React.FC<NegativeSpaceControlPanelProps> = ({
  onClose,
}) => {
  const { 
    wallEdgeStyle, 
    wallThickness, 
    textureScale,
    lightDirection,
    setWallEdgeStyle, 
    setWallThickness,
    setTextureScale,
    setLightDirection
  } = useDungeonStore();

  const edgeStyleLabels: Record<typeof wallEdgeStyle, string> = {
    stone: 'Stone',
    wood: 'Wood',
    metal: 'Metal',
    simple: 'Simple',
  };

  return (
    <Card className="absolute top-4 left-4 z-10 p-4 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Negative Space Controls</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Wall Edge Style */}
      <div className="space-y-3 mb-4">
        <Label>Wall Edge Style</Label>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(edgeStyleLabels) as Array<typeof wallEdgeStyle>).map((style) => (
            <div key={style} className="space-y-2">
              <StylePreviewCanvas style={style} isSelected={wallEdgeStyle === style} />
              <Button
                variant={wallEdgeStyle === style ? "default" : "outline"}
                size="sm"
                onClick={() => setWallEdgeStyle(style)}
                className="w-full"
              >
                {edgeStyleLabels[style]}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Wall Thickness */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <Label>Wall Thickness</Label>
          <span className="text-sm text-muted-foreground">{wallThickness.toFixed(1)}x</span>
        </div>
        <Slider
          value={[wallThickness]}
          onValueChange={([value]) => setWallThickness(value)}
          min={0.5}
          max={3}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Texture Scale */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <Label>Texture Scale</Label>
          <span className="text-sm text-muted-foreground">{textureScale.toFixed(1)}x</span>
        </div>
        <Slider
          value={[textureScale]}
          onValueChange={([value]) => setTextureScale(value)}
          min={0.5}
          max={3}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Light Direction */}
      <div className="space-y-3 mb-4 pb-4 border-b">
        <Label>Light Direction</Label>
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant={lightDirection === 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setLightDirection(0)}
            className="h-10"
            title="Top"
          >
            <Sun className="h-4 w-4" />
          </Button>
          <Button
            variant={lightDirection === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setLightDirection(90)}
            className="h-10"
            title="Right"
          >
            <MoveRight className="h-4 w-4" />
          </Button>
          <Button
            variant={lightDirection === 180 ? "default" : "outline"}
            size="sm"
            onClick={() => setLightDirection(180)}
            className="h-10"
            title="Bottom"
          >
            <MoveDown className="h-4 w-4" />
          </Button>
          <Button
            variant={lightDirection === 270 ? "default" : "outline"}
            size="sm"
            onClick={() => setLightDirection(270)}
            className="h-10"
            title="Left"
          >
            <MoveLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Custom Angle</Label>
            <span className="text-sm text-muted-foreground">{lightDirection}°</span>
          </div>
          <Slider
            value={[lightDirection]}
            onValueChange={([value]) => setLightDirection(value)}
            min={0}
            max={359}
            step={1}
            className="w-full"
          />
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
        <p>• Wall thickness in world space units</p>
        <p>• Texture scale affects pattern density</p>
        <p>• Light direction affects shadows & highlights</p>
        <p>• Click map to add colored light sources</p>
      </div>
    </Card>
  );
};
