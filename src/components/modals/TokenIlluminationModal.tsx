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
import { useFogStore } from '@/stores/fogStore';
import type { IlluminationSource } from '@/types/illumination';
import { DEFAULT_ILLUMINATION } from '@/types/illumination';

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
  const [range, setRange] = useState(currentIllumination?.range ?? DEFAULT_ILLUMINATION.range);
  const [brightZone, setBrightZone] = useState(currentIllumination?.brightZone ?? effectSettings.lightFalloff);
  const [brightIntensity, setBrightIntensity] = useState(currentIllumination?.brightIntensity ?? DEFAULT_ILLUMINATION.brightIntensity);
  const [dimIntensity, setDimIntensity] = useState(currentIllumination?.dimIntensity ?? DEFAULT_ILLUMINATION.dimIntensity);
  const [color, setColor] = useState(currentIllumination?.color ?? DEFAULT_ILLUMINATION.color);
  const [softEdge, setSoftEdge] = useState(currentIllumination?.softEdge ?? DEFAULT_ILLUMINATION.softEdge);
  const [softEdgeRadius, setSoftEdgeRadius] = useState(currentIllumination?.softEdgeRadius ?? DEFAULT_ILLUMINATION.softEdgeRadius);
  const [useGlobalBrightZone, setUseGlobalBrightZone] = useState(!currentIllumination?.brightZone);

  // Reset form when modal opens with new token
  useEffect(() => {
    if (open) {
      setRange(currentIllumination?.range ?? DEFAULT_ILLUMINATION.range);
      setBrightZone(currentIllumination?.brightZone ?? effectSettings.lightFalloff);
      setBrightIntensity(currentIllumination?.brightIntensity ?? DEFAULT_ILLUMINATION.brightIntensity);
      setDimIntensity(currentIllumination?.dimIntensity ?? DEFAULT_ILLUMINATION.dimIntensity);
      setColor(currentIllumination?.color ?? DEFAULT_ILLUMINATION.color);
      setSoftEdge(currentIllumination?.softEdge ?? DEFAULT_ILLUMINATION.softEdge);
      setSoftEdgeRadius(currentIllumination?.softEdgeRadius ?? DEFAULT_ILLUMINATION.softEdgeRadius);
      setUseGlobalBrightZone(!currentIllumination?.brightZone);
    }
  }, [open, currentIllumination, effectSettings.lightFalloff]);

  const handleApply = () => {
    onApply({
      range,
      brightZone: useGlobalBrightZone ? undefined : brightZone,
      brightIntensity,
      dimIntensity,
      color,
      softEdge,
      softEdgeRadius,
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
          {/* Range */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Range (grid units)</Label>
              <span className="text-sm text-muted-foreground">{range}</span>
            </div>
            <Slider
              value={[range]}
              onValueChange={([v]) => setRange(v)}
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
            <Label>Light Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-14 h-10 p-1 cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
            {/* Color presets */}
            <div className="flex gap-2 flex-wrap">
              {['#FFFFFF', '#FFD700', '#FFA500', '#87CEEB', '#90EE90', '#FF6B6B'].map((c) => (
                <button
                  key={c}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
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
