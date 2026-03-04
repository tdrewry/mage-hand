import React, { useState, useMemo } from 'react';
import { useEffectStore } from '@/stores/effectStore';
import type { EffectTemplate, EffectCategory, EffectShape, EffectAnimationType, EffectPersistence, DamageDiceEntry, ScalingRule, LevelOverride } from '@/types/effectTypes';
import { computeScaledTemplate } from '@/types/effectTypes';
import { Flame, Zap, Cloud, Skull, Wand2, Trash2, Play, RotateCcw, Repeat, Ban, Plus, ChevronDown, ChevronRight, Pencil, Check, X, RotateCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  maxLength: number;
  segmentWidth: number;
  persistence: EffectPersistence;
  durationRounds: number;
  recurring: boolean;
  alignToGrid: boolean;
  targetCaster: boolean;
  ranged: boolean;
  skipRotation: boolean;
  color: string;
  opacity: number;
  animation: EffectAnimationType;
  animationSpeed: number;
  category: EffectCategory;
  damageDice: DamageDiceEntry[];
  level: string;
  multiDropCount: number;
  // Scaling
  baseLevel: string;
  scaling: ScalingRule[];
  levelOverrides: LevelOverride[];
}

const INITIAL_FORM: TemplateFormData = {
  name: '',
  shape: 'circle',
  radius: 4,
  length: 12,
  width: 1,
  angle: 53,
  maxLength: 12,
  segmentWidth: 0.2,
  persistence: 'instant',
  durationRounds: 0,
  recurring: true,
  alignToGrid: false,
  targetCaster: false,
  ranged: false,
  skipRotation: false,
  color: '#FF4500',
  opacity: 0.55,
  animation: 'none',
  animationSpeed: 1,
  category: 'custom',
  damageDice: [],
  level: '',
  multiDropCount: 1,
  baseLevel: '',
  scaling: [],
  levelOverrides: [],
};

function templateToForm(t: EffectTemplate): TemplateFormData {
  return {
    name: t.name,
    shape: t.shape,
    radius: t.radius ?? 4,
    length: t.length ?? 12,
    width: t.width ?? 1,
    angle: t.angle ?? 53,
    maxLength: t.maxLength ?? 12,
    segmentWidth: t.segmentWidth ?? 0.2,
    persistence: t.persistence,
    durationRounds: t.durationRounds ?? 0,
    recurring: t.recurring !== false,
    alignToGrid: t.alignToGrid ?? false,
    targetCaster: t.targetCaster ?? false,
    ranged: t.ranged ?? false,
    skipRotation: t.skipRotation ?? false,
    color: t.color,
    opacity: t.opacity,
    animation: t.animation,
    animationSpeed: t.animationSpeed,
    category: t.category,
    damageDice: t.damageDice ?? [],
    level: t.level !== undefined ? String(t.level) : '',
    multiDropCount: t.multiDrop?.count ?? 1,
    baseLevel: t.baseLevel !== undefined ? String(t.baseLevel) : '',
    scaling: t.scaling ?? [],
    levelOverrides: t.levelOverrides ?? [],
  };
}

// --- Damage Dice Rows Component ---

function DamageDiceRows({
  rows,
  onChange,
}: {
  rows: DamageDiceEntry[];
  onChange: (rows: DamageDiceEntry[]) => void;
}) {
  const addRow = () => onChange([...rows, { formula: '', damageType: '' }]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof DamageDiceEntry, value: string) =>
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground font-medium">Damage Dice</label>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1 items-center">
          <Input
            value={row.formula}
            onChange={(e) => updateRow(i, 'formula', e.target.value)}
            placeholder="e.g. 4d6"
            className="h-6 text-xs font-mono flex-1"
          />
          <Input
            value={row.damageType}
            onChange={(e) => updateRow(i, 'damageType', e.target.value)}
            placeholder="fire, radiant..."
            className="h-6 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => removeRow(i)}>
            <X className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full" onClick={addRow}>
        <Plus className="w-3 h-3 mr-1" /> Add Damage Row
      </Button>
    </div>
  );
}

// --- Scaling Rules Editor ---

const SCALABLE_PROPERTIES: { value: ScalingRule['property']; label: string }[] = [
  { value: 'damageDice', label: 'Damage Dice' },
  { value: 'radius', label: 'Radius' },
  { value: 'width', label: 'Width' },
  { value: 'length', label: 'Length' },
  { value: 'multiDropCount', label: 'Quantity' },
];

function ScalingRulesEditor({
  rules,
  onChange,
  damageDiceCount,
}: {
  rules: ScalingRule[];
  onChange: (rules: ScalingRule[]) => void;
  damageDiceCount: number;
}) {
  const addRule = () => onChange([...rules, { property: 'damageDice', perLevel: 1 }]);
  const removeRule = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, updates: Partial<ScalingRule>) =>
    onChange(rules.map((r, idx) => idx === i ? { ...r, ...updates } : r));

  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground font-medium">Scaling Rules (per upcast level)</label>
      {rules.map((rule, i) => (
        <div key={i} className="flex gap-1 items-center">
          <Select value={rule.property} onValueChange={(v) => updateRule(i, { property: v as ScalingRule['property'] })}>
            <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCALABLE_PROPERTIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-12">
            <NumericInput
              value={rule.perLevel}
              onChange={(v) => updateRule(i, { perLevel: v })}
              className="h-6 text-[10px]"
              min={1}
              max={20}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">/</span>
          <div className="w-10">
            <NumericInput
              value={rule.perLevels ?? 1}
              onChange={(v) => updateRule(i, { perLevels: v <= 1 ? undefined : v })}
              className="h-6 text-[10px]"
              min={1}
              max={9}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">lvl</span>
          {rule.property === 'damageDice' && damageDiceCount > 1 && (
            <div className="w-10">
              <NumericInput
                value={rule.diceIndex ?? 0}
                onChange={(v) => updateRule(i, { diceIndex: v })}
                className="h-6 text-[10px]"
                min={0}
                max={damageDiceCount - 1}
              />
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => removeRule(i)}>
            <X className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full" onClick={addRule}>
        <Plus className="w-3 h-3 mr-1" /> Add Scaling Rule
      </Button>
    </div>
  );
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
  const needsPolyline = form.shape === 'polyline';

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
            <SelectItem value="polyline">Polyline (Wall)</SelectItem>
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
            <NumericInput value={form.radius ?? 1} onChange={(v) => update('radius', v)} className="h-7 text-xs" min={1} />
          </div>
        )}
        {needsLength && (
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Length</label>
            <NumericInput value={form.length ?? 1} onChange={(v) => update('length', v)} className="h-7 text-xs" min={1} />
          </div>
        )}
        {needsWidth && (
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Width</label>
            <NumericInput value={form.width ?? 1} onChange={(v) => update('width', v)} className="h-7 text-xs" min={1} />
          </div>
        )}
        {needsAngle && (
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Angle°</label>
            <NumericInput value={form.angle ?? 1} onChange={(v) => update('angle', v)} className="h-7 text-xs" min={1} max={360} />
          </div>
        )}
        {needsPolyline && (
          <>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">Max Length</label>
              <NumericInput value={form.maxLength ?? 1} onChange={(v) => update('maxLength', v)} className="h-7 text-xs" min={1} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">Thickness</label>
              <NumericInput value={form.segmentWidth ?? 0.1} onChange={(v) => update('segmentWidth', v)} className="h-7 text-xs" min={0.1} step={0.1} float />
            </div>
          </>
        )}
      </div>

      {/* Quantity & Spell Level */}
      <div className="flex gap-2 items-end">
        <div className="w-20">
          <label className="text-[10px] text-muted-foreground">Quantity</label>
          <NumericInput
            value={form.multiDropCount ?? 1}
            onChange={(v) => update('multiDropCount', Math.max(1, v))}
            className="h-7 text-xs"
            min={1}
            max={20}
          />
        </div>
        <span className="text-[10px] text-muted-foreground pb-1.5">
          {form.multiDropCount > 1 ? `${form.multiDropCount} drops` : 'single'}
        </span>
        <div className="w-16">
          <label className="text-[10px] text-muted-foreground">Spell Lvl</label>
          <NumericInput
            value={form.level ? Number(form.level) : 0}
            onChange={(v) => update('level', String(v))}
            className="h-7 text-xs"
            min={0}
            max={9}
          />
        </div>
      </div>

      <div className="flex gap-2 items-end">
        <div>
          <label className="text-[10px] text-muted-foreground">Color</label>
          <input type="color" value={form.color} onChange={(e) => update('color', e.target.value)} className="w-7 h-7 rounded border border-border cursor-pointer" />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Opacity</label>
          <NumericInput value={form.opacity ?? 0.5} onChange={(v) => update('opacity', v)} className="h-7 text-xs" min={0.1} max={1} step={0.05} float />
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

      {/* Multi-row damage dice */}
      <DamageDiceRows
        rows={form.damageDice}
        onChange={(rows) => update('damageDice', rows)}
      />

      {/* Level Scaling Section */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground w-full">
          <TrendingUp className="w-3 h-3" />
          <span>Level Scaling</span>
          {form.scaling.length > 0 && (
            <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 ml-1">{form.scaling.length} rule{form.scaling.length > 1 ? 's' : ''}</Badge>
          )}
          <ChevronRight className="w-3 h-3 ml-auto" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-1">
          <div className="flex gap-2 items-end">
            <div className="w-20">
              <label className="text-[10px] text-muted-foreground">Base Level</label>
              <NumericInput
                value={form.baseLevel ? Number(form.baseLevel) : 0}
                onChange={(v) => update('baseLevel', v > 0 ? String(v) : '')}
                className="h-7 text-xs"
                min={0}
                max={9}
              />
            </div>
            <span className="text-[10px] text-muted-foreground pb-1.5">
              {form.baseLevel ? `Scalable from L${form.baseLevel}` : 'No scaling'}
            </span>
          </div>
          {form.baseLevel && (
            <ScalingRulesEditor
              rules={form.scaling}
              onChange={(rules) => update('scaling', rules)}
              damageDiceCount={form.damageDice.length}
            />
          )}
        </CollapsibleContent>
      </Collapsible>
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

      <div className="flex items-center gap-1">
        <Switch
          checked={form.skipRotation}
          onCheckedChange={(v) => update('skipRotation', v)}
          className="scale-75"
        />
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          Skip rotation step
        </span>
      </div>
    </>
  );
}

function formToTemplateData(form: TemplateFormData): Omit<EffectTemplate, 'id' | 'isBuiltIn'> {
  const cleanedDice = form.damageDice.filter(d => d.formula.trim());
  return {
    name: form.name.trim(),
    shape: form.shape,
    radius: form.radius,
    length: form.length,
    width: form.width,
    angle: form.angle,
    maxLength: form.shape === 'polyline' ? form.maxLength : undefined,
    segmentWidth: form.shape === 'polyline' ? form.segmentWidth : undefined,
    placementMode: 'free',
    persistence: form.persistence,
    durationRounds: form.persistence === 'persistent' ? form.durationRounds : undefined,
    recurring: form.persistence === 'persistent' ? form.recurring : undefined,
    alignToGrid: form.alignToGrid || undefined,
    targetCaster: form.targetCaster || undefined,
    ranged: form.ranged || undefined,
    skipRotation: form.skipRotation || undefined,
    color: form.color,
    opacity: form.opacity,
    animation: form.animation,
    animationSpeed: form.animationSpeed,
    category: form.category,
    damageType: cleanedDice.length > 0 ? cleanedDice[0].damageType : undefined,
    damageDice: cleanedDice.length > 0 ? cleanedDice : undefined,
    level: form.level ? Number(form.level) : undefined,
    multiDrop: form.multiDropCount > 1 ? { count: form.multiDropCount } : undefined,
    baseLevel: form.baseLevel ? Number(form.baseLevel) : undefined,
    scaling: form.scaling.length > 0 ? form.scaling : undefined,
    levelOverrides: form.levelOverrides.length > 0 ? form.levelOverrides : undefined,
  };
}

// --- Create Template Form ---

function CreateTemplateForm({ onCreated }: { onCreated: () => void }) {
  const addCustomTemplate = useEffectStore((s) => s.addCustomTemplate);
  const [form, setForm] = useState<TemplateFormData>({ ...INITIAL_FORM });

  const update = <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = () => {
    if (!form.name.trim()) return;
    addCustomTemplate(formToTemplateData(form));
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
    updateCustomTemplate(template.id, formToTemplateData(form));
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
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
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
        <div className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
          <span className="capitalize">{template.shape}</span>
          {template.damageDice && template.damageDice.length > 0 ? (
            template.damageDice.map((d, i) => (
              <React.Fragment key={i}>
                <span>·</span>
                <span className="font-mono">{d.formula}</span>
                <span className="capitalize">{d.damageType}</span>
              </React.Fragment>
            ))
          ) : template.damageType ? (
            <>
              <span>·</span>
              <span className="capitalize">{template.damageType}</span>
            </>
          ) : null}
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

      {template.multiDrop && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-accent-foreground border-accent">
          ×{template.multiDrop.count}
        </Badge>
      )}

      {template.scaling && template.scaling.length > 0 && (
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/50 text-primary">
          <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
          Scale
        </Badge>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onEdit(template.id); }}
      >
        <Pencil className="w-3 h-3 text-muted-foreground" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
      >
        <Trash2 className="w-3 h-3 text-destructive" />
      </Button>
    </div>
  );
}

// --- Main Card Content ---

export function EffectsCardContent() {
  const allTemplates = useEffectStore((s) => s.allTemplates);
  const placedEffects = useEffectStore((s) => s.placedEffects);
  const hiddenBuiltInIds = useEffectStore((s) => s.hiddenBuiltInIds);
  const startPlacement = useEffectStore((s) => s.startPlacement);
  const removeEffect = useEffectStore((s) => s.removeEffect);
  const resetTriggeredTokens = useEffectStore((s) => s.resetTriggeredTokens);
  const toggleRecurring = useEffectStore((s) => s.toggleRecurring);
  const deleteTemplate = useEffectStore((s) => s.deleteTemplate);
  const restoreBuiltInTemplates = useEffectStore((s) => s.restoreBuiltInTemplates);
  const placement = useEffectStore((s) => s.placement);

  const [damageFormula, setDamageFormula] = useState('');
  const [castLevelInput, setCastLevelInput] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const getTemplate = useEffectStore((s) => s.getTemplate);

  const groups = groupByCategory(allTemplates);
  const categoryOrder: EffectCategory[] = ['spell', 'trap', 'hazard', 'custom'];

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSelect = (templateId: string) => {
    if (editingTemplateId) return;
    const tmpl = getTemplate(templateId);
    const level = tmpl?.baseLevel && castLevelInput ? castLevelInput : undefined;
    startPlacement(templateId, undefined, damageFormula || undefined, undefined, level);
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
            Damage Dice Override
          </label>
          <Input
            value={damageFormula}
            onChange={(e) => setDamageFormula(e.target.value)}
            placeholder="e.g. 8d6, 2d10+4"
            className="h-7 text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            Overrides template dice when placing
          </p>
        </div>

        {/* Cast Level selector */}
        <div className="flex gap-2 items-end">
          <div className="w-20">
            <label className="text-[10px] text-muted-foreground">Cast Level</label>
            <NumericInput
              value={castLevelInput ?? 0}
              onChange={(v) => setCastLevelInput(v > 0 ? v : null)}
              className="h-7 text-xs"
              min={0}
              max={9}
            />
          </div>
          <span className="text-[10px] text-muted-foreground pb-1.5">
            {castLevelInput ? `Upcast to L${castLevelInput}` : 'Base level (no scaling)'}
          </span>
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
            {placement.castLevel && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-1">
                L{placement.castLevel}
              </Badge>
            )}
            {placement.damageFormula && (
              <span className="ml-1 font-mono text-muted-foreground">
                ({placement.damageFormula})
              </span>
            )}
            {placement.template.damageDice && placement.template.damageDice.length > 0 && !placement.damageFormula && (
              <span className="ml-1 font-mono text-muted-foreground">
                ({placement.template.damageDice.map(d => `${d.formula} ${d.damageType}`).join(' + ')})
              </span>
            )}
            {placement.multiDropTotal && placement.multiDropTotal > 1 && (
              <div className="text-primary font-medium mt-0.5">
                Drop {(placement.multiDropPlaced ?? 0) + 1} of {placement.multiDropTotal}
              </div>
            )}
            {placement.step === 'polyline' && (
              <div className="text-primary font-medium mt-0.5">
                {(placement.polylineWaypoints?.length ?? 0) === 0
                  ? 'Click to start wall'
                  : `${((placement.polylineWaypoints?.length ?? 1) - 1)} segments · Double-click or Enter to finish`}
              </div>
            )}
            <div className="text-muted-foreground mt-0.5">
              {placement.step === 'polyline'
                ? 'Click waypoints to draw wall · Double-click/Enter to finish · ESC to cancel'
                : 'Click on map to place · ESC to cancel'}
            </div>
          </div>
        )}

        {/* Template library grouped by category — collapsible */}
        {categoryOrder.map((cat) => {
          const templates = groups[cat];
          if (!templates || templates.length === 0) return null;
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const isOpen = !collapsedCategories.has(cat);
          return (
            <div key={cat}>
              <button
                className="flex items-center gap-1.5 mb-1 w-full hover:text-foreground"
                onClick={() => toggleCategory(cat)}
              >
                {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </span>
                <span className="text-[10px] text-muted-foreground">({templates.length})</span>
              </button>
              {isOpen && (
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
                        onDelete={deleteTemplate}
                        onEdit={handleEdit}
                      />
                    )
                  ))}
                </div>
              )}
              <Separator className="mt-2" />
            </div>
          );
        })}

        {/* Restore hidden built-ins */}
        {hiddenBuiltInIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground"
            onClick={restoreBuiltInTemplates}
          >
            <RotateCw className="w-3 h-3 mr-1" /> Restore {hiddenBuiltInIds.length} hidden template{hiddenBuiltInIds.length > 1 ? 's' : ''}
          </Button>
        )}

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
