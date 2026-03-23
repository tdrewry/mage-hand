import React from 'react';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import type { CreatureAction } from '@/types/creatureTypes';
import { useEffectStore } from '@/stores/effectStore';
import { useRuleStore } from '@/stores/ruleStore';

interface ActionEditorProps {
  action: CreatureAction;
  onChange: (updated: CreatureAction) => void;
  onDelete?: () => void;
}

export function ActionEditor({ action, onChange, onDelete }: ActionEditorProps) {
  const allTemplates = useEffectStore(s => s.allTemplates);
  const pipelines = useRuleStore(s => s.pipelines);

  return (
    <div className="border border-border rounded p-2 space-y-1.5 bg-muted/20">
      <div className="flex items-center gap-1">
        <Input
          value={action.name}
          onChange={e => onChange({ ...action, name: e.target.value })}
          className="h-6 text-xs font-semibold flex-1"
          placeholder="Action name"
        />
        {onDelete && (
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onDelete}>
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-1">
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground uppercase">To Hit</label>
          <NumericInput
            value={action.attackBonus ?? 0}
            onChange={v => onChange({ ...action, attackBonus: v })}
            className="h-6 text-[10px]"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground uppercase">Damage</label>
          <Input
            value={action.damage ?? ''}
            onChange={e => onChange({ ...action, damage: e.target.value })}
            className="h-6 text-[10px] font-mono"
            placeholder="1d8+3"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground uppercase">Type</label>
          <Input
            value={action.damageType ?? ''}
            onChange={e => onChange({ ...action, damageType: e.target.value })}
            className="h-6 text-[10px]"
            placeholder="slashing"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] text-muted-foreground uppercase">Range</label>
          <Input
            value={action.range ?? ''}
            onChange={e => onChange({ ...action, range: e.target.value })}
            className="h-6 text-[10px]"
            placeholder="5 ft."
          />
        </div>
      </div>
      
      <div className="space-y-0.5">
        <label className="text-[9px] text-muted-foreground uppercase">Description</label>
        <Input
          value={action.description ?? ''}
          onChange={e => onChange({ ...action, description: e.target.value })}
          className="h-6 text-[10px]"
        />
      </div>

      <div className="pt-2 mt-2 border-t border-border/50">
        <label className="text-[9px] font-semibold text-muted-foreground uppercase mb-1.5 block">Engine Routing</label>
        <div className="grid grid-cols-2 gap-2">
          {/* Targeting Mode */}
          <div className="space-y-0.5">
            <label className="text-[9px] text-muted-foreground uppercase">Targeting Mode</label>
            <Select 
              value={action.targetingMode || 'manual'} 
              onValueChange={(v: 'manual' | 'template' | 'self') => onChange({ ...action, targetingMode: v })}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue placeholder="Manual Selection" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual" className="text-[10px]">Manual Selection</SelectItem>
                <SelectItem value="template" className="text-[10px]">Map Template</SelectItem>
                <SelectItem value="self" className="text-[10px]">Self</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Execution Policy */}
          <div className="space-y-0.5">
            <label className="text-[9px] text-muted-foreground uppercase">Execution Policy</label>
            <Select 
              value={action.executionPolicy || 'per-target'} 
              onValueChange={(v: 'shared' | 'per-target') => onChange({ ...action, executionPolicy: v })}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue placeholder="Per-Target" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared" className="text-[10px]">Shared Roll (AoE)</SelectItem>
                <SelectItem value="per-target" className="text-[10px]">Per-Target (Multi-attack)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Map Template */}
          {action.targetingMode === 'template' && (
            <div className="space-y-0.5 col-span-2">
              <label className="text-[9px] text-muted-foreground uppercase">Template ID</label>
              <Select 
                value={action.templateId || 'none'} 
                onValueChange={v => onChange({ ...action, templateId: v === 'none' ? undefined : v })}
              >
                <SelectTrigger className="h-6 text-[10px]">
                  <SelectValue placeholder="Select Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-[10px]">None</SelectItem>
                  {allTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-[10px]">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dynamic Logic Pipeline */}
          <div className="space-y-0.5 col-span-2">
            <label className="text-[9px] text-muted-foreground uppercase">Pipeline ID</label>
            <Select 
              value={action.pipelineId || 'none'} 
              onValueChange={v => onChange({ ...action, pipelineId: v === 'none' ? undefined : v })}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue placeholder="Default Attack" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-[10px]">Default Attack</SelectItem>
                {pipelines.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-[10px]">{p.name || 'Untitled'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
