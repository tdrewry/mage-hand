import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useSoundStore } from '@/stores/soundStore';
import type { SoundEvent, SoundEventCategory } from '@/lib/soundEngine';
import { EventQueueRow } from './EventQueueRow';

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

interface CategorySectionProps {
  category: SoundEventCategory;
  events: SoundEvent[];
}

export const CategorySection: React.FC<CategorySectionProps> = ({ category, events }) => {
  const [open, setOpen] = useState(false);
  const { categoryVolumes, disabledEvents, setCategoryVolume, toggleEvent } = useSoundStore();
  const vol = categoryVolumes[category] ?? 1;

  // Skip ambient category (handled by AmbientSection)
  if (category === 'ambient') return null;

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
          min={0} max={1} step={0.01}
          value={[vol]}
          onValueChange={([v]) => setCategoryVolume(category, v)}
          className="flex-1 h-4"
        />
        <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
          {Math.round(vol * 100)}%
        </span>
      </div>

      <CollapsibleContent>
        <div className="ml-7 mt-1 space-y-0.5 border-l border-border pl-3">
          {events.map((event) => (
            <EventQueueRow
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
