import React, { useState } from 'react';
import { useActiveEffectStore } from '@/stores/activeEffectStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useMapTemplateStore } from '@/stores/mapTemplateStore';
import type { ActiveEffect, ActiveEffectStep } from '@/lib/rules-engine/effectTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, Pencil, Check, X, Wand2, GitMerge, Map, Layers, GripVertical } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

// --- Shared Form Fields ---

interface EffectFormData {
  name: string;
  description: string;
  tagsString: string;
  durationValue: number;
  durationUnit: 'rounds' | 'minutes' | 'hours' | 'instant';
  triggerOnApply: boolean;
  triggerOnTurnStart: boolean;
  triggerOnTurnEnd: boolean;
  triggerOnRemove: boolean;
  steps: ActiveEffectStep[];
}

const INITIAL_FORM: EffectFormData = {
  name: '',
  description: '',
  tagsString: '',
  durationValue: 1,
  durationUnit: 'instant',
  triggerOnApply: true,
  triggerOnTurnStart: false,
  triggerOnTurnEnd: false,
  triggerOnRemove: false,
  steps: [],
};

function effectToForm(e: ActiveEffect): EffectFormData {
  return {
    name: e.name,
    description: e.description || '',
    tagsString: (e.tags || []).join(', '),
    durationValue: e.duration?.value ?? 1,
    durationUnit: e.duration?.unit ?? 'instant',
    triggerOnApply: e.triggers?.onApply ?? false,
    triggerOnTurnStart: e.triggers?.onTurnStart ?? false,
    triggerOnTurnEnd: e.triggers?.onTurnEnd ?? false,
    triggerOnRemove: e.triggers?.onRemove ?? false,
    steps: e.steps || [],
  };
}

function formToEffectData(form: EffectFormData): Omit<ActiveEffect, 'id'> {
  const tags = form.tagsString.split(',').map(t => t.trim()).filter(Boolean);
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    tags: tags.length > 0 ? tags : undefined,
    duration: form.durationUnit === 'instant' ? undefined : { value: form.durationValue, unit: form.durationUnit },
    triggers: {
      onApply: form.triggerOnApply || undefined,
      onTurnStart: form.triggerOnTurnStart || undefined,
      onTurnEnd: form.triggerOnTurnEnd || undefined,
      onRemove: form.triggerOnRemove || undefined,
    },
    steps: form.steps.length > 0 ? form.steps : undefined,
  };
}

function EffectFormFields({
  form,
  update,
}: {
  form: EffectFormData;
  update: <K extends keyof EffectFormData>(key: K, value: EffectFormData[K]) => void;
}) {
  const pipelines = useRuleStore(s => s.pipelines);
  const allTemplates = useMapTemplateStore(s => s.allTemplates);

  const addStep = () => {
    update('steps', [...form.steps, { type: 'pipeline', targetId: pipelines[0]?.id || '' }]);
  };

  const removeStep = (index: number) => {
    update('steps', form.steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, changes: Partial<ActiveEffectStep>) => {
    const newSteps = [...form.steps];
    newSteps[index] = { ...newSteps[index], ...changes };
    update('steps', newSteps);
  };

  const moveStep = (index: number, dir: 1 | -1) => {
    if (index + dir < 0 || index + dir >= form.steps.length) return;
    const newSteps = [...form.steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[index + dir];
    newSteps[index + dir] = temp;
    update('steps', newSteps);
  };

  return (
    <div className="space-y-4">
      {/* Metadata */}
      <div className="space-y-2">
        <Input
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Effect name (e.g. 'Fireball', 'Haste')"
          className="h-8 text-sm font-semibold"
        />
        <div className="flex gap-2">
          <Input
            value={form.tagsString}
            onChange={(e) => update('tagsString', e.target.value)}
            placeholder="Tags (comma separated, e.g. 'fire, aoe')"
            className="h-7 text-xs flex-1"
          />
        </div>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Markdown description / rules text"
          className="w-full bg-background border border-border rounded text-xs p-2 focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y"
        />
      </div>

      {/* Mechanics */}
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
        {/* Duration */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block">Duration</label>
          <div className="flex gap-1">
            <Select value={form.durationUnit} onValueChange={(v: any) => update('durationUnit', v)}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instantaneous</SelectItem>
                <SelectItem value="rounds">Rounds</SelectItem>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
              </SelectContent>
            </Select>
            {form.durationUnit !== 'instant' && (
              <NumericInput
                value={form.durationValue}
                onChange={(v) => update('durationValue', Math.max(1, v))}
                className="h-7 text-xs w-16"
                min={1}
              />
            )}
          </div>
        </div>

        {/* Triggers */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block">Triggers</label>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            {[
              { key: 'triggerOnApply' as const, label: 'On Apply' },
              { key: 'triggerOnTurnStart' as const, label: 'Turn Start' },
              { key: 'triggerOnTurnEnd' as const, label: 'Turn End' },
              { key: 'triggerOnRemove' as const, label: 'On Remove' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5">
                <Switch checked={form[key]} onCheckedChange={(v) => update(key, v)} className="scale-75 origin-left" />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orchestration Phase Steps */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Orchestration Steps</label>
          <Button variant="outline" size="sm" onClick={addStep} className="h-6 text-[10px] px-2 py-0">
            <Plus className="w-3 h-3 mr-1" /> Add Step
          </Button>
        </div>

        <div className="space-y-1.5 placeholder-empty:py-4">
          {form.steps.length === 0 && (
            <div className="text-center text-xs text-muted-foreground italic bg-muted/20 border border-dashed border-border rounded py-4">
              Resolves instantly with no execution. Add steps to trigger rules & geometry.
            </div>
          )}
          {form.steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-card border border-border rounded p-1.5 group">
              <div className="flex flex-col opacity-20 hover:opacity-100 cursor-ns-resize transition-opacity">
                <Button variant="ghost" className="h-4 w-4 p-0" onClick={() => moveStep(idx, -1)} disabled={idx === 0}>↑</Button>
                <Button variant="ghost" className="h-4 w-4 p-0" onClick={() => moveStep(idx, 1)} disabled={idx === form.steps.length - 1}>↓</Button>
              </div>
              
              <div className="w-10 text-center">
                {['pipeline', 'challenge_pipeline', 'damage_pipeline'].includes(step.type) ? <GitMerge className="w-4 h-4 text-indigo-400 mx-auto" /> : <Map className="w-4 h-4 text-emerald-400 mx-auto" />}
              </div>

              <Select value={step.type} onValueChange={(v: any) => {
                const draftId = ['pipeline', 'challenge_pipeline', 'damage_pipeline'].includes(v) ? pipelines[0]?.id : allTemplates[0]?.id;
                updateStep(idx, { type: v, targetId: draftId || '' });
              }}>
                <SelectTrigger className="h-7 text-xs w-[150px] shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="challenge_pipeline">Challenge Logic</SelectItem>
                  <SelectItem value="damage_pipeline">Damage Logic</SelectItem>
                  <SelectItem value="pipeline">Unified Logic</SelectItem>
                  <SelectItem value="maptemplate">Spawn Template</SelectItem>
                </SelectContent>
              </Select>

              <Select value={step.targetId} onValueChange={(v) => updateStep(idx, { targetId: v })}>
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select target..." /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {['pipeline', 'challenge_pipeline', 'damage_pipeline'].includes(step.type) && pipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name || 'Untitled'}</SelectItem>
                  ))}
                  {step.type === 'maptemplate' && allTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeStep(idx)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// --- Catalog Component ---

export function ActiveEffectsCatalog() {
  const effects = useActiveEffectStore(s => s.effects);
  const addEffect = useActiveEffectStore(s => s.addEffect);
  const updateEffect = useActiveEffectStore(s => s.updateEffect);
  const deleteEffect = useActiveEffectStore(s => s.deleteEffect);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<EffectFormData>(INITIAL_FORM);

  const selectedEffect = editingId ? effects.find(e => e.id === editingId) : null;

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setForm({ ...INITIAL_FORM });
  };

  const handleStartEdit = (e: ActiveEffect) => {
    setIsCreating(false);
    setEditingId(e.id);
    setForm(effectToForm(e));
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    
    if (isCreating) {
      addEffect(formToEffectData(form));
    } else if (editingId) {
      updateEffect(editingId, formToEffectData(form));
    }
    
    handleCancel();
  };

  const update = <K extends keyof EffectFormData>(key: K, value: EffectFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex h-full w-full">
      {/* Left List Pane */}
      <div className="w-1/3 min-w-[250px] max-w-[300px] border-r border-border bg-card/30 flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between shadow-sm z-10 bg-card">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-emerald-400" /> Orchestrators
          </h3>
          <Button size="sm" onClick={handleStartCreate} className="h-7 text-xs px-2">
            <Plus className="w-3 h-3 mr-1" /> New
          </Button>
        </div>

        <ScrollArea className="flex-1 p-2">
          {effects.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground">
              <Layers className="w-8 h-8 opacity-20 mx-auto mb-2" />
              <p className="text-xs">No active effects defined.</p>
              <p className="text-[10px] opacity-70 mt-1">Create orchestrators for complex spells and conditions.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {effects.map(e => (
                <div 
                  key={e.id}
                  onClick={() => handleStartEdit(e)}
                  className={`p-2 rounded border cursor-pointer flex items-center justify-between group transition-colors ${
                    editingId === e.id ? 'bg-primary/10 border-primary/30' : 'bg-card border-border hover:bg-accent'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold truncate">{e.name}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {e.duration?.unit !== 'instant' && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-background">
                          {e.duration?.value} {e.duration?.unit.charAt(0)}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-background text-indigo-400 border-indigo-500/30">
                        {e.steps?.length || 0} steps
                      </Badge>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(evt) => evt.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Effect orchestrator?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{e.name}"?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteEffect(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Form Pane */}
      <div className="flex-1 bg-background flex flex-col relative">
        {isCreating || editingId ? (
          <>
            <div className="p-3 border-b border-border bg-card flex justify-between items-center shadow-sm z-10 shrink-0 h-[52px]">
              <h3 className="font-semibold text-sm">
                {isCreating ? 'Create Orchestrator' : `Editing: ${selectedEffect?.name}`}
              </h3>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancel} className="h-8 text-xs text-muted-foreground">
                  <X className="w-3.5 h-3.5 mr-1" /> Discard
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!form.name.trim()} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
                  <Check className="w-3.5 h-3.5 mr-1" /> Save Effect
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-2xl mx-auto bg-card border border-border rounded-lg p-5 shadow-sm">
                <EffectFormFields form={form} update={update} />
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
            <Wand2 className="w-16 h-16 opacity-10 mb-4" />
            <h2 className="text-lg font-semibold opacity-70">Active Effect Orchestrator Editor</h2>
            <p className="text-sm opacity-50 max-w-sm text-center mt-2">
              Select an effect from the library to edit its phases, or create a new one to sequence Map Templates and Logic Pipelines together.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
