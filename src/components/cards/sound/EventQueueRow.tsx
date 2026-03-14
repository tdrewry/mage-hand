import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Play, Upload, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useSoundStore } from '@/stores/soundStore';
import { triggerSound, type SoundEvent } from '@/lib/soundEngine';
import { addToAudioLibrary, getFromAudioLibrary } from '@/lib/audioLibrary';
import { toast } from 'sonner';

const EVENT_LABELS: Partial<Record<SoundEvent, string>> = {
  'action.received':        'Action Received',
  'action.resolved':        'Action Resolved',
  'action.pending':         'Action Pending',
  'action.claim':           'Action Claim',
  'chat.message':           'Message',
  'chat.whisper':           'Whisper',
  'dice.roll':              'Roll',
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

interface EventQueueRowProps {
  event: SoundEvent;
  disabled: boolean;
  onToggle: (event: SoundEvent, disabled: boolean) => void;
}

export const EventQueueRow: React.FC<EventQueueRowProps> = ({ event, disabled, onToggle }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { eventQueues, addToEventQueue, removeFromEventQueue } = useSoundStore();
  const queue = eventQueues[event] ?? [];
  const [expanded, setExpanded] = useState(false);
  const [queueNames, setQueueNames] = useState<Record<string, string>>({});

  // Legacy custom sound detection
  const [hasLegacyCustom, setHasLegacyCustom] = useState(false);
  useEffect(() => {
    import('@/lib/soundEngine').then(({ getAllCustomSounds }) => {
      getAllCustomSounds().then((all) => {
        setHasLegacyCustom(all.some((e) => e.eventName === event));
      });
    });
  }, [event]);

  // Resolve queue entry names
  useEffect(() => {
    if (queue.length === 0) return;
    Promise.all(
      queue.map(async (id) => {
        const entry = await getFromAudioLibrary(id);
        return [id, entry?.name ?? 'Unknown'] as const;
      })
    ).then((pairs) => setQueueNames(Object.fromEntries(pairs)));
  }, [queue]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const entry = await addToAudioLibrary(file);
      addToEventQueue(event, entry.id);
      toast.success(`Added "${entry.name}" to ${EVENT_LABELS[event] ?? event} queue`);
    } catch {
      toast.error('Failed to add audio');
    }
    e.target.value = '';
  };

  const handleRemoveLegacy = async () => {
    try {
      const { removeCustomSound } = await import('@/lib/soundEngine');
      await removeCustomSound(event);
      setHasLegacyCustom(false);
      toast.success('Legacy custom sound removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const totalCustom = queue.length + (hasLegacyCustom ? 1 : 0);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 py-1">
        <Switch
          checked={!disabled}
          onCheckedChange={(checked) => onToggle(event, !checked)}
          className="scale-75 shrink-0"
        />
        <span className="text-xs flex-1 text-foreground truncate">
          {EVENT_LABELS[event] ?? event}
        </span>

        {totalCustom > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1 py-0 shrink-0 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {totalCustom} custom
          </Badge>
        )}

        {/* Preview */}
        <Button
          variant="ghost" size="icon"
          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => triggerSound(event)}
          title="Preview sound (random from queue)"
        >
          <Play className="h-3 w-3" />
        </Button>

        {/* Add to queue */}
        <Button
          variant="ghost" size="icon"
          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => fileRef.current?.click()}
          title="Add audio to queue"
        >
          <Upload className="h-3 w-3" />
        </Button>

        {totalCustom > 0 && (
          <Button
            variant="ghost" size="icon"
            className="h-4 w-4 shrink-0 text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        )}

        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
      </div>

      {/* Expanded queue */}
      {expanded && totalCustom > 0 && (
        <div className="ml-7 pl-2 border-l border-border space-y-0.5">
          {hasLegacyCustom && (
            <div className="flex items-center gap-2 py-0.5 text-[10px]">
              <span className="flex-1 text-muted-foreground truncate italic">legacy custom</span>
              <Button
                variant="ghost" size="icon"
                className="h-4 w-4 shrink-0 text-destructive/70 hover:text-destructive"
                onClick={handleRemoveLegacy}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          )}
          {queue.map((id) => (
            <div key={id} className="flex items-center gap-2 py-0.5 text-[10px]">
              <span className="flex-1 text-muted-foreground truncate">
                {queueNames[id] ?? id.slice(0, 8)}
              </span>
              <Button
                variant="ghost" size="icon"
                className="h-4 w-4 shrink-0 text-destructive/70 hover:text-destructive"
                onClick={() => {
                  removeFromEventQueue(event, id);
                  toast.success('Removed from queue');
                }}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
