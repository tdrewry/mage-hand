import React from 'react';
import { useEffectStore } from '@/stores/effectStore';
import type { EffectTemplate, EffectCategory } from '@/types/effectTypes';
import { Flame, Zap, Cloud, Skull, Wand2, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const CATEGORY_META: Record<EffectCategory, { label: string; icon: React.ElementType }> = {
  spell: { label: 'Spells', icon: Wand2 },
  trap: { label: 'Traps', icon: Skull },
  hazard: { label: 'Hazards', icon: Cloud },
  custom: { label: 'Custom', icon: Flame },
};

const ANIMATION_ICONS: Record<string, React.ElementType> = {
  flicker: Flame,
  crackle: Zap,
  pulse: Cloud,
  expand: Play,
  swirl: Cloud,
};

function groupByCategory(templates: EffectTemplate[]): Record<string, EffectTemplate[]> {
  const groups: Record<string, EffectTemplate[]> = {};
  for (const t of templates) {
    const cat = t.category || 'custom';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  }
  return groups;
}

interface EffectTemplateRowProps {
  template: EffectTemplate;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

function EffectTemplateRow({ template, onSelect, onDelete }: EffectTemplateRowProps) {
  const AnimIcon = ANIMATION_ICONS[template.animation] || Wand2;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/50 group cursor-pointer"
      onClick={() => onSelect(template.id)}
    >
      {/* Colour swatch */}
      <div
        className="w-5 h-5 rounded-sm border border-border flex-shrink-0"
        style={{ backgroundColor: template.color, opacity: template.opacity }}
      />

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{template.name}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="capitalize">{template.shape}</span>
          {template.damageType && (
            <>
              <span>·</span>
              <span className="capitalize">{template.damageType}</span>
            </>
          )}
          {template.animation !== 'none' && (
            <>
              <span>·</span>
              <AnimIcon className="w-3 h-3 inline" />
            </>
          )}
        </div>
      </div>

      {template.persistence === 'persistent' && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
          {template.durationRounds ? `${template.durationRounds}r` : '∞'}
        </Badge>
      )}

      {template.level !== undefined && (
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
          L{template.level}
        </Badge>
      )}

      {!template.isBuiltIn && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      )}
    </div>
  );
}

export function EffectsCardContent() {
  const allTemplates = useEffectStore((s) => s.allTemplates);
  const placedEffects = useEffectStore((s) => s.placedEffects);
  const startPlacement = useEffectStore((s) => s.startPlacement);
  const removeEffect = useEffectStore((s) => s.removeEffect);
  const deleteCustomTemplate = useEffectStore((s) => s.deleteCustomTemplate);
  const placement = useEffectStore((s) => s.placement);

  const groups = groupByCategory(allTemplates);
  const categoryOrder: EffectCategory[] = ['spell', 'trap', 'hazard', 'custom'];

  const handleSelect = (templateId: string) => {
    startPlacement(templateId);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-3">
        {/* Placement status */}
        {placement && (
          <div className="bg-primary/10 border border-primary/30 rounded p-2 text-xs">
            <span className="font-medium">Placing:</span> {placement.template.name}
            <div className="text-muted-foreground mt-0.5">
              Click on map to place · ESC to cancel
            </div>
          </div>
        )}

        {/* Template library grouped by category */}
        {categoryOrder.map((cat) => {
          const templates = groups[cat];
          if (!templates || templates.length === 0) return null;
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          return (
            <div key={cat}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </span>
                <span className="text-[10px] text-muted-foreground">({templates.length})</span>
              </div>
              <div className="space-y-0.5">
                {templates.map((t) => (
                  <EffectTemplateRow
                    key={t.id}
                    template={t}
                    onSelect={handleSelect}
                    onDelete={t.isBuiltIn ? undefined : deleteCustomTemplate}
                  />
                ))}
              </div>
              <Separator className="mt-2" />
            </div>
          );
        })}

        {/* Active effects */}
        {placedEffects.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Active Effects ({placedEffects.length})
            </div>
            <div className="space-y-0.5">
              {placedEffects.map((e) => (
                <div key={e.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 group text-xs">
                  <div
                    className="w-3 h-3 rounded-sm border border-border flex-shrink-0"
                    style={{ backgroundColor: e.template.color }}
                  />
                  <span className="flex-1 truncate">{e.template.name}</span>
                  {e.roundsRemaining !== undefined && e.roundsRemaining > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {e.roundsRemaining}r
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {e.impactedTargets.length} hit
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                    onClick={() => removeEffect(e.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
