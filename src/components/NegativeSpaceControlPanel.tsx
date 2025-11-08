import React from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { X } from 'lucide-react';
import { useDungeonStore } from '@/stores/dungeonStore';

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
    setWallEdgeStyle, 
    setWallThickness,
    setTextureScale 
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
      <div className="space-y-2 mb-4">
        <Label>Wall Edge Style</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(edgeStyleLabels) as Array<typeof wallEdgeStyle>).map((style) => (
            <Button
              key={style}
              variant={wallEdgeStyle === style ? "default" : "outline"}
              size="sm"
              onClick={() => setWallEdgeStyle(style)}
              className="w-full"
            >
              {edgeStyleLabels[style]}
            </Button>
          ))}
        </div>
      </div>

      {/* Wall Thickness */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <Label>Wall Thickness</Label>
          <span className="text-sm text-muted-foreground">{wallThickness.toFixed(1)}px</span>
        </div>
        <Slider
          value={[wallThickness]}
          onValueChange={([value]) => setWallThickness(value)}
          min={1}
          max={10}
          step={0.5}
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

      {/* Info */}
      <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
        <p>• Adjust wall thickness to change edge width</p>
        <p>• Texture scale affects pattern density</p>
        <p>• Different styles have unique textures</p>
      </div>
    </Card>
  );
};
