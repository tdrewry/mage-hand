import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useMapFocusStore } from '@/stores/mapFocusStore';
import { useMapStore } from '@/stores/mapStore';
import { Focus } from 'lucide-react';

/**
 * Compact settings panel for map focus blur/fade and selection locking.
 * Designed to be embedded in MapManagerCard or a dedicated card.
 */
export const MapFocusSettings: React.FC = () => {
  const unfocusedOpacity = useMapFocusStore((s) => s.unfocusedOpacity);
  const unfocusedBlur = useMapFocusStore((s) => s.unfocusedBlur);
  const selectionLockEnabled = useMapFocusStore((s) => s.selectionLockEnabled);
  const setUnfocusedOpacity = useMapFocusStore((s) => s.setUnfocusedOpacity);
  const setUnfocusedBlur = useMapFocusStore((s) => s.setUnfocusedBlur);
  const setSelectionLockEnabled = useMapFocusStore((s) => s.setSelectionLockEnabled);
  const autoFocusFollowsToken = useMapStore((s) => s.autoFocusFollowsToken);
  const setAutoFocusFollowsToken = useMapStore((s) => s.setAutoFocusFollowsToken);

  const dimPercent = Math.round((1 - unfocusedOpacity) * 100);
  const isActive = unfocusedOpacity < 1 || unfocusedBlur > 0;

  return (
    <div className="space-y-3 p-3 rounded-md border border-border bg-card/50">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Focus className="h-3.5 w-3.5 text-primary" />
        Map Focus
      </div>

      {/* Opacity (shown as "Dim" percentage for clarity) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Non-focused dim</Label>
          <span className="text-xs text-muted-foreground tabular-nums">{dimPercent}%</span>
        </div>
        <Slider
          min={0}
          max={80}
          step={5}
          value={[dimPercent]}
          onValueChange={([v]) => setUnfocusedOpacity(1 - v / 100)}
        />
      </div>

      {/* Blur */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Non-focused blur</Label>
          <span className="text-xs text-muted-foreground tabular-nums">{unfocusedBlur}px</span>
        </div>
        <Slider
          min={0}
          max={8}
          step={0.5}
          value={[unfocusedBlur]}
          onValueChange={([v]) => setUnfocusedBlur(v)}
        />
      </div>

      {/* Selection lock toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Lock non-focused selection</Label>
        <Switch
          checked={selectionLockEnabled || isActive}
          onCheckedChange={setSelectionLockEnabled}
          disabled={isActive} // Auto-enabled when effects are active
        />
      </div>

      {/* Auto-focus follows active token */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Auto-focus follows turn</Label>
        <Switch
          checked={autoFocusFollowsToken}
          onCheckedChange={setAutoFocusFollowsToken}
        />
      </div>

      {isActive && (
        <p className="text-[10px] text-muted-foreground leading-tight">
          Entities on non-focused maps cannot be selected while focus effects are active.
        </p>
      )}
    </div>
  );
};
