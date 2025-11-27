import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useFogStore, type EffectQuality } from '@/stores/fogStore';
import { Eye, EyeOff, Circle, Sparkles, Zap, Film, MonitorPlay } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function FogControlCardContent() {
  const {
    enabled,
    revealAll,
    visionRange,
    fogOpacity,
    exploredOpacity,
    effectSettings,
    setEnabled,
    setRevealAll,
    setVisionRange,
    setFogOpacity,
    setExploredOpacity,
    setPostProcessingEnabled,
    setEdgeBlur,
    setLightFalloff,
    setVolumetricEnabled,
    setEffectQuality,
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

      {/* Post-Processing Effects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="post-processing" className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              GPU Post-Processing
            </Label>
            <p className="text-xs text-muted-foreground">
              Enhanced fog effects using WebGL
            </p>
          </div>
          <Switch
            id="post-processing"
            checked={effectSettings.postProcessingEnabled}
            onCheckedChange={setPostProcessingEnabled}
            disabled={!enabled}
          />
        </div>

        {effectSettings.postProcessingEnabled && (
          <>
            {/* Effect Quality Preset */}
            <div className="space-y-2 pl-4">
              <Label htmlFor="effect-quality" className="text-xs font-medium flex items-center gap-2">
                <MonitorPlay className="h-3 w-3" />
                Effect Quality
              </Label>
              <Select
                value={effectSettings.effectQuality}
                onValueChange={(value) => setEffectQuality(value as EffectQuality)}
                disabled={!enabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="performance">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3 w-3" />
                      Performance
                    </div>
                  </SelectItem>
                  <SelectItem value="balanced">
                    <div className="flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      Balanced
                    </div>
                  </SelectItem>
                  <SelectItem value="cinematic">
                    <div className="flex items-center gap-2">
                      <Film className="h-3 w-3" />
                      Cinematic
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Edge Blur */}
            <div className="space-y-2 pl-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="edge-blur" className="text-xs font-medium">
                  Fog Edge Softness
                </Label>
                <span className="text-xs font-medium">{effectSettings.edgeBlur}px</span>
              </div>
              <Slider
                id="edge-blur"
                min={0}
                max={20}
                step={1}
                value={[effectSettings.edgeBlur]}
                onValueChange={([value]) => setEdgeBlur(value)}
                disabled={!enabled}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Blur amount at fog boundaries
              </p>
            </div>

            {/* Light Falloff */}
            <div className="space-y-2 pl-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="light-falloff" className="text-xs font-medium">
                  Light Inner Zone
                </Label>
                <span className="text-xs font-medium">{Math.round(effectSettings.lightFalloff * 100)}%</span>
              </div>
              <Slider
                id="light-falloff"
                min={10}
                max={90}
                step={5}
                value={[effectSettings.lightFalloff * 100]}
                onValueChange={([value]) => setLightFalloff(value / 100)}
                disabled={!enabled}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Inner bright zone radius (outer is dimmer)
              </p>
            </div>

            {/* Volumetric Fog Toggle */}
            <div className="flex items-center justify-between pl-4">
              <div className="space-y-0.5">
                <Label htmlFor="volumetric" className="text-xs font-medium">
                  Volumetric Fog
                </Label>
                <p className="text-xs text-muted-foreground">
                  Atmospheric fog wisps (experimental)
                </p>
              </div>
              <Switch
                id="volumetric"
                checked={effectSettings.volumetricEnabled}
                onCheckedChange={setVolumetricEnabled}
                disabled={!enabled}
              />
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
          {effectSettings.postProcessingEnabled && (
            <> GPU effects add smooth edges and atmospheric lighting.</>
          )}
        </p>
      </div>
    </div>
  );
}
