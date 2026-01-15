import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFogStore } from '@/stores/fogStore';
import type { IlluminationSource, IlluminationAnimationType } from '@/types/illumination';
import { DEFAULT_ILLUMINATION } from '@/types/illumination';
import { ILLUMINATION_PRESETS, type PresetKey, getAllPresets } from '@/lib/illuminationPresets';

interface TokenIlluminationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenIds: string[];
  currentIllumination?: IlluminationSource;
  onApply: (settings: Partial<IlluminationSource>) => void;
}

export const TokenIlluminationModal: React.FC<TokenIlluminationModalProps> = ({
  open,
  onOpenChange,
  tokenIds,
  currentIllumination,
  onApply,
}) => {
  const { effectSettings } = useFogStore();
  const isMultiple = tokenIds.length > 1;

  // Local state for form values
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('custom');
  const [range, setRange] = useState(currentIllumination?.range ?? DEFAULT_ILLUMINATION.range);
  const [brightZone, setBrightZone] = useState(currentIllumination?.brightZone ?? effectSettings.lightFalloff);
  const [brightIntensity, setBrightIntensity] = useState(currentIllumination?.brightIntensity ?? DEFAULT_ILLUMINATION.brightIntensity);
  const [dimIntensity, setDimIntensity] = useState(currentIllumination?.dimIntensity ?? DEFAULT_ILLUMINATION.dimIntensity);
  const [color, setColor] = useState(currentIllumination?.color ?? DEFAULT_ILLUMINATION.color);
  const [colorEnabled, setColorEnabled] = useState(currentIllumination?.colorEnabled ?? DEFAULT_ILLUMINATION.colorEnabled);
  const [colorIntensity, setColorIntensity] = useState(currentIllumination?.colorIntensity ?? DEFAULT_ILLUMINATION.colorIntensity);
  const [softEdge, setSoftEdge] = useState(currentIllumination?.softEdge ?? DEFAULT_ILLUMINATION.softEdge);
  const [softEdgeRadius, setSoftEdgeRadius] = useState(currentIllumination?.softEdgeRadius ?? DEFAULT_ILLUMINATION.softEdgeRadius);
  const [useGlobalBrightZone, setUseGlobalBrightZone] = useState(!currentIllumination?.brightZone);
  const [animation, setAnimation] = useState<IlluminationAnimationType>(currentIllumination?.animation ?? DEFAULT_ILLUMINATION.animation);
  const [animationSpeed, setAnimationSpeed] = useState(currentIllumination?.animationSpeed ?? DEFAULT_ILLUMINATION.animationSpeed);
  const [animationIntensity, setAnimationIntensity] = useState(currentIllumination?.animationIntensity ?? DEFAULT_ILLUMINATION.animationIntensity);

  // Apply preset values
  const applyPreset = (presetKey: PresetKey) => {
    setSelectedPreset(presetKey);
    if (presetKey === 'custom') return;
    
    const preset = ILLUMINATION_PRESETS[presetKey];
    setRange(preset.range);
    setBrightZone(preset.brightZone);
    setBrightIntensity(preset.brightIntensity);
    setDimIntensity(preset.dimIntensity);
    setColor(preset.color);
    setColorEnabled(preset.colorEnabled);
    setColorIntensity(preset.colorIntensity);
    setSoftEdge(preset.softEdge);
    setSoftEdgeRadius(preset.softEdgeRadius);
    setAnimation(preset.animation);
    setAnimationSpeed(preset.animationSpeed);
    setAnimationIntensity(preset.animationIntensity);
    setUseGlobalBrightZone(false);
  };

  // Reset form when modal opens with new token
  useEffect(() => {
    if (open) {
      setSelectedPreset('custom');
      setRange(currentIllumination?.range ?? DEFAULT_ILLUMINATION.range);
      setBrightZone(currentIllumination?.brightZone ?? effectSettings.lightFalloff);
      setBrightIntensity(currentIllumination?.brightIntensity ?? DEFAULT_ILLUMINATION.brightIntensity);
      setDimIntensity(currentIllumination?.dimIntensity ?? DEFAULT_ILLUMINATION.dimIntensity);
      setColor(currentIllumination?.color ?? DEFAULT_ILLUMINATION.color);
      setColorEnabled(currentIllumination?.colorEnabled ?? DEFAULT_ILLUMINATION.colorEnabled);
      setColorIntensity(currentIllumination?.colorIntensity ?? DEFAULT_ILLUMINATION.colorIntensity);
      setSoftEdge(currentIllumination?.softEdge ?? DEFAULT_ILLUMINATION.softEdge);
      setSoftEdgeRadius(currentIllumination?.softEdgeRadius ?? DEFAULT_ILLUMINATION.softEdgeRadius);
      setUseGlobalBrightZone(!currentIllumination?.brightZone);
      setAnimation(currentIllumination?.animation ?? DEFAULT_ILLUMINATION.animation);
      setAnimationSpeed(currentIllumination?.animationSpeed ?? DEFAULT_ILLUMINATION.animationSpeed);
      setAnimationIntensity(currentIllumination?.animationIntensity ?? DEFAULT_ILLUMINATION.animationIntensity);
    }
  }, [open, currentIllumination, effectSettings.lightFalloff]);

  const handleApply = () => {
    onApply({
      range,
      brightZone: useGlobalBrightZone ? undefined : brightZone,
      brightIntensity,
      dimIntensity,
      color,
      colorEnabled,
      colorIntensity,
      softEdge,
      softEdgeRadius,
      animation,
      animationSpeed,
      animationIntensity,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Token Illumination Settings</DialogTitle>
          <DialogDescription>
            {isMultiple
              ? `Configure illumination for ${tokenIds.length} tokens`
              : 'Configure how this token emits light and vision'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Preset Selector */}
          <div className="space-y-2">
            <Label>Preset</Label>
            <Select value={selectedPreset} onValueChange={(v) => applyPreset(v as PresetKey)}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select a preset" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="custom">⚙️ Custom</SelectItem>
                <SelectItem value="torch">🔥 Torch (40ft, flickering)</SelectItem>
                <SelectItem value="lantern">🏮 Lantern (60ft)</SelectItem>
                <SelectItem value="candle">🕯️ Candle (15ft, gentle flicker)</SelectItem>
                <SelectItem value="darkvision">👁️ Darkvision (60ft)</SelectItem>
                <SelectItem value="moonlight">🌙 Moonlight (120ft)</SelectItem>
                <SelectItem value="magicLight">✨ Magic Light (50ft, pulsing glow)</SelectItem>
                <SelectItem value="faerieLight">🧚 Faerie Fire (30ft, ethereal glow)</SelectItem>
                <SelectItem value="dancingLights">💫 Dancing Lights (10ft, rapid flicker)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Range */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Range (grid units)</Label>
              <span className="text-sm text-muted-foreground">{range}</span>
            </div>
            <Slider
              value={[range]}
              onValueChange={([v]) => { setRange(v); setSelectedPreset('custom'); }}
              min={1}
              max={24}
              step={1}
            />
          </div>

          {/* Bright Zone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Use Global Inner Zone</Label>
              <Switch
                checked={useGlobalBrightZone}
                onCheckedChange={setUseGlobalBrightZone}
              />
            </div>
            {!useGlobalBrightZone && (
              <>
                <div className="flex justify-between">
                  <Label className="text-sm">Bright Zone</Label>
                  <span className="text-sm text-muted-foreground">{Math.round(brightZone * 100)}%</span>
                </div>
                <Slider
                  value={[brightZone]}
                  onValueChange={([v]) => setBrightZone(v)}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {useGlobalBrightZone
                ? 'Using the global "Light Inner Zone" slider from fog settings'
                : 'Overriding global setting with custom bright zone'}
            </p>
          </div>

          {/* Intensities */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-sm">Bright Intensity</Label>
                <span className="text-xs text-muted-foreground">{Math.round(brightIntensity * 100)}%</span>
              </div>
              <Slider
                value={[brightIntensity]}
                onValueChange={([v]) => setBrightIntensity(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-sm">Dim Intensity</Label>
                <span className="text-xs text-muted-foreground">{Math.round(dimIntensity * 100)}%</span>
              </div>
              <Slider
                value={[dimIntensity]}
                onValueChange={([v]) => setDimIntensity(v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Enable Color Tint</Label>
              <Switch
                checked={colorEnabled}
                onCheckedChange={setColorEnabled}
              />
            </div>
            <div className={`flex gap-2 items-center ${!colorEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-14 h-10 p-1 cursor-pointer"
                disabled={!colorEnabled}
              />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
            {/* Color presets */}
            <div className={`flex gap-2 flex-wrap ${!colorEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              {['#FFFFFF', '#FFD700', '#FFA500', '#87CEEB', '#90EE90', '#FF6B6B'].map((c) => (
                <button
                  key={c}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  onClick={() => colorEnabled && setColor(c)}
                  disabled={!colorEnabled}
                />
              ))}
            </div>
            {/* Color Intensity Slider */}
            <div className={`space-y-2 ${!colorEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex justify-between">
                <Label className="text-sm">Color Intensity</Label>
                <span className="text-xs text-muted-foreground">{Math.round(colorIntensity * 100)}%</span>
              </div>
              <Slider
                value={[colorIntensity]}
                onValueChange={([v]) => setColorIntensity(v)}
                min={0.1}
                max={1}
                step={0.05}
                disabled={!colorEnabled}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {colorEnabled
                ? 'Light will be tinted with the selected color (warm torch, cool moonlight, etc.)'
                : 'Color tinting is disabled - light will appear neutral'}
            </p>
          </div>

          {/* Soft Edge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Soft Edge</Label>
              <Switch
                checked={softEdge}
                onCheckedChange={setSoftEdge}
              />
            </div>
            {softEdge && (
              <>
                <div className="flex justify-between">
                  <Label className="text-sm">Edge Blur Radius</Label>
                  <span className="text-sm text-muted-foreground">{softEdgeRadius}px</span>
                </div>
                <Slider
                  value={[softEdgeRadius]}
                  onValueChange={([v]) => setSoftEdgeRadius(v)}
                  min={0}
                  max={20}
                  step={1}
                />
              </>
            )}
          </div>

          {/* Animation */}
          <div className="space-y-2">
            <Label>Animation Effect</Label>
            <Select value={animation} onValueChange={(v) => { setAnimation(v as IlluminationAnimationType); setSelectedPreset('custom'); }}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select animation" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="none">None (steady light)</SelectItem>
                <SelectItem value="flicker">🔥 Flicker (torch-like)</SelectItem>
                <SelectItem value="candle">🕯️ Candle (gentle)</SelectItem>
                <SelectItem value="pulse">💫 Pulse (smooth intensity)</SelectItem>
                <SelectItem value="glow">✨ Glow (pulsing radius)</SelectItem>
              </SelectContent>
            </Select>
            
            {animation !== 'none' && (
              <div className="space-y-3 mt-3">
                <div className="flex justify-between">
                  <Label className="text-sm">Animation Speed</Label>
                  <span className="text-xs text-muted-foreground">{animationSpeed.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[animationSpeed]}
                  onValueChange={([v]) => setAnimationSpeed(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
                
                <div className="flex justify-between">
                  <Label className="text-sm">Animation Intensity</Label>
                  <span className="text-xs text-muted-foreground">{Math.round(animationIntensity * 100)}%</span>
                </div>
                <Slider
                  value={[animationIntensity]}
                  onValueChange={([v]) => setAnimationIntensity(v)}
                  min={0.1}
                  max={0.8}
                  step={0.05}
                />
                <p className="text-xs text-muted-foreground">
                  Higher intensity creates more dramatic light variations
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
