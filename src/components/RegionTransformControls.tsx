import React from 'react';
import { Button } from './ui/button';
import { Move, RotateCcw, Scaling } from 'lucide-react';

export type TransformMode = 'move' | 'scale' | 'rotate';

interface RegionTransformControlsProps {
  transformMode: TransformMode;
  onTransformModeChange: (mode: TransformMode) => void;
  position: { x: number; y: number };
  className?: string;
}

export const RegionTransformControls: React.FC<RegionTransformControlsProps> = ({
  transformMode,
  onTransformModeChange,
  position,
  className = ''
}) => {
  return (
    <div className={`flex gap-1 bg-background/90 backdrop-blur-sm border rounded-lg p-1 shadow-lg ${className}`}>
      <Button
        variant={transformMode === 'move' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onTransformModeChange('move')}
        className="flex items-center gap-1 text-xs h-8 px-2"
        title="Move Mode (Right-click drag)"
      >
        <Move className="w-3 h-3" />
        Move
      </Button>
      
      <Button
        variant={transformMode === 'scale' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onTransformModeChange('scale')}
        className="flex items-center gap-1 text-xs h-8 px-2"
        title="Scale Mode (Corner handles)"
      >
        <Scaling className="w-3 h-3" />
        Scale
      </Button>
      
      <Button
        variant={transformMode === 'rotate' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onTransformModeChange('rotate')}
        className="flex items-center gap-1 text-xs h-8 px-2"
        title="Rotate Mode (Drag around center)"
      >
        <RotateCcw className="w-3 h-3" />
        Rotate
      </Button>
    </div>
  );
};