import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Paintbrush, Plus, Minus, X } from 'lucide-react';
import { Z_INDEX } from '@/lib/zIndex';

interface FogBrushToolbarProps {
  brushRadius: number;
  onRadiusChange: (radius: number) => void;
  brushMode: 'reveal' | 'hide';
  onBrushModeChange: (mode: 'reveal' | 'hide') => void;
  onClose: () => void;
}

export const FogBrushToolbar: React.FC<FogBrushToolbarProps> = ({
  brushRadius,
  onRadiusChange,
  brushMode,
  onBrushModeChange,
  onClose,
}) => {
  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg px-3 py-2"
      style={{ zIndex: Z_INDEX.FIXED_UI.TOOLBARS }}
    >
      <div className="flex items-center gap-2">
        <Paintbrush className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-foreground whitespace-nowrap">Fog Brush</span>

        <div className="h-4 w-px bg-border" />

        {/* Mode buttons */}
        <Button
          variant={brushMode === 'reveal' ? 'default' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onBrushModeChange('reveal')}
          title="Reveal fog (paint explored area)"
        >
          <Minus className="h-3 w-3 mr-1" />
          Remove Fog
        </Button>
        <Button
          variant={brushMode === 'hide' ? 'default' : 'ghost'}
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onBrushModeChange('hide')}
          title="Add fog (erase explored area)"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Fog
        </Button>

        <div className="h-4 w-px bg-border" />

        {/* Radius slider */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">Size</span>
        <Slider
          value={[brushRadius]}
          onValueChange={([v]) => onRadiusChange(v)}
          min={10}
          max={300}
          step={5}
          className="w-28"
        />
        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
          {brushRadius}px
        </span>

        <div className="h-4 w-px bg-border" />

        {/* Close */}
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose} title="Close brush tool">
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
