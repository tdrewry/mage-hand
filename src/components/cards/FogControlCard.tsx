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
    useGradients,
    innerFadeStart,
    midpointPosition,
    midpointOpacity,
    outerFadeStart,
    setEnabled,
    setRevealAll,
    setVisionRange,
    setFogOpacity,
    setExploredOpacity,
    setUseGradients,
    setInnerFadeStart,
    setMidpointPosition,
    setMidpointOpacity,
    setOuterFadeStart,
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

      {/* Soft Edges - Gradient Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="use-gradients" className="text-sm font-medium">
              Soft Vision Edges
            </Label>
            <p className="text-xs text-muted-foreground">
              Smooth gradient fade at vision boundaries
            </p>
          </div>
          <Switch
            id="use-gradients"
            checked={useGradients}
            onCheckedChange={setUseGradients}
            disabled={!enabled}
          />
        </div>

        {useGradients && (
          <>
            {/* Inner Fade Start */}
            <div className="space-y-2 pl-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="inner-fade" className="text-xs font-medium">
                  Inner Clear Zone
                </Label>
                <span className="text-xs font-medium">{Math.round(innerFadeStart * 100)}%</span>
              </div>
              <Slider
                id="inner-fade"
                min={0}
                max={100}
                step={5}
                value={[innerFadeStart * 100]}
                onValueChange={([value]) => setInnerFadeStart(value / 100)}
                disabled={!enabled}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Radius where vision is perfectly clear
              </p>
            </div>

            {/* Midpoint Position */}
            <div className="space-y-2 pl-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="midpoint-pos" className="text-xs font-medium">
                  Midpoint Distance
                </Label>
                <span className="text-xs font-medium">{Math.round(midpointPosition * 100)}%</span>
              </div>
              <Slider
                id="midpoint-pos"
                min={0}
                max={100}
                step={5}
                value={[midpointPosition * 100]}
                onValueChange={([value]) => setMidpointPosition(value / 100)}
                disabled={!enabled}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Where the mid-fade transition occurs
              </p>
            </div>

            {/* Midpoint Opacity */}
            <div className="space-y-2 pl-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="midpoint-opacity" className="text-xs font-medium">
                  Midpoint Darkness
                </Label>
                <span className="text-xs font-medium">{Math.round(midpointOpacity * 100)}%</span>
              </div>
              <Slider
                id="midpoint-opacity"
                min={0}
                max={100}
                step={5}
                value={[midpointOpacity * 100]}
                onValueChange={([value]) => setMidpointOpacity(value / 100)}
                disabled={!enabled}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Darkness level at midpoint
              </p>
            </div>

            {/* Outer Fade Start */}
            <div className="space-y-2 pl-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="outer-fade" className="text-xs font-medium">
                  Outer Fade Start
                </Label>
                <span className="text-xs font-medium">{Math.round(outerFadeStart * 100)}%</span>
              </div>
              <Slider
                id="outer-fade"
                min={0}
                max={100}
                step={5}
                value={[outerFadeStart * 100]}
                onValueChange={([value]) => setOuterFadeStart(value / 100)}
                disabled={!enabled}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Where final fade to full darkness begins
              </p>
            </div>
          </>
        )}
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
