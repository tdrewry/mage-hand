import React, { useState } from 'react';
import { useEffectStore } from '@/stores/effectStore';
import type { EffectTemplate, EffectCategory, EffectShape, EffectAnimationType, EffectPersistence } from '@/types/effectTypes';
import { Flame, Zap, Cloud, Skull, Wand2, Trash2, Play, RotateCcw, Repeat, Ban, Plus, ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

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

// --- Shared form fields type ---

interface TemplateFormData {
  name: string;
  shape: EffectShape;
  radius: number;
  length: number;
  width: number;
  angle: number;
  persistence: EffectPersistence;
  durationRounds: number;
  recurring: boolean;
  alignToGrid: boolean;
  targetCaster: boolean;
  ranged: boolean;
  color: string;
  opacity: number;
  animation: EffectAnimationType;
  animationSpeed: number;
  category: EffectCategory;
  damageType: string;
  level: string;
}

const INITIAL_FORM: TemplateFormData = {
  name: '',
  shape: 'circle',
  radius: 4,
  length: 12,
  width: 1,
  angle: 53,
  persistence: 'instant',
  durationRounds: 0,
  recurring: true,
  alignToGrid: false,
  targetCaster: false,
  ranged: false,
  color: '#FF4500',
  opacity: 0.55,
  animation: 'none',
  animationSpeed: 1,
  category: 'custom',
  damageType: '',
  level: '',
};

function templateToForm(t: EffectTemplate): TemplateFormData {
  return {
    name: t.name,
    shape: t.shape,
    radius: t.radius ?? 4,
    length: t.length ?? 12,
    width: t.width ?? 1,
    angle: t.angle ?? 53,
    persistence: t.persistence,
    durationRounds: t.durationRounds ?? 0,
    recurring: t.recurring !== false,
    alignToGrid: t.alignToGrid ?? false,
    targetCaster: t.targetCaster ?? false,
    ranged: t.ranged ?? false,
    color: t.color,
    opacity: t.opacity,
    animation: t.animation,
    animationSpeed: t.animationSpeed,
    category: t.category,
    damageType: t.damageType ?? '',
    level: t.level !== undefined ? String(t.level) : '',
  };
}

// --- Shared Form Fields Component ---

function TemplateFormFields({
  form,
  update,
}: {
  form: TemplateFormData;
  update: <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => void;
}) {
  const needsRadius = form.shape === 'circle' || form.shape === 'circle-burst';
  const needsLength = form.shape === 'line' || form.shape === 'cone';
  const needsWidth = form.shape === 'line' || form.shape === 'rectangle' || form.shape === 'rectangle-burst';
  const needsAngle = form.shape === 'cone';

  return (
    <>
      <Input
        value={form.name}
        onChange={(e) => update('name', e.target.value)}
        placeholder="Template name"
        className="h-7 text-xs"
      />

      <div className="flex gap-2">
        <Select value={form.shape} onValueChange={(v) => update('shape', v as EffectShape)}>
          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="circle">Circle</SelectItem>
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="cone">Cone</SelectItem>
            <SelectItem value="rectangle">Rectangle</SelectItem>
            <SelectItem value="circle-burst">Circle Burst</SelectItem>
            <SelectItem value="rectangle-burst">Rect Burst</SelectItem>
          </SelectContent>
        </Select>
        <Select value={form.category} onValueChange={(v) => update('category', v as EffectCategory)}>
          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="spell">Spell</SelectItem>
            <SelectItem value="trap">Trap</SelectItem>
            <SelectItem value="hazard">Hazard</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        {needsRadius && (
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Radius</label>
            <Input type="number" value={form.radius} onChange={(e) => update('radius', +e.target.value)} className="h-7 text-xs" min={1} />
          </div>
        )}
        {needsLength && (
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Length</label>
            <Input type="number" value={form.length} onChange={(e) => update('length', +e.target.value)} className="h-7 text-xs" min={1} />
          </div>
        )}
        {needsWidth && (
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Width</label>
            <Input type="number" value={form.width} onChange={(e) => update('width', +e.target.value)} className="h-7 text-xs" min={1} />
          </div>
        )}
        {needsAngle && (
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Angle°</label>
            <Input type="number" value={form.angle} onChange={(e) => update('angle', +e.target.value)} className="h-7 text-xs" min={1} max={360} />
          </div>
        )}
      </div>

      <div className="flex gap-2 items-end">
        <div>
          <label className="text-[10px] text-muted-foreground">Color</label>
          <input type="color" value={form.color} onChange={(e) => update('color', e.target.value)} className="w-7 h-7 rounded border border-border cursor-pointer" />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Opacity</label>
          <Input type="number" value={form.opacity} onChange={(e) => update('opacity', +e.target.value)} className="h-7 text-xs" min={0.1} max={1} step={0.05} />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Animation</label>
          <Select value={form.animation} onValueChange={(v) => update('animation', v as EffectAnimationType)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="flicker">Flicker</SelectItem>
              <SelectItem value="crackle">Crackle</SelectItem>
              <SelectItem value="pulse">Pulse</SelectItem>
              <SelectItem value="expand">Expand</SelectItem>
              <SelectItem value="swirl">Swirl</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={form.damageType}
          onChange={(e) => update('damageType', e.target.value)}
          placeholder="Damage type (fire, cold, etc.)"
          className="h-7 text-xs flex-1"
        />
        <Input
          value={form.level}
          onChange={(e) => update('level', e.target.value)}
          placeholder="Spell level"
          type="number"
          min={0}
          max={9}
          className="h-7 text-xs w-20"
        />
      </div>

      <div className="flex gap-2 items-center">
        <Select value={form.persistence} onValueChange={(v) => update('persistence', v as EffectPersistence)}>
          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="instant">Instant</SelectItem>
            <SelectItem value="persistent">Persistent</SelectItem>
          </SelectContent>
        </Select>
        {form.persistence === 'persistent' && (
          <>
            <div className="flex-1">
              <Input type="number" value={form.durationRounds} onChange={(e) => update('durationRounds', +e.target.value)} className="h-7 text-xs" min={0} placeholder="Rounds (0=∞)" />
            </div>
            <div className="flex items-center gap-1">
              <Switch
                checked={form.recurring}
                onCheckedChange={(v) => update('recurring', v)}
                className="scale-75"
              />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {form.recurring ? 'Recurring' : 'One-shot'}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Switch
          checked={form.alignToGrid}
          onCheckedChange={(v) => update('alignToGrid', v)}
          className="scale-75"
        />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          Align to grid (45° snap)
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Switch
          checked={form.targetCaster}
          onCheckedChange={(v) => update('targetCaster', v)}
          className="scale-75"
        />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          Include caster in targets
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Switch
          checked={form.ranged}
          onCheckedChange={(v) => update('ranged', v)}
          className="scale-75"
        />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          Ranged (place at distance)
        </span>
      </div>
    </>
  );
}

// --- Create Template Form ---

function CreateTemplateForm({ onCreated }: { onCreated: () => void }) {
  const addCustomTemplate = useEffectStore((s) => s.addCustomTemplate);
  const [form, setForm] = useState<TemplateFormData>({ ...INITIAL_FORM });

  const update = <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = () => {
    if (!form.name.trim()) return;
    addCustomTemplate({
      name: form.name.trim(),
      shape: form.shape,
      radius: form.radius,
      length: form.length,
      width: form.width,
      angle: form.angle,
      placementMode: 'free',
      persistence: form.persistence,
      durationRounds: form.persistence === 'persistent' ? form.durationRounds : undefined,
      recurring: form.persistence === 'persistent' ? form.recurring : undefined,
      alignToGrid: form.alignToGrid || undefined,
      targetCaster: form.targetCaster || undefined,
      ranged: form.ranged || undefined,
      color: form.color,
      opacity: form.opacity,
      animation: form.animation,
      animationSpeed: form.animationSpeed,
      category: form.category,
      damageType: form.damageType || undefined,
      level: form.level ? Number(form.level) : undefined,
    });
    setForm({ ...INITIAL_FORM });
    onCreated();
  };

  return (
    <div className="space-y-2 p-2 border border-border rounded bg-muted/30">
      <TemplateFormFields form={form} update={update} />
      <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreate} disabled={!form.name.trim()}>
        <Plus className="w-3 h-3 mr-1" /> Create Template
      </Button>
    </div>
  );
}

// --- Edit Template Form ---

function EditTemplateForm({ template, onDone }: { template: EffectTemplate; onDone: () => void }) {
  const updateCustomTemplate = useEffectStore((s) => s.updateCustomTemplate);
  const [form, setForm] = useState<TemplateFormData>(() => templateToForm(template));

  const update = <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    updateCustomTemplate(template.id, {
      name: form.name.trim(),
      shape: form.shape,
      radius: form.radius,
      length: form.length,
      width: form.width,
      angle: form.angle,
      persistence: form.persistence,
      durationRounds: form.persistence === 'persistent' ? form.durationRounds : undefined,
      recurring: form.persistence === 'persistent' ? form.recurring : undefined,
      alignToGrid: form.alignToGrid || undefined,
      targetCaster: form.targetCaster || undefined,
      ranged: form.ranged || undefined,
      color: form.color,
      opacity: form.opacity,
      animation: form.animation,
      animationSpeed: form.animationSpeed,
      category: form.category,
      damageType: form.damageType || undefined,
      level: form.level ? Number(form.level) : undefined,
    });
    onDone();
  };

  return (
    <div className="space-y-2 p-2 border border-primary/40 rounded bg-primary/5">
      <TemplateFormFields form={form} update={update} />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSave} disabled={!form.name.trim()}>
          <Check className="w-3 h-3 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDone}>
          <X className="w-3 h-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// --- Template Row ---

interface EffectTemplateRowProps {
  template: EffectTemplate;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

function EffectTemplateRow({ template, onSelect, onDelete, onEdit }: EffectTemplateRowProps) {
  const AnimIcon = ANIMATION_ICONS[template.animation] || Wand2;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/50 group cursor-pointer"
      onClick={() => onSelect(template.id)}
    >
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
          {template.persistence === 'persistent' && (
            <>
              <span>·</span>
              <span title={template.recurring === false ? 'One-shot' : 'Recurring'}>
                {template.recurring === false
                  ? <Ban className="w-3 h-3 inline" />
                  : <Repeat className="w-3 h-3 inline" />}
              </span>
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

      {template.ranged && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-accent-foreground border-accent">
          Ranged
        </Badge>
      )}

      {!template.isBuiltIn && onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onEdit(template.id); }}
        >
          <Pencil className="w-3 h-3 text-muted-foreground" />
        </Button>
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

// --- Main Card Content ---

export function EffectsCardContent() {
  const allTemplates = useEffectStore((s) => s.allTemplates);
  const placedEffects = useEffectStore((s) => s.placedEffects);
  const startPlacement = useEffectStore((s) => s.startPlacement);
  const removeEffect = useEffectStore((s) => s.removeEffect);
  const resetTriggeredTokens = useEffectStore((s) => s.resetTriggeredTokens);
  const toggleRecurring = useEffectStore((s) => s.toggleRecurring);
  const deleteCustomTemplate = useEffectStore((s) => s.deleteCustomTemplate);
  const placement = useEffectStore((s) => s.placement);

  const [damageFormula, setDamageFormula] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const groups = groupByCategory(allTemplates);
  const categoryOrder: EffectCategory[] = ['spell', 'trap', 'hazard', 'custom'];

  const handleSelect = (templateId: string) => {
    if (editingTemplateId) return; // Don't place while editing
    startPlacement(templateId, undefined, damageFormula || undefined);
  };

  const handleEdit = (templateId: string) => {
    setEditingTemplateId(templateId);
    setShowCreateForm(false);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-3">
        {/* Damage formula input */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Damage Dice
          </label>
          <Input
            value={damageFormula}
            onChange={(e) => setDamageFormula(e.target.value)}
            placeholder="e.g. 8d6, 2d10+4"
            className="h-7 text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            Auto-rolls when effect hits tokens
          </p>
        </div>

        <Separator />

        {/* Create custom template */}
        <div>
          <button
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground w-full"
            onClick={() => { setShowCreateForm((v) => !v); setEditingTemplateId(null); }}
          >
            {showCreateForm ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Create Template
          </button>
          {showCreateForm && (
            <div className="mt-1.5">
              <CreateTemplateForm onCreated={() => setShowCreateForm(false)} />
            </div>
          )}
        </div>

        <Separator />

        {/* Placement status */}
        {placement && (
          <div className="bg-primary/10 border border-primary/30 rounded p-2 text-xs">
            <span className="font-medium">Placing:</span> {placement.template.name}
            {placement.damageFormula && (
              <span className="ml-1 font-mono text-muted-foreground">
                ({placement.damageFormula})
              </span>
            )}
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
                  editingTemplateId === t.id ? (
                    <EditTemplateForm
                      key={t.id}
                      template={t}
                      onDone={() => setEditingTemplateId(null)}
                    />
                  ) : (
                    <EffectTemplateRow
                      key={t.id}
                      template={t}
                      onSelect={handleSelect}
                      onDelete={t.isBuiltIn ? undefined : deleteCustomTemplate}
                      onEdit={t.isBuiltIn ? undefined : handleEdit}
                    />
                  )
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
                  {e.template.persistence === 'persistent' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      title={e.template.recurring === false ? 'One-shot (click to make recurring)' : 'Recurring each round (click to make one-shot)'}
                      onClick={() => toggleRecurring(e.id)}
                    >
                      {e.template.recurring === false
                        ? <Ban className="w-3 h-3 text-muted-foreground" />
                        : <Repeat className="w-3 h-3 text-primary" />}
                    </Button>
                  )}
                  {e.roundsRemaining !== undefined && e.roundsRemaining > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {e.roundsRemaining}r
                    </Badge>
                  )}
                  {e.triggeredTokenIds.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      {e.triggeredTokenIds.length} trg
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {e.impactedTargets.length} hit
                  </span>
                  {e.template.persistence === 'persistent' && e.triggeredTokenIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100"
                      title="Reset triggers — tokens can trigger this effect again"
                      onClick={() => resetTriggeredTokens(e.id)}
                    >
                      <RotateCcw className="w-3 h-3 text-primary" />
                    </Button>
                  )}
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
