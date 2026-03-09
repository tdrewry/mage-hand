import React, { useState, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Volume2, VolumeX, ChevronDown, ChevronRight,
  Upload, Trash2, Play, Download, FolderOpen,
  RotateCcw,
} from 'lucide-react';
import { useSoundStore } from '@/stores/soundStore';
import {
  triggerSound,
  setCustomSound,
  removeCustomSound,
  exportSoundProfile,
  importSoundProfile,
  getSoundEventsByCategory,
  getAllSoundEvents,
  type SoundEvent,
  type SoundEventCategory,
} from '@/lib/soundEngine';
import { toast } from 'sonner';

// ── Category metadata ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<SoundEventCategory, string> = {
  action:     'Actions',
  chat:       'Chat',
  dice:       'Dice',
  initiative: 'Initiative',
  effect:     'Effects',
  portal:     'Portals',
  movement:   'Movement',
  fog:        'Fog',
  asset:      'Assets',
  ui:         'UI',
  ambient:    'Ambient',
};

const EVENT_LABELS: Partial<Record<SoundEvent, string>> = {
  'action.received':        'Action Received',
  'action.resolved':        'Action Resolved',
  'action.pending':         'Action Pending',
  'action.claim':           'Action Claim',
  'chat.message':           'Message',
  'chat.whisper':           'Whisper',
  'dice.roll':              'Roll',
  'dice.result':            'Result',
  'initiative.turnChange':  'Turn Change',
  'initiative.combatStart': 'Combat Start',
  'initiative.combatEnd':   'Combat End',
  'effect.placed':          'Placed',
  'effect.removed':         'Removed',
  'effect.triggered':       'Triggered',
  'portal.activate':        'Activate',
  'portal.teleport':        'Teleport',
  'movement.commit':        'Commit',
  'movement.collision':     'Collision',
  'fog.reveal':             'Reveal',
  'fog.hide':               'Hide',
  'asset.submitted':        'Submitted',
  'asset.approved':         'Approved',
  'asset.rejected':         'Rejected',
  'ui.notification':        'Notification',
  'ui.error':               'Error',
  'ui.success':             'Success',
  'ambient.loop':           'Loop',
};

// ── Sub-components ───────────────────────────────────────────────────────

interface EventRowProps {
  event: SoundEvent;
  disabled: boolean;
  onToggle: (event: SoundEvent, disabled: boolean) => void;
}

const EventRow: React.FC<EventRowProps> = ({ event, disabled, onToggle }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasCustom, setHasCustom] = useState(false);

  // Detect custom sound on mount
  React.useEffect(() => {
    import('@/lib/soundEngine').then(({ getAllCustomSounds }) => {
      getAllCustomSounds().then(all => {
        setHasCustom(all.some(e => e.eventName === event));
      });
    });
  }, [event]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await setCustomSound(event, file);
      setHasCustom(true);
      toast.success(`Custom sound set for ${EVENT_LABELS[event] ?? event}`);
    } catch {
      toast.error('Failed to save custom sound');
    }
    e.target.value = '';
  };

  const handleRemove = async () => {
    try {
      await removeCustomSound(event);
      setHasCustom(false);
      toast.success('Custom sound removed');
    } catch {
      toast.error('Failed to remove custom sound');
    }
  };

  return (
    <div className="flex items-center gap-2 py-1 group">
      <Switch
        checked={!disabled}
        onCheckedChange={(checked) => onToggle(event, !checked)}
        className="scale-75 shrink-0"
      />
      <span className="text-xs flex-1 text-foreground truncate">
        {EVENT_LABELS[event] ?? event}
      </span>
      {hasCustom && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">custom</Badge>
      )}
      {/* Preview */}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => triggerSound(event)}
        title="Preview sound"
      >
        <Play className="h-3 w-3" />
      </Button>
      {/* Upload */}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => fileRef.current?.click()}
        title="Upload custom audio"
      >
        <Upload className="h-3 w-3" />
      </Button>
      {hasCustom && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
          onClick={handleRemove}
          title="Remove custom audio"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
};

interface CategorySectionProps {
  category: SoundEventCategory;
  events: SoundEvent[];
}

const CategorySection: React.FC<CategorySectionProps> = ({ category, events }) => {
  const [open, setOpen] = useState(false);
  const { categoryVolumes, disabledEvents, setCategoryVolume, toggleEvent } = useSoundStore();
  const vol = categoryVolumes[category] ?? 1;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 p-0">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
        <span className="text-xs font-medium text-foreground w-20 shrink-0">
          {CATEGORY_LABELS[category]}
        </span>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[vol]}
          onValueChange={([v]) => setCategoryVolume(category as SoundEventCategory, v)}
          className="flex-1 h-4"
        />
        <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
          {Math.round(vol * 100)}%
        </span>
      </div>

      <CollapsibleContent>
        <div className="ml-7 mt-1 space-y-0.5 border-l border-border pl-3">
          {events.map(event => (
            <EventRow
              key={event}
              event={event}
              disabled={disabledEvents[event] ?? false}
              onToggle={toggleEvent}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

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
            min={0}
            max={1}
            step={0.01}
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

      {/* Per-category volumes + per-event toggles */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Categories — click to expand events</p>
        <div className="space-y-2">
          {(Object.keys(eventsByCategory) as SoundEventCategory[]).map(cat => (
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
            variant="outline"
            size="sm"
            onClick={() => importRef.current?.click()}
            className="w-full"
          >
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
            Import
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { reset(); toast.success('Sound settings reset to defaults'); }}
          className="w-full text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset to Defaults
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".mhsoundprofile,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>
    </div>
  );
};
