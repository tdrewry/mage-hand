import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useFogStore } from '@/stores/fogStore';
import { Eye, EyeOff, Circle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function FogControlCardContent() {
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Control visibility and exploration settings for the map
      </p>

      {/* Enable/Disable Fog */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="fog-enabled" className="text-sm font-medium">
            Enable Fog of War
          </Label>
          <p className="text-xs text-muted-foreground">
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
          <Label htmlFor="reveal-all" className="text-sm font-medium flex items-center gap-2">
            <EyeOff className="h-3 w-3" />
            DM Mode (Reveal All)
          </Label>
          <p className="text-xs text-muted-foreground">
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="vision-range" className="text-sm font-medium flex items-center gap-2">
            <Circle className="h-3 w-3" />
            Token Vision Range
          </Label>
          <span className="text-xs font-medium">{visionRange} units</span>
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
          How far tokens can see through fog
        </p>
      </div>

      <Separator />

      {/* Fog Opacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="fog-opacity" className="text-sm font-medium">
            Unexplored Darkness
          </Label>
          <span className="text-xs font-medium">{Math.round(fogOpacity * 100)}%</span>
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="explored-opacity" className="text-sm font-medium">
            Explored Darkness
          </Label>
          <span className="text-xs font-medium">{Math.round(exploredOpacity * 100)}%</span>
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

      {/* Reset Buttons */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
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
          size="sm"
          onClick={() => {
            resetFog();
            toast('Fog settings reset');
          }}
        >
          Reset All
        </Button>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 mt-2">
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Fog has three states: <strong>unexplored</strong> (black), 
          <strong>explored</strong> (dimmed), and <strong>visible</strong> (clear). 
          Tokens reveal fog as they move around the map.
        </p>
      </div>
    </div>
  );
}
