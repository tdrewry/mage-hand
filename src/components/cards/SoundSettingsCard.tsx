import React, { useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Volume2, VolumeX, Download, FolderOpen, RotateCcw,
} from 'lucide-react';
import { useSoundStore } from '@/stores/soundStore';
import {
  exportSoundProfile,
  importSoundProfile,
  getSoundEventsByCategory,
  type SoundEventCategory,
} from '@/lib/soundEngine';
import { AmbientSection } from './sound/AmbientSection';
import { CategorySection } from './sound/CategorySection';
import { toast } from 'sonner';

// ── Main Card ────────────────────────────────────────────────────────────

export const SoundSettingsCardContent: React.FC = () => {
  const {
    enabled, masterVolume,
    setEnabled, setMasterVolume, reset,
  } = useSoundStore();

  const importRef = useRef<HTMLInputElement>(null);
  const eventsByCategory = getSoundEventsByCategory();

  // ── Export ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const profile = await exportSoundProfile('My Sound Profile', 'Exported from Magehand');
      const json = JSON.stringify(profile, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sound-profile-${Date.now()}.mhsoundprofile`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Sound profile exported');
    } catch {
      toast.error('Export failed');
    }
  };

  // ── Import ──────────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const profile = JSON.parse(text);
      await importSoundProfile(profile);
      toast.success(`Sound profile "${profile.name}" imported`);
    } catch {
      toast.error('Import failed — invalid profile file');
    }
    e.target.value = '';
  };

  return (
    <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100%-8px)]">

      {/* Master toggle + volume */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enabled ? (
              <Volume2 className="h-4 w-4 text-foreground" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Sound</span>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-16 shrink-0">Master</span>
          <Slider
            min={0} max={1} step={0.01}
            value={[masterVolume]}
            onValueChange={([v]) => setMasterVolume(v)}
            disabled={!enabled}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
      </div>

      <Separator />

      {/* Ambient loops section */}
      <AmbientSection />

      <Separator />

      {/* Per-category volumes + per-event toggles */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Categories — click to expand events</p>
        <div className="space-y-2">
          {(Object.keys(eventsByCategory) as SoundEventCategory[]).map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              events={eventsByCategory[cat]}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Profile export / import / reset */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Sound Profile</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="w-full">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => importRef.current?.click()}
            className="w-full"
          >
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
            Import
          </Button>
        </div>
        <Button
          variant="ghost" size="sm"
          onClick={() => { reset(); toast.success('Sound settings reset to defaults'); }}
          className="w-full text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset to Defaults
        </Button>
        <input
          ref={importRef} type="file"
          accept=".mhsoundprofile,application/json"
          className="hidden" onChange={handleImportFile}
        />
      </div>
    </div>
  );
};
