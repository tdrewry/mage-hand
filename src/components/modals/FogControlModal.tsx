import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useFogStore } from '@/stores/fogStore';
import { Eye, EyeOff, Circle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface FogControlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FogControlModal = ({ open, onOpenChange }: FogControlModalProps) => {
  const {
    enabled,
    revealAll,
    visionRange,
    fogOpacity,
    exploredOpacity,
    setEnabled,
    setRevealAll,
    setVisionRange,
    setFogOpacity,
    setExploredOpacity,
    clearExploredAreas,
    resetFog,
  } = useFogStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Fog of War Settings
          </DialogTitle>
          <DialogDescription>
            Control visibility and exploration settings for the map
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Fog */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="fog-enabled" className="text-base">
                Enable Fog of War
              </Label>
              <p className="text-sm text-muted-foreground">
                Hide unexplored areas from players
              </p>
            </div>
            <Switch
              id="fog-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <Separator />

          {/* DM Mode - Reveal All */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reveal-all" className="text-base flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                DM Mode (Reveal All)
              </Label>
              <p className="text-sm text-muted-foreground">
                Show entire map (for DM view)
              </p>
            </div>
            <Switch
              id="reveal-all"
              checked={revealAll}
              onCheckedChange={setRevealAll}
              disabled={!enabled}
            />
          </div>

          <Separator />

          {/* Vision Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="vision-range" className="text-base flex items-center gap-2">
                <Circle className="h-4 w-4" />
                Token Vision Range
              </Label>
              <span className="text-sm font-medium">{visionRange} grid units</span>
            </div>
            <Slider
              id="vision-range"
              min={1}
              max={20}
              step={1}
              value={[visionRange]}
              onValueChange={([value]) => setVisionRange(value)}
              disabled={!enabled}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              How far tokens can see through fog (in grid squares)
            </p>
          </div>

          <Separator />

          {/* Fog Opacity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="fog-opacity" className="text-base">
                Unexplored Darkness
              </Label>
              <span className="text-sm font-medium">{Math.round(fogOpacity * 100)}%</span>
            </div>
            <Slider
              id="fog-opacity"
              min={0}
              max={100}
              step={5}
              value={[fogOpacity * 100]}
              onValueChange={([value]) => setFogOpacity(value / 100)}
              disabled={!enabled}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              How dark unexplored areas appear
            </p>
          </div>

          <Separator />

          {/* Explored Opacity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="explored-opacity" className="text-base">
                Explored Darkness
              </Label>
              <span className="text-sm font-medium">{Math.round(exploredOpacity * 100)}%</span>
            </div>
            <Slider
              id="explored-opacity"
              min={0}
              max={100}
              step={5}
              value={[exploredOpacity * 100]}
              onValueChange={([value]) => setExploredOpacity(value / 100)}
              disabled={!enabled}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              How dark explored but not visible areas appear
            </p>
          </div>

          <Separator />

          {/* Reset Button */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                clearExploredAreas();
                toast('Explored areas cleared');
              }}
              disabled={!enabled}
            >
              Clear Explored
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetFog();
                onOpenChange(false);
              }}
            >
              Reset All
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mt-2">
          <p className="text-sm text-muted-foreground">
            <strong>Tip:</strong> Fog has three states: <strong>unexplored</strong> (black), 
            <strong>explored</strong> (dimmed), and <strong>visible</strong> (clear). 
            Tokens reveal fog as they move around the map.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
