import React from 'react';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { useDungeonStore } from '@/stores/dungeonStore';
import { useRegionStore } from '@/stores/regionStore';
import { useHatchingStore } from '@/stores/hatchingStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { WATABOU_STYLES } from '@/lib/watabouStyles';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { type WallEdgeStyle } from '@/lib/wallTexturePatterns';
import { DoorClosed } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

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
  const { closeAllDoors, mapObjects } = useMapObjectStore();
  
  const {
    enabled: hatchingEnabled,
    hatchingOptions,
    setEnabled: setHatchingEnabled,
    setOptions: setHatchingOptions,
    applyPreset: applyHatchingPreset,
    getPresetNames,
  } = useHatchingStore();

  const edgeStyleLabels: Record<WallEdgeStyle, string> = {
    stone: 'Stone',
    wood: 'Wood',
    metal: 'Metal',
    simple: 'Simple',
  };
  
  const isPlayMode = renderingMode === 'play';
  
  // Count doors on the map
  const doorCount = mapObjects.filter(obj => obj.category === 'door').length;
  const openDoorCount = mapObjects.filter(obj => obj.category === 'door' && obj.isOpen).length;
  
  const quickSetStyle = (styleName: string) => {
    const style = WATABOU_STYLES[styleName];
    if (style) {
      setWatabouStyle(style);
      toast.success(`Applied ${styleName} style`);
    }
  };

  const applyHatchingPresetWithToast = (presetName: string) => {
    applyHatchingPreset(presetName);
    toast.success(`Applied ${presetName} hatching preset`);
  };

  const handleCloseAllDoors = () => {
    closeAllDoors();
    toast.success('All doors closed');
  };

  // Convert hex color to number for shader
  const hexToNumber = (hex: string): number => {
    return parseInt(hex.replace('#', ''), 16);
  };

  // Convert number to hex for input
  const numberToHex = (num: number): string => {
    return '#' + num.toString(16).padStart(6, '0');
  };

  return (
    <Tabs defaultValue="utilities" className="w-full h-full">
      <TabsList className="w-full grid grid-cols-2">
        <TabsTrigger value="utilities">Utilities</TabsTrigger>
        <TabsTrigger value="styles">Styles</TabsTrigger>
      </TabsList>
      
      {/* Utilities Tab */}
      <TabsContent value="utilities" className="mt-0">
        <div className="p-4 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          {/* Doors Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Doors</Label>
            <div className="text-xs text-muted-foreground mb-2">
              {doorCount === 0 ? (
                'No doors on map'
              ) : (
                `${doorCount} door${doorCount !== 1 ? 's' : ''} on map (${openDoorCount} open)`
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseAllDoors}
              disabled={doorCount === 0 || openDoorCount === 0}
              className="w-full"
            >
              <DoorClosed className="h-4 w-4 mr-2" />
              Close All Doors
            </Button>
            <p className="text-xs text-muted-foreground">
              Closes all doors on the map, blocking vision through them.
            </p>
          </div>
        </div>
      </TabsContent>
      
      {/* Styles Tab */}
      <TabsContent value="styles" className="mt-0">
        <div className="p-4 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          {/* Edge Hatching Section */}
          <div className="space-y-3 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Edge Hatching (GPU)</Label>
              <Switch
                checked={hatchingEnabled}
                onCheckedChange={setHatchingEnabled}
              />
            </div>
            
            {hatchingEnabled && (
              <>
                {/* Hatching Presets */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Presets</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {getPresetNames().map((presetName) => (
                      <Button
                        key={presetName}
                        variant="outline"
                        size="sm"
                        onClick={() => applyHatchingPresetWithToast(presetName)}
                        className="text-xs h-8"
                      >
                        {presetName}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Hatching Controls */}
                <div className="space-y-3">
                  {/* Stroke Count */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Strokes per Cluster</Label>
                      <span className="text-xs text-muted-foreground">{hatchingOptions.strokeCount} lines</span>
                    </div>
                    <Select
                      value={String(hatchingOptions.strokeCount)}
                      onValueChange={(value) => setHatchingOptions({ strokeCount: parseInt(value) })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 Lines (Light)</SelectItem>
                        <SelectItem value="3">3 Lines (Classic)</SelectItem>
                        <SelectItem value="4">4 Lines (Dense)</SelectItem>
                        <SelectItem value="5">5 Lines (Heavy)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Radius */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Edge Radius</Label>
                      <span className="text-xs text-muted-foreground">{hatchingOptions.radius}px</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.radius]}
                      onValueChange={([value]) => setHatchingOptions({ radius: value })}
                      min={8}
                      max={50}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Cluster Size */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Cluster Size</Label>
                      <span className="text-xs text-muted-foreground">{hatchingOptions.clusterSize}px</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.clusterSize]}
                      onValueChange={([value]) => setHatchingOptions({ clusterSize: value })}
                      min={6}
                      max={30}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Stroke Length */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Stroke Length</Label>
                      <span className="text-xs text-muted-foreground">{hatchingOptions.strokeLength}px</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.strokeLength]}
                      onValueChange={([value]) => setHatchingOptions({ strokeLength: value })}
                      min={4}
                      max={24}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Length Variation */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Length Variation</Label>
                      <span className="text-xs text-muted-foreground">{Math.round(hatchingOptions.lengthVariation * 100)}%</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.lengthVariation]}
                      onValueChange={([value]) => setHatchingOptions({ lengthVariation: value })}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                  </div>

                  {/* Line Gap */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Line Gap</Label>
                      <span className="text-xs text-muted-foreground">{hatchingOptions.lineGap.toFixed(1)}px</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.lineGap]}
                      onValueChange={([value]) => setHatchingOptions({ lineGap: value })}
                      min={1}
                      max={5}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  {/* Jitter */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Jitter</Label>
                      <span className="text-xs text-muted-foreground">{hatchingOptions.jitter.toFixed(1)}px</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.jitter]}
                      onValueChange={([value]) => setHatchingOptions({ jitter: value })}
                      min={0}
                      max={5}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  {/* Opacity */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Opacity</Label>
                      <span className="text-xs text-muted-foreground">{Math.round(hatchingOptions.lineAlpha * 100)}%</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.lineAlpha]}
                      onValueChange={([value]) => setHatchingOptions({ lineAlpha: value })}
                      min={0.1}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                  </div>

                  {/* Outer Fade */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Outer Fade</Label>
                      <span className="text-xs text-muted-foreground">{Math.round(hatchingOptions.outerFade * 100)}%</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.outerFade]}
                      onValueChange={([value]) => setHatchingOptions({ outerFade: value })}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                  </div>

                  {/* Skip Depth */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <Label className="text-xs">Skip Depth</Label>
                      <span className="text-xs text-muted-foreground">{Math.round(hatchingOptions.skipDepth * 100)}%</span>
                    </div>
                    <Slider
                      value={[hatchingOptions.skipDepth]}
                      onValueChange={([value]) => setHatchingOptions({ skipDepth: value })}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                  </div>

                  {/* Ink Color */}
                  <div className="space-y-1">
                    <Label className="text-xs">Ink Color</Label>
                    <input
                      type="color"
                      value={numberToHex(hatchingOptions.inkColor)}
                      onChange={(e) => setHatchingOptions({ inkColor: hexToNumber(e.target.value) })}
                      className="w-full h-8 cursor-pointer rounded border border-border"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

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
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};
