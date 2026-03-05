import React, { useState, useMemo } from 'react';
import { useEffectStore } from '@/stores/effectStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useCreatureStore } from '@/stores/creatureStore';
import type { EffectTemplate, EffectCategory, EffectShape, EffectAnimationType, EffectPersistence, EffectDurationType, EffectTemplateMode, EffectTriggerTiming, DamageDiceEntry, ScalingRule, LevelOverride, EffectModifier, EffectModifierOperation, EffectCondition, EffectGrantedAction, EffectAttackRoll, AuraConfig } from '@/types/effectTypes';
import { computeScaledTemplate, EFFECT_MODIFIER_TARGETS, DND_5E_CONDITIONS } from '@/types/effectTypes';
import { Flame, Zap, Cloud, Skull, Wand2, Trash2, Play, RotateCcw, Repeat, Ban, Plus, ChevronDown, ChevronRight, Pencil, Check, X, RotateCw, TrendingUp, User, Shield, Swords, Sparkles, AlertCircle, Timer, Gift, Image } from 'lucide-react';
import { ImageImportModal, type ImageImportResult, type ShapeConfig } from '@/components/modals/ImageImportModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';

const CATEGORY_META: Record<EffectCategory, { label: string; icon: React.ElementType }> = {
  spell: { label: 'Spells', icon: Wand2 },
  trap: { label: 'Traps', icon: Skull },
  hazard: { label: 'Hazards', icon: Cloud },
  trait: { label: 'Traits', icon: User },
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
  durationType: EffectDurationType;
  templateMode: EffectTemplateMode;
  durationRounds: number;
  recurring: boolean;
  alignToGrid: boolean;
  targetCaster: boolean;
  ranged: boolean;
  skipRotation: boolean;
  renderAboveTokens: boolean;
  color: string;
  texture: string;
  textureScale: number;
  textureOffsetX: number;
  textureOffsetY: number;
  textureRepeat: boolean;
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
  // Attack roll
  attackRoll: EffectAttackRoll;
  // Modifiers
  modifiers: EffectModifier[];
  // Conditions
  conditions: EffectCondition[];
  // Granted actions
  grantedActions: EffectGrantedAction[];
  // Aura
  isAura: boolean;
  auraAffectSelf: boolean;
  auraWallBlocked: boolean;
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
  durationType: 'instantaneous',
  templateMode: 'persistent',
  durationRounds: 0,
  recurring: true,
  alignToGrid: false,
  targetCaster: false,
  ranged: false,
  skipRotation: false,
  renderAboveTokens: false,
  color: '#FF4500',
  texture: '',
  textureScale: 1,
  textureOffsetX: 0,
  textureOffsetY: 0,
  textureRepeat: false,
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
  attackRoll: { enabled: false, abilitySource: 'spellcasting' },
  modifiers: [],
  conditions: [],
  grantedActions: [],
  isAura: false,
  auraAffectSelf: false,
  auraWallBlocked: true,
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
    durationType: t.durationType ?? (t.persistence === 'instant' ? 'instantaneous' : (t.durationRounds && t.durationRounds > 0 ? 'timed' : 'infinite')),
    templateMode: t.templateMode ?? 'persistent',
    durationRounds: t.durationRounds ?? 0,
    recurring: t.recurring !== false,
    alignToGrid: t.alignToGrid ?? false,
    targetCaster: t.targetCaster ?? false,
    ranged: t.ranged ?? false,
    skipRotation: t.skipRotation ?? false,
    renderAboveTokens: t.renderAboveTokens ?? false,
    color: t.color,
    texture: t.texture ?? '',
    textureScale: t.textureScale ?? 1,
    textureOffsetX: t.textureOffsetX ?? 0,
    textureOffsetY: t.textureOffsetY ?? 0,
    textureRepeat: t.textureRepeat ?? false,
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
    attackRoll: t.attackRoll ?? { enabled: false, abilitySource: 'spellcasting' },
    modifiers: t.modifiers ?? [],
    conditions: t.conditions ?? [],
    grantedActions: t.grantedActions ?? [],
    isAura: !!t.aura,
    auraAffectSelf: t.aura?.affectSelf ?? false,
    auraWallBlocked: t.aura?.wallBlocked !== false,
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

// --- Level Overrides Editor ---

function LevelOverridesEditor({
  overrides,
  onChange,
  baseLevel,
}: {
  overrides: LevelOverride[];
  onChange: (overrides: LevelOverride[]) => void;
  baseLevel: number;
}) {
  const addOverride = () => {
    // Find the next unused level
    const usedLevels = new Set(overrides.map(o => o.level));
    let nextLevel = baseLevel + 1;
    while (usedLevels.has(nextLevel) && nextLevel <= 9) nextLevel++;
    if (nextLevel > 9) return;
    onChange([...overrides, { level: nextLevel }]);
  };
  const removeOverride = (i: number) => onChange(overrides.filter((_, idx) => idx !== i));
  const updateOverride = (i: number, updates: Partial<LevelOverride>) =>
    onChange(overrides.map((o, idx) => idx === i ? { ...o, ...updates } : o));

  const updateOverrideDice = (i: number, diceIdx: number, field: keyof DamageDiceEntry, value: string) => {
    const current = overrides[i].damageDice ?? [];
    const updated = current.map((d, di) => di === diceIdx ? { ...d, [field]: value } : d);
    updateOverride(i, { damageDice: updated });
  };
  const addOverrideDice = (i: number) => {
    const current = overrides[i].damageDice ?? [];
    updateOverride(i, { damageDice: [...current, { formula: '', damageType: '' }] });
  };
  const removeOverrideDice = (i: number, diceIdx: number) => {
    const current = overrides[i].damageDice ?? [];
    const updated = current.filter((_, di) => di !== diceIdx);
    updateOverride(i, { damageDice: updated.length > 0 ? updated : undefined });
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-muted-foreground font-medium">Level Overrides (explicit per-level config)</label>
      {overrides.map((ov, i) => (
        <div key={i} className="border border-border rounded p-1.5 space-y-1">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">L{ov.level}</Badge>
            <div className="w-12">
              <NumericInput
                value={ov.level}
                onChange={(v) => updateOverride(i, { level: Math.max(baseLevel + 1, v) })}
                className="h-5 text-[10px]"
                min={baseLevel + 1}
                max={9}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto flex-shrink-0" onClick={() => removeOverride(i)}>
              <X className="w-3 h-3 text-destructive" />
            </Button>
          </div>
          {/* Override damage dice */}
          <div className="space-y-0.5">
            <span className="text-[9px] text-muted-foreground">Damage Dice (leave empty to use scaling)</span>
            {(ov.damageDice ?? []).map((d, di) => (
              <div key={di} className="flex gap-1 items-center">
                <Input
                  value={d.formula}
                  onChange={(e) => updateOverrideDice(i, di, 'formula', e.target.value)}
                  placeholder="e.g. 12d6"
                  className="h-5 text-[10px] font-mono flex-1"
                />
                <Input
                  value={d.damageType}
                  onChange={(e) => updateOverrideDice(i, di, 'damageType', e.target.value)}
                  placeholder="fire"
                  className="h-5 text-[10px] flex-1"
                />
                <Button variant="ghost" size="icon" className="h-4 w-4 flex-shrink-0" onClick={() => removeOverrideDice(i, di)}>
                  <X className="w-2.5 h-2.5 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-5 text-[9px] w-full" onClick={() => addOverrideDice(i)}>
              <Plus className="w-2.5 h-2.5 mr-0.5" /> Dice
            </Button>
          </div>
          {/* Override dimensions */}
          <div className="flex gap-1">
            <div className="flex-1">
              <label className="text-[9px] text-muted-foreground">Radius</label>
              <NumericInput
                value={ov.radius ?? 0}
                onChange={(v) => updateOverride(i, { radius: v > 0 ? v : undefined })}
                className="h-5 text-[10px]"
                min={0}
                fallback={0}
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-muted-foreground">Width</label>
              <NumericInput
                value={ov.width ?? 0}
                onChange={(v) => updateOverride(i, { width: v > 0 ? v : undefined })}
                className="h-5 text-[10px]"
                min={0}
                fallback={0}
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-muted-foreground">Length</label>
              <NumericInput
                value={ov.length ?? 0}
                onChange={(v) => updateOverride(i, { length: v > 0 ? v : undefined })}
                className="h-5 text-[10px]"
                min={0}
                fallback={0}
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-muted-foreground">Qty</label>
              <NumericInput
                value={ov.multiDropCount ?? 0}
                onChange={(v) => updateOverride(i, { multiDropCount: v > 0 ? v : undefined })}
                className="h-5 text-[10px]"
                min={0}
                fallback={0}
              />
            </div>
          </div>
          <span className="text-[8px] text-muted-foreground italic">0 = use computed/default value</span>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full" onClick={addOverride} disabled={overrides.length >= (9 - baseLevel)}>
        <Plus className="w-3 h-3 mr-1" /> Add Level Override
      </Button>
    </div>
  );
}

// --- Shared Form Fields Component ---

// --- Tab types ---
type FormTab = 'shape' | 'damage' | 'level' | 'modifiers' | 'conditions' | 'grants' | 'duration';

const FORM_TABS: { value: FormTab; label: string; icon: React.ElementType }[] = [
  { value: 'shape', label: 'Shape', icon: Wand2 },
  { value: 'damage', label: 'Dmg', icon: Swords },
  { value: 'level', label: 'Level', icon: TrendingUp },
  { value: 'modifiers', label: 'Mods', icon: Shield },
  { value: 'conditions', label: 'Conds', icon: AlertCircle },
  { value: 'grants', label: 'Grants', icon: Gift },
  { value: 'duration', label: 'Dur', icon: Timer },
];

// --- Modifiers Editor ---

function ModifiersEditor({
  modifiers,
  onChange,
}: {
  modifiers: EffectModifier[];
  onChange: (mods: EffectModifier[]) => void;
}) {
  const addMod = () => onChange([...modifiers, {
    id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    target: 'armorClass',
    operation: 'add',
    value: 0,
  }]);
  const removeMod = (i: number) => onChange(modifiers.filter((_, idx) => idx !== i));
  const updateMod = (i: number, updates: Partial<EffectModifier>) =>
    onChange(modifiers.map((m, idx) => idx === i ? { ...m, ...updates } : m));

  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground font-medium">Stat Modifiers</label>
      {modifiers.map((mod, i) => (
        <div key={mod.id} className="space-y-0.5">
          <div className="flex gap-1 items-center">
            <Select value={mod.target} onValueChange={(v) => updateMod(i, { target: v })}>
              <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EFFECT_MODIFIER_TARGETS.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mod.operation} onValueChange={(v) => updateMod(i, { operation: v as EffectModifierOperation })}>
              <SelectTrigger className="h-6 text-[10px] w-14"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">+</SelectItem>
                <SelectItem value="set">=</SelectItem>
                <SelectItem value="multiply">×</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-14">
              <NumericInput
                value={mod.value}
                onChange={(v) => updateMod(i, { value: v })}
                className="h-6 text-[10px]"
                float={mod.operation === 'multiply'}
                step={mod.operation === 'multiply' ? 0.5 : 1}
              />
            </div>
            <Select value={mod.timing ?? 'on-enter'} onValueChange={(v) => updateMod(i, { timing: v as EffectTriggerTiming })}>
              <SelectTrigger className="h-6 text-[10px] w-[72px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on-enter">Enter</SelectItem>
                <SelectItem value="on-exit">Exit</SelectItem>
                <SelectItem value="on-stay">Stay</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => removeMod(i)}>
              <X className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full" onClick={addMod}>
        <Plus className="w-3 h-3 mr-1" /> Add Modifier
      </Button>
    </div>
  );
}

// --- Conditions Editor ---

function ConditionsEditor({
  conditions,
  onChange,
}: {
  conditions: EffectCondition[];
  onChange: (conds: EffectCondition[]) => void;
}) {
  const toggleCondition = (condition: string) => {
    const existing = conditions.find(c => c.condition === condition);
    if (existing) {
      onChange(conditions.filter(c => c.condition !== condition));
    } else {
      onChange([...conditions, { condition, apply: true, timing: 'on-enter' }]);
    }
  };

  const toggleApply = (condition: string) => {
    onChange(conditions.map(c => c.condition === condition ? { ...c, apply: !c.apply } : c));
  };

  const cycleTiming = (condition: string) => {
    const timings: EffectTriggerTiming[] = ['on-enter', 'on-exit', 'on-stay'];
    onChange(conditions.map(c => {
      if (c.condition !== condition) return c;
      const current = c.timing ?? 'on-enter';
      const next = timings[(timings.indexOf(current) + 1) % timings.length];
      return { ...c, timing: next };
    }));
  };

  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground font-medium">Conditions</label>
      <div className="grid grid-cols-2 gap-1">
        {DND_5E_CONDITIONS.map(cond => {
          const active = conditions.find(c => c.condition === cond);
          return (
            <div key={cond} className="flex items-center gap-1">
              <Checkbox
                checked={!!active}
                onCheckedChange={() => toggleCondition(cond)}
                className="h-3.5 w-3.5"
              />
              <span className={`text-[10px] capitalize ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {cond}
              </span>
              {active && (
                <>
                  <button
                    className={`text-[8px] px-1 rounded ${active.apply ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}
                    onClick={() => toggleApply(cond)}
                  >
                    {active.apply ? 'Apply' : 'Remove'}
                  </button>
                  <button
                    className="text-[8px] px-1 rounded bg-muted text-muted-foreground hover:text-foreground"
                    onClick={() => cycleTiming(cond)}
                  >
                    {(active.timing ?? 'on-enter').replace('on-', '')}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Granted Actions Editor ---

function GrantedActionsEditor({
  actions,
  onChange,
}: {
  actions: EffectGrantedAction[];
  onChange: (actions: EffectGrantedAction[]) => void;
}) {
  const addAction = () => onChange([...actions, { name: '', type: 'attack', description: '' }]);
  const removeAction = (i: number) => onChange(actions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, updates: Partial<EffectGrantedAction>) =>
    onChange(actions.map((a, idx) => idx === i ? { ...a, ...updates } : a));

  return (
    <div className="space-y-1">
      <label className="text-[10px] text-muted-foreground font-medium">Granted Actions</label>
      {actions.map((action, i) => (
        <div key={i} className="border border-border rounded p-1.5 space-y-1">
          <div className="flex gap-1 items-center">
            <Select value={action.type ?? 'attack'} onValueChange={(v) => updateAction(i, { type: v as EffectGrantedAction['type'] })}>
              <SelectTrigger className="h-5 text-[10px] w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="attack">Attack</SelectItem>
                <SelectItem value="spell">Spell</SelectItem>
                <SelectItem value="trait">Trait</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={action.name}
              onChange={(e) => updateAction(i, { name: e.target.value })}
              placeholder="Action name"
              className="h-5 text-[10px] flex-1"
            />
            <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => removeAction(i)}>
              <X className="w-3 h-3 text-destructive" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Input
              value={action.damageFormula ?? ''}
              onChange={(e) => updateAction(i, { damageFormula: e.target.value || undefined })}
              placeholder="Damage"
              className="h-5 text-[10px] font-mono flex-1"
            />
            <Input
              value={action.damageType ?? ''}
              onChange={(e) => updateAction(i, { damageType: e.target.value || undefined })}
              placeholder="Type"
              className="h-5 text-[10px] flex-1"
            />
          </div>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full" onClick={addAction}>
        <Plus className="w-3 h-3 mr-1" /> Add Granted Action
      </Button>
    </div>
  );
}

// --- Shared Form Fields Component (tabbed) ---

function TemplateFormFields({
  form,
  update,
}: {
  form: TemplateFormData;
  update: <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => void;
}) {
  const [activeTab, setActiveTab] = useState<FormTab>('shape');
  const [textureModalOpen, setTextureModalOpen] = useState(false);

  const needsRadius = form.shape === 'circle' || form.shape === 'circle-burst';
  const needsLength = form.shape === 'line' || form.shape === 'cone';
  const needsWidth = form.shape === 'line' || form.shape === 'rectangle' || form.shape === 'rectangle-burst';
  const needsAngle = form.shape === 'cone';
  const needsPolyline = form.shape === 'polyline';

  // Count items on each tab for badges
  const modCount = form.modifiers.length;
  const condCount = form.conditions.length;
  const dmgCount = form.damageDice.length + (form.attackRoll.enabled ? 1 : 0);
  const levelCount = form.scaling.length + form.levelOverrides.length;
  const grantsCount = form.grantedActions.length;

  return (
    <>
      {/* Name — always visible */}
      <Input
        value={form.name}
        onChange={(e) => update('name', e.target.value)}
        placeholder="Template name"
        className="h-7 text-xs"
      />

      {/* Category — outside tabs */}
      <Select value={form.category} onValueChange={(v) => update('category', v as EffectCategory)}>
        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="spell">Spell</SelectItem>
          <SelectItem value="trap">Trap</SelectItem>
          <SelectItem value="hazard">Hazard</SelectItem>
          <SelectItem value="trait">Trait</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {/* Tab bar */}
      <div className="flex border-b border-border -mx-2 px-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {FORM_TABS.map(tab => {
          const isActive = activeTab === tab.value;
          const Icon = tab.icon;
          const count =
            tab.value === 'modifiers' ? modCount :
            tab.value === 'conditions' ? condCount :
            tab.value === 'damage' ? dmgCount :
            tab.value === 'level' ? levelCount :
            tab.value === 'grants' ? grantsCount :
            0;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-0.5 px-1.5 py-1.5 text-[10px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
              {count > 0 && (
                <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3 ml-0.5">{count}</Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* --- Shape Tab --- */}
      {activeTab === 'shape' && (
        <>
          <Select value={form.shape} onValueChange={(v) => update('shape', v as EffectShape)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
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

          <div className="flex gap-2 items-end">
            <div>
              <label className="text-[10px] text-muted-foreground">Color</label>
              <input type="color" value={form.color} onChange={(e) => update('color', e.target.value)} className="w-7 h-7 rounded border border-border cursor-pointer" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground">Texture</label>
              <div className="flex gap-1 items-center">
                {form.texture ? (
                  <>
                    <div className="h-7 w-7 rounded border border-border overflow-hidden flex-shrink-0">
                      <img src={form.texture} alt="texture" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate flex-1">Texture set</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => { update('texture', ''); update('textureScale', 1); update('textureOffsetX', 0); update('textureOffsetY', 0); update('textureRepeat', false); }}>
                      <X className="w-3 h-3 text-destructive" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => setTextureModalOpen(true)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={() => setTextureModalOpen(true)}>
                    <Image className="w-3 h-3 mr-1" /> Import Image
                  </Button>
                )}
              </div>
              <ImageImportModal
                open={textureModalOpen}
                onOpenChange={setTextureModalOpen}
                title="Select Effect Texture"
                description="Position the image as a texture for the effect shape."
                shape={{
                  type: (form.shape === 'circle' || form.shape === 'circle-burst') ? 'circle' : 'rectangle',
                  width: (form.radius ?? 4) * 2 * 40,
                  height: (form.shape === 'rectangle' || form.shape === 'rectangle-burst')
                    ? (form.width ?? 1) * 40
                    : (form.radius ?? 4) * 2 * 40,
                }}
                initialImageUrl={form.texture}
                initialScale={form.textureScale}
                initialOffsetX={form.textureOffsetX}
                initialOffsetY={form.textureOffsetY}
                onConfirm={(result: ImageImportResult) => {
                  update('texture', result.imageUrl);
                  update('textureScale', result.scale);
                  update('textureOffsetX', result.offsetX);
                  update('textureOffsetY', result.offsetY);
                  setTextureModalOpen(false);
                }}
              />
            </div>
          </div>

          <div className="flex gap-2 items-end">
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

          {/* Quantity (multi-drop) */}
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
          </div>

          <div className="space-y-1">
            {[
              { key: 'alignToGrid' as const, label: 'Align to grid (45° snap)' },
              { key: 'targetCaster' as const, label: 'Include caster in targets' },
              { key: 'ranged' as const, label: 'Ranged (place at distance)' },
              { key: 'skipRotation' as const, label: 'Skip rotation step' },
              { key: 'renderAboveTokens' as const, label: 'Render above tokens' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1">
                <Switch checked={form[key]} onCheckedChange={(v) => update(key, v)} className="scale-75" />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>

          <Separator className="my-1" />

          {/* Aura Configuration */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Switch checked={form.isAura} onCheckedChange={(v) => update('isAura', v)} className="scale-75" />
              <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">Aura (locks to token)</span>
            </div>
            {form.isAura && (
              <div className="pl-4 space-y-1">
                <div className="flex items-center gap-1">
                  <Switch checked={form.auraAffectSelf} onCheckedChange={(v) => update('auraAffectSelf', v)} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Affect self</span>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={form.auraWallBlocked} onCheckedChange={(v) => update('auraWallBlocked', v)} className="scale-75" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">Blocked by walls</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- Damage Tab --- */}
      {activeTab === 'damage' && (
        <>
          <DamageDiceRows
            rows={form.damageDice}
            onChange={(rows) => update('damageDice', rows)}
          />

          {/* Attack Roll */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Switch
                checked={form.attackRoll.enabled}
                onCheckedChange={(v) => update('attackRoll', { ...form.attackRoll, enabled: v })}
                className="scale-75"
              />
              <span className="text-[10px] text-muted-foreground font-medium">Requires Attack Roll</span>
            </div>
            {form.attackRoll.enabled && (
              <div className="flex gap-1 items-center pl-4">
                <Select
                  value={form.attackRoll.abilitySource}
                  onValueChange={(v) => update('attackRoll', { ...form.attackRoll, abilitySource: v })}
                >
                  <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spellcasting">Spellcasting</SelectItem>
                    <SelectItem value="str">Strength</SelectItem>
                    <SelectItem value="dex">Dexterity</SelectItem>
                    <SelectItem value="con">Constitution</SelectItem>
                    <SelectItem value="int">Intelligence</SelectItem>
                    <SelectItem value="wis">Wisdom</SelectItem>
                    <SelectItem value="cha">Charisma</SelectItem>
                  </SelectContent>
                </Select>
                <div className="w-14">
                  <NumericInput
                    value={form.attackRoll.fixedBonus ?? 0}
                    onChange={(v) => update('attackRoll', { ...form.attackRoll, fixedBonus: v })}
                    className="h-6 text-[10px]"
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">bonus</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- Level Tab --- */}
      {activeTab === 'level' && (
        <>
          <div className="flex gap-2 items-end">
            <div className="w-20">
              <label className="text-[10px] text-muted-foreground">Spell Level</label>
              <NumericInput
                value={form.level ? Number(form.level) : 0}
                onChange={(v) => update('level', String(v))}
                className="h-7 text-xs"
                min={0}
                max={9}
              />
            </div>
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
            <>
              <ScalingRulesEditor
                rules={form.scaling}
                onChange={(rules) => update('scaling', rules)}
                damageDiceCount={form.damageDice.length}
              />
              <Separator className="my-1" />
              <LevelOverridesEditor
                overrides={form.levelOverrides}
                onChange={(overrides) => update('levelOverrides', overrides)}
                baseLevel={Number(form.baseLevel)}
              />
            </>
          )}
        </>
      )}

      {/* --- Modifiers Tab --- */}
      {activeTab === 'modifiers' && (
        <ModifiersEditor
          modifiers={form.modifiers}
          onChange={(mods) => update('modifiers', mods)}
        />
      )}

      {/* --- Conditions Tab --- */}
      {activeTab === 'conditions' && (
        <ConditionsEditor
          conditions={form.conditions}
          onChange={(conds) => update('conditions', conds)}
        />
      )}

      {/* --- Grants Tab --- */}
      {activeTab === 'grants' && (
        <GrantedActionsEditor
          actions={form.grantedActions}
          onChange={(acts) => update('grantedActions', acts)}
        />
      )}

      {/* --- Duration Tab --- */}
      {activeTab === 'duration' && (
        <>
          {/* Duration Type */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium">Duration Type</label>
            <Select
              value={form.durationType}
              onValueChange={(v) => {
                const dt = v as EffectDurationType;
                update('durationType', dt);
                // Sync legacy persistence field
                update('persistence', dt === 'instantaneous' ? 'instant' : 'persistent');
                if (dt === 'instantaneous') update('durationRounds', 0);
                if (dt === 'infinite') update('durationRounds', 0);
              }}
            >
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instantaneous">Instantaneous</SelectItem>
                <SelectItem value="timed">Timed (N rounds)</SelectItem>
                <SelectItem value="infinite">Infinite (until dismissed/cancelled)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration rounds — only for timed */}
          {form.durationType === 'timed' && (
            <div>
              <label className="text-[10px] text-muted-foreground">Duration (rounds)</label>
              <NumericInput
                value={form.durationRounds}
                onChange={(v) => update('durationRounds', Math.max(1, v))}
                className="h-7 text-xs"
                min={1}
                max={999}
              />
            </div>
          )}

          {/* Template mode — for timed/infinite */}
          {form.durationType !== 'instantaneous' && (
            <>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium">Template Mode</label>
                <Select value={form.templateMode} onValueChange={(v) => update('templateMode', v as EffectTemplateMode)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="persistent">Persistent (shape stays on map)</SelectItem>
                    <SelectItem value="targeting-only">Targeting-only (removed after targeting)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recurring toggle */}
              <div className="flex items-center gap-1">
                <Switch checked={form.recurring} onCheckedChange={(v) => update('recurring', v)} className="scale-75" />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {form.recurring ? 'Recurring (re-triggers each round)' : 'One-shot (triggers once)'}
                </span>
              </div>
            </>
          )}

          {/* Timing summary */}
          <div className="text-[9px] text-muted-foreground border border-border rounded p-1.5 space-y-0.5">
            <span className="font-medium">Trigger Timing:</span>
            <p>Set per modifier/condition in their respective tabs.</p>
            <p><strong>Enter</strong> — when a token enters the area</p>
            <p><strong>Exit</strong> — when a token leaves the area</p>
            <p><strong>Stay</strong> — each round a token starts its turn inside</p>
          </div>
        </>
      )}
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
    durationType: form.durationType,
    templateMode: form.durationType !== 'instantaneous' ? form.templateMode : undefined,
    durationRounds: form.durationType === 'timed' ? form.durationRounds : (form.durationType === 'instantaneous' ? undefined : 0),
    recurring: form.durationType !== 'instantaneous' ? form.recurring : undefined,
    alignToGrid: form.alignToGrid || undefined,
    targetCaster: form.targetCaster || undefined,
    ranged: form.ranged || undefined,
    skipRotation: form.skipRotation || undefined,
    renderAboveTokens: form.renderAboveTokens || undefined,
    color: form.color,
    texture: form.texture || undefined,
    textureScale: form.texture ? (form.textureScale !== 1 ? form.textureScale : undefined) : undefined,
    textureOffsetX: form.texture ? (form.textureOffsetX !== 0 ? form.textureOffsetX : undefined) : undefined,
    textureOffsetY: form.texture ? (form.textureOffsetY !== 0 ? form.textureOffsetY : undefined) : undefined,
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
    attackRoll: form.attackRoll.enabled ? form.attackRoll : undefined,
    modifiers: form.modifiers.length > 0 ? form.modifiers : undefined,
    conditions: form.conditions.length > 0 ? form.conditions : undefined,
    grantedActions: form.grantedActions.length > 0 ? form.grantedActions : undefined,
    aura: form.isAura ? {
      affectSelf: form.auraAffectSelf || undefined,
      wallBlocked: form.auraWallBlocked === false ? false : undefined,
    } : undefined,
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

  const selectedTokenIds = useSessionStore((s) => s.selectedTokenIds);
  const tokens = useSessionStore((s) => s.tokens);
  const { getCharacterById } = useCreatureStore();

  const [damageFormula, setDamageFormula] = useState('');
  const [castLevelInput, setCastLevelInput] = useState<number | null>(null);
  const [useTokenLevel, setUseTokenLevel] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const getTemplate = useEffectStore((s) => s.getTemplate);

  // Derive selected token's level from linked character data
  const selectedTokenLevel = useMemo(() => {
    if (selectedTokenIds.length !== 1) return null;
    const token = tokens.find(t => t.id === selectedTokenIds[0]);
    if (!token?.entityRef?.entityId) return null;
    const character = getCharacterById(token.entityRef.entityId);
    return character?.level ?? null;
  }, [selectedTokenIds, tokens, getCharacterById]);

  const canUseTokenLevel = selectedTokenIds.length === 1 && selectedTokenLevel !== null;

  // When toggle is on and we have a valid token level, override the cast level input
  const effectiveCastLevel = (useTokenLevel && canUseTokenLevel && selectedTokenLevel)
    ? selectedTokenLevel
    : castLevelInput;

  // Turn off toggle if token deselected or loses level
  React.useEffect(() => {
    if (useTokenLevel && !canUseTokenLevel) {
      setUseTokenLevel(false);
    }
  }, [useTokenLevel, canUseTokenLevel]);

  const groups = groupByCategory(allTemplates);
  const categoryOrder: EffectCategory[] = ['spell', 'trap', 'hazard', 'trait', 'custom'];

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
    const level = tmpl?.baseLevel && effectiveCastLevel ? effectiveCastLevel : undefined;
    startPlacement(templateId, undefined, damageFormula || undefined, undefined, level);
  };

  const handleEdit = (templateId: string) => {
    setEditingTemplateId(templateId);
    setShowCreateForm(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header: always visible controls */}
      <div className="p-2 space-y-3 flex-shrink-0">
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

        {/* Cast at Level selector */}
        <div className="flex gap-2 items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={useTokenLevel}
                    onCheckedChange={setUseTokenLevel}
                    disabled={!canUseTokenLevel}
                    className="scale-75"
                  />
                  <User className={`w-3.5 h-3.5 ${canUseTokenLevel ? 'text-foreground' : 'text-muted-foreground/40'}`} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {canUseTokenLevel
                  ? `Use selected token's level (L${selectedTokenLevel})`
                  : 'Select a token with a linked character to use its level'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="w-20">
            <label className="text-[10px] text-muted-foreground">Cast at Level</label>
            <NumericInput
              value={(useTokenLevel && canUseTokenLevel ? selectedTokenLevel : castLevelInput) ?? 0}
              onChange={(v) => {
                if (!useTokenLevel) setCastLevelInput(v > 0 ? v : null);
              }}
              className="h-7 text-xs"
              min={0}
              max={9}
              disabled={useTokenLevel && canUseTokenLevel}
            />
          </div>
          <span className="text-[10px] text-muted-foreground pb-1.5 self-end">
            {useTokenLevel && canUseTokenLevel
              ? `Token L${selectedTokenLevel}`
              : effectiveCastLevel ? `Upcast to L${effectiveCastLevel}` : 'Base level (no scaling)'}
          </span>
        </div>

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

        <Separator />
      </div>

      {/* Scrollable content: placement status, template library, active effects */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 pb-2 space-y-3">
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
    </div>
  );
}
