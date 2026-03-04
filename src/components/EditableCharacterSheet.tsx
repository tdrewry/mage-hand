import React, { useState, useCallback, useMemo } from 'react';
import type { DndBeyondCharacter } from '@/types/creatureTypes';
import { formatModifier, getAbilityModifier } from '@/types/creatureTypes';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, ChevronDown, ChevronRight, Swords, BookOpen, Sparkles, Shield, Star, Dices, Link2 } from 'lucide-react';
import { useEffectStore } from '@/stores/effectStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditableCharacterSheetProps {
  character: DndBeyondCharacter;
  onChange: (updated: DndBeyondCharacter) => void;
}

type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
const ABILITY_KEYS: AbilityKey[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const ABILITY_LABELS: Record<AbilityKey, string> = {
  strength: 'STR', dexterity: 'DEX', constitution: 'CON',
  intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function EditableCharacterSheet({ character, onChange }: EditableCharacterSheetProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['core', 'abilities', 'actions']));
  const allTemplates = useEffectStore(s => s.allTemplates);

  const toggle = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const update = useCallback((patch: Partial<DndBeyondCharacter>) => {
    onChange({ ...character, ...patch });
  }, [character, onChange]);

  const updateAbility = useCallback((key: AbilityKey, score: number) => {
    const mod = getAbilityModifier(score);
    update({
      abilities: {
        ...character.abilities,
        [key]: { score, modifier: mod },
      },
    });
  }, [character, update]);

  return (
    <div className="p-3 space-y-1 text-sm">
      {/* ── Core Stats ── */}
      <CollapsibleSection
        title="Core Stats"
        icon={<Shield className="w-3.5 h-3.5" />}
        sectionKey="core"
        open={openSections.has('core')}
        onToggle={toggle}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name">
              <Input value={character.name} onChange={e => update({ name: e.target.value })} className="h-7 text-xs" />
            </Field>
            <Field label="Level">
              <NumericInput value={character.level} onChange={v => update({ level: v })} min={1} max={20} className="h-7 text-xs" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Race">
              <Input value={character.race} onChange={e => update({ race: e.target.value })} className="h-7 text-xs" />
            </Field>
            <Field label="Class">
              <Input
                value={character.classes.map(c => `${c.name} ${c.level}`).join(' / ')}
                onChange={e => {
                  // Simple parse: "Fighter 5 / Wizard 3"
                  const parts = e.target.value.split('/').map(s => s.trim());
                  const classes = parts.map(p => {
                    const match = p.match(/^(.+?)\s+(\d+)$/);
                    return match ? { name: match[1], level: parseInt(match[2]) } : { name: p, level: 1 };
                  });
                  update({ classes });
                }}
                className="h-7 text-xs"
              />
            </Field>
            <Field label="Background">
              <Input value={character.background ?? ''} onChange={e => update({ background: e.target.value })} className="h-7 text-xs" />
            </Field>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Field label="AC">
              <NumericInput value={character.armorClass} onChange={v => update({ armorClass: v })} className="h-7 text-xs" />
            </Field>
            <Field label="HP">
              <div className="flex gap-1">
                <NumericInput
                  value={character.hitPoints.current}
                  onChange={v => update({ hitPoints: { ...character.hitPoints, current: v } })}
                  className="h-7 text-xs"
                />
                <span className="text-muted-foreground self-center text-[10px]">/</span>
                <NumericInput
                  value={character.hitPoints.max}
                  onChange={v => update({ hitPoints: { ...character.hitPoints, max: v } })}
                  className="h-7 text-xs"
                />
              </div>
            </Field>
            <Field label="Speed">
              <NumericInput value={character.speed} onChange={v => update({ speed: v })} className="h-7 text-xs" />
            </Field>
            <Field label="Prof Bonus">
              <NumericInput value={character.proficiencyBonus} onChange={v => update({ proficiencyBonus: v })} className="h-7 text-xs" />
            </Field>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Ability Scores ── */}
      <CollapsibleSection
        title="Ability Scores"
        icon={<Dices className="w-3.5 h-3.5" />}
        sectionKey="abilities"
        open={openSections.has('abilities')}
        onToggle={toggle}
      >
        <div className="grid grid-cols-6 gap-1.5">
          {ABILITY_KEYS.map(key => (
            <div key={key} className="text-center space-y-0.5">
              <label className="text-[9px] font-bold text-muted-foreground uppercase">{ABILITY_LABELS[key]}</label>
              <NumericInput
                value={character.abilities[key].score}
                onChange={v => updateAbility(key, v)}
                className="h-7 text-xs text-center"
                min={1}
                max={30}
              />
              <div className="text-[10px] font-mono text-primary">
                {formatModifier(character.abilities[key].modifier)}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Saving Throws ── */}
      <CollapsibleSection
        title="Saving Throws"
        icon={<Shield className="w-3.5 h-3.5" />}
        sectionKey="saves"
        open={openSections.has('saves')}
        onToggle={toggle}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {character.savingThrows.map((save, i) => (
            <div key={save.ability} className="flex items-center gap-1.5">
              <Switch
                checked={save.proficient}
                onCheckedChange={checked => {
                  const saves = [...character.savingThrows];
                  saves[i] = { ...save, proficient: checked };
                  update({ savingThrows: saves });
                }}
                className="scale-[0.6]"
              />
              <span className="text-[10px] w-8 text-muted-foreground">{save.ability.slice(0, 3).toUpperCase()}</span>
              <NumericInput
                value={save.modifier}
                onChange={v => {
                  const saves = [...character.savingThrows];
                  saves[i] = { ...save, modifier: v };
                  update({ savingThrows: saves });
                }}
                className="h-6 text-[10px] w-12"
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Skills ── */}
      <CollapsibleSection
        title={`Skills (${character.skills.filter(s => s.proficient).length} prof)`}
        icon={<Star className="w-3.5 h-3.5" />}
        sectionKey="skills"
        open={openSections.has('skills')}
        onToggle={toggle}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {character.skills.map((skill, i) => (
            <div key={skill.name} className="flex items-center gap-1">
              <Switch
                checked={skill.proficient}
                onCheckedChange={checked => {
                  const skills = [...character.skills];
                  skills[i] = { ...skill, proficient: checked };
                  update({ skills });
                }}
                className="scale-[0.55]"
              />
              <span className={`text-[10px] flex-1 truncate ${skill.proficient ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {skill.name}
              </span>
              <span className="text-[10px] font-mono w-6 text-right text-primary">
                {formatModifier(skill.modifier)}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Actions / Attacks ── */}
      <CollapsibleSection
        title={`Actions (${character.actions.length})`}
        icon={<Swords className="w-3.5 h-3.5" />}
        sectionKey="actions"
        open={openSections.has('actions')}
        onToggle={toggle}
      >
        <div className="space-y-2">
          {character.actions.map((action, i) => (
            <div key={i} className="border border-border rounded p-2 space-y-1.5 bg-muted/20">
              <div className="flex items-center gap-1">
                <Input
                  value={action.name}
                  onChange={e => {
                    const actions = [...character.actions];
                    actions[i] = { ...action, name: e.target.value };
                    update({ actions });
                  }}
                  className="h-6 text-xs font-semibold flex-1"
                  placeholder="Attack name"
                />
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => {
                  update({ actions: character.actions.filter((_, j) => j !== i) });
                }}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <Field label="To Hit" compact>
                  <NumericInput
                    value={action.attackBonus ?? 0}
                    onChange={v => {
                      const actions = [...character.actions];
                      actions[i] = { ...action, attackBonus: v };
                      update({ actions });
                    }}
                    className="h-6 text-[10px]"
                  />
                </Field>
                <Field label="Damage" compact>
                  <Input
                    value={action.damage ?? ''}
                    onChange={e => {
                      const actions = [...character.actions];
                      actions[i] = { ...action, damage: e.target.value };
                      update({ actions });
                    }}
                    className="h-6 text-[10px] font-mono"
                    placeholder="1d8+3"
                  />
                </Field>
                <Field label="Type" compact>
                  <Input
                    value={action.damageType ?? ''}
                    onChange={e => {
                      const actions = [...character.actions];
                      actions[i] = { ...action, damageType: e.target.value };
                      update({ actions });
                    }}
                    className="h-6 text-[10px]"
                    placeholder="slashing"
                  />
                </Field>
                <Field label="Range" compact>
                  <Input
                    value={action.range ?? ''}
                    onChange={e => {
                      const actions = [...character.actions];
                      actions[i] = { ...action, range: e.target.value };
                      update({ actions });
                    }}
                    className="h-6 text-[10px]"
                    placeholder="5 ft."
                  />
                </Field>
              </div>
              <Field label="Description" compact>
                <Input
                  value={action.description}
                  onChange={e => {
                    const actions = [...character.actions];
                    actions[i] = { ...action, description: e.target.value };
                    update({ actions });
                  }}
                  className="h-6 text-[10px]"
                />
              </Field>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full h-6 text-[10px]" onClick={() => {
            update({ actions: [...character.actions, { name: '', attackBonus: 0, damage: '', damageType: '', range: '', description: '' }] });
          }}>
            <Plus className="w-3 h-3 mr-1" /> Add Action
          </Button>
        </div>
      </CollapsibleSection>

      {/* ── Features / Traits ── */}
      <CollapsibleSection
        title={`Features & Traits (${character.features.length})`}
        icon={<BookOpen className="w-3.5 h-3.5" />}
        sectionKey="features"
        open={openSections.has('features')}
        onToggle={toggle}
      >
        <div className="space-y-2">
          {character.features.map((feat, i) => (
            <div key={i} className="border border-border rounded p-2 space-y-1 bg-muted/20">
              <div className="flex items-center gap-1">
                <Input
                  value={feat.name}
                  onChange={e => {
                    const features = [...character.features];
                    features[i] = { ...feat, name: e.target.value };
                    update({ features });
                  }}
                  className="h-6 text-xs font-semibold flex-1"
                  placeholder="Feature name"
                />
                <Input
                  value={feat.source}
                  onChange={e => {
                    const features = [...character.features];
                    features[i] = { ...feat, source: e.target.value };
                    update({ features });
                  }}
                  className="h-6 text-[10px] w-24 text-muted-foreground"
                  placeholder="Source"
                />
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => {
                  update({ features: character.features.filter((_, j) => j !== i) });
                }}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={feat.description}
                onChange={e => {
                  const features = [...character.features];
                  features[i] = { ...feat, description: e.target.value };
                  update({ features });
                }}
                className="text-[10px] min-h-[40px] resize-none"
                placeholder="Description"
              />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full h-6 text-[10px]" onClick={() => {
            update({ features: [...character.features, { name: '', description: '', source: '' }] });
          }}>
            <Plus className="w-3 h-3 mr-1" /> Add Feature
          </Button>
        </div>
      </CollapsibleSection>

      {/* ── Spells ── */}
      {character.spells && (
        <CollapsibleSection
          title="Spellcasting"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          sectionKey="spells"
          open={openSections.has('spells')}
          onToggle={toggle}
        >
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Ability" compact>
                <Input
                  value={character.spells.spellcastingAbility ?? ''}
                  onChange={e => update({ spells: { ...character.spells!, spellcastingAbility: e.target.value } })}
                  className="h-6 text-[10px]"
                />
              </Field>
              <Field label="Save DC" compact>
                <NumericInput
                  value={character.spells.spellSaveDC ?? 0}
                  onChange={v => update({ spells: { ...character.spells!, spellSaveDC: v } })}
                  className="h-6 text-[10px]"
                />
              </Field>
              <Field label="Atk Bonus" compact>
                <NumericInput
                  value={character.spells.spellAttackBonus ?? 0}
                  onChange={v => update({ spells: { ...character.spells!, spellAttackBonus: v } })}
                  className="h-6 text-[10px]"
                />
              </Field>
            </div>

            {/* Cantrips */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cantrips</label>
              {character.spells.cantrips.map((cantrip, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <Input
                    value={cantrip.name}
                    onChange={e => {
                      const cantrips = [...character.spells!.cantrips];
                      cantrips[i] = { ...cantrips[i], name: e.target.value };
                      update({ spells: { ...character.spells!, cantrips } });
                    }}
                    className="h-6 text-[10px] flex-1"
                  />
                  <EffectTemplatePicker
                    value={cantrip.effectTemplateId}
                    templates={allTemplates}
                    onChange={templateId => {
                      const cantrips = [...character.spells!.cantrips];
                      cantrips[i] = { ...cantrips[i], effectTemplateId: templateId };
                      update({ spells: { ...character.spells!, cantrips } });
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => {
                    const cantrips = character.spells!.cantrips.filter((_, j) => j !== i);
                    update({ spells: { ...character.spells!, cantrips } });
                  }}>
                    <Trash2 className="w-2.5 h-2.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-5 text-[9px] w-full" onClick={() => {
                update({ spells: { ...character.spells!, cantrips: [...character.spells!.cantrips, { name: '' }] } });
              }}>
                <Plus className="w-2.5 h-2.5 mr-0.5" /> Cantrip
              </Button>
            </div>

            {/* Spell Levels */}
            {character.spells.spellsByLevel.map((lvl, li) => (
              <div key={li} className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Level {lvl.level}</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">Slots</span>
                    <NumericInput
                      value={lvl.slots}
                      onChange={v => {
                        const spellsByLevel = [...character.spells!.spellsByLevel];
                        spellsByLevel[li] = { ...lvl, slots: v };
                        update({ spells: { ...character.spells!, spellsByLevel } });
                      }}
                      className="h-5 text-[10px] w-10"
                      min={0}
                    />
                    <span className="text-[9px] text-muted-foreground">Used</span>
                    <NumericInput
                      value={lvl.slotsUsed}
                      onChange={v => {
                        const spellsByLevel = [...character.spells!.spellsByLevel];
                        spellsByLevel[li] = { ...lvl, slotsUsed: v };
                        update({ spells: { ...character.spells!, spellsByLevel } });
                      }}
                      className="h-5 text-[10px] w-10"
                      min={0}
                      max={lvl.slots}
                    />
                  </div>
                </div>
                {lvl.spells.map((spell, si) => (
                  <div key={si} className="flex gap-1 items-center pl-2">
                    <Switch
                      checked={spell.prepared}
                      onCheckedChange={checked => {
                        const spellsByLevel = [...character.spells!.spellsByLevel];
                        const spells = [...lvl.spells];
                        spells[si] = { ...spell, prepared: checked };
                        spellsByLevel[li] = { ...lvl, spells };
                        update({ spells: { ...character.spells!, spellsByLevel } });
                      }}
                      className="scale-[0.5]"
                    />
                    <Input
                      value={spell.name}
                      onChange={e => {
                        const spellsByLevel = [...character.spells!.spellsByLevel];
                        const spells = [...lvl.spells];
                        spells[si] = { ...spell, name: e.target.value };
                        spellsByLevel[li] = { ...lvl, spells };
                        update({ spells: { ...character.spells!, spellsByLevel } });
                      }}
                      className="h-5 text-[10px] flex-1"
                    />
                    <EffectTemplatePicker
                      value={spell.effectTemplateId}
                      templates={allTemplates}
                      onChange={templateId => {
                        const spellsByLevel = [...character.spells!.spellsByLevel];
                        const spells = [...lvl.spells];
                        spells[si] = { ...spell, effectTemplateId: templateId };
                        spellsByLevel[li] = { ...lvl, spells };
                        update({ spells: { ...character.spells!, spellsByLevel } });
                      }}
                    />
                    <Badge variant={spell.prepared ? 'default' : 'outline'} className="text-[8px] px-1 h-4 shrink-0">
                      {spell.prepared ? 'P' : '—'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => {
                      const spellsByLevel = [...character.spells!.spellsByLevel];
                      const spells = lvl.spells.filter((_, j) => j !== si);
                      spellsByLevel[li] = { ...lvl, spells };
                      update({ spells: { ...character.spells!, spellsByLevel } });
                    }}>
                      <Trash2 className="w-2.5 h-2.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="h-5 text-[9px] w-full" onClick={() => {
                  const spellsByLevel = [...character.spells!.spellsByLevel];
                  const spells = [...lvl.spells, { name: '', prepared: false }];
                  spellsByLevel[li] = { ...lvl, spells };
                  update({ spells: { ...character.spells!, spellsByLevel } });
                }}>
                  <Plus className="w-2.5 h-2.5 mr-0.5" /> Spell
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full h-6 text-[10px]" onClick={() => {
              const nextLevel = (character.spells!.spellsByLevel.length > 0
                ? Math.max(...character.spells!.spellsByLevel.map(l => l.level)) + 1
                : 1);
              update({
                spells: {
                  ...character.spells!,
                  spellsByLevel: [...character.spells!.spellsByLevel, { level: nextLevel, slots: 1, slotsUsed: 0, spells: [] }],
                },
              });
            }}>
              <Plus className="w-3 h-3 mr-1" /> Add Spell Level
            </Button>
          </div>
        </CollapsibleSection>
      )}

      {/* Add Spellcasting button if none exists */}
      {!character.spells && (
        <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => {
          update({
            spells: {
              spellcastingAbility: 'Intelligence',
              spellSaveDC: 8 + character.proficiencyBonus + character.abilities.intelligence.modifier,
              spellAttackBonus: character.proficiencyBonus + character.abilities.intelligence.modifier,
              cantrips: [],
              spellsByLevel: [],
            },
          });
        }}>
          <Sparkles className="w-3.5 h-3.5 mr-1" /> Add Spellcasting
        </Button>
      )}

      {/* ── Conditions ── */}
      <CollapsibleSection
        title={`Conditions (${character.conditions.length})`}
        icon={<Shield className="w-3.5 h-3.5" />}
        sectionKey="conditions"
        open={openSections.has('conditions')}
        onToggle={toggle}
      >
        <div className="flex flex-wrap gap-1">
          {character.conditions.map((cond, i) => (
            <Badge key={i} variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-1 cursor-pointer" onClick={() => {
              update({ conditions: character.conditions.filter((_, j) => j !== i) });
            }}>
              {cond} ×
            </Badge>
          ))}
          <Input
            placeholder="+ condition"
            className="h-5 text-[10px] w-24"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                update({ conditions: [...character.conditions, (e.target as HTMLInputElement).value.trim()] });
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function CollapsibleSection({ title, icon, sectionKey, open, onToggle, children }: {
  title: string;
  icon: React.ReactNode;
  sectionKey: string;
  open: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={() => onToggle(sectionKey)}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {icon}
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Field({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-0' : 'space-y-0.5'}>
      <label className="text-[9px] text-muted-foreground uppercase">{label}</label>
      {children}
    </div>
  );
}

// ─── Effect Template Picker (inline) ──────────────────────────────────────────

import type { EffectTemplate } from '@/types/effectTypes';

function EffectTemplatePicker({ value, templates, onChange }: {
  value?: string;
  templates: EffectTemplate[];
  onChange: (templateId: string | undefined) => void;
}) {
  const matched = value ? templates.find(t => t.id === value) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="shrink-0">
          <Select
            value={value || '__none__'}
            onValueChange={v => onChange(v === '__none__' ? undefined : v)}
          >
            <SelectTrigger className={`h-5 w-5 p-0 border-0 bg-transparent [&>svg]:hidden ${matched ? 'text-primary' : 'text-muted-foreground/40'}`}>
              <Link2 className="w-3 h-3" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              <SelectItem value="__none__" className="text-xs">No effect</SelectItem>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {matched ? `Linked: ${matched.name}` : 'Assign effect template'}
      </TooltipContent>
    </Tooltip>
  );
}
