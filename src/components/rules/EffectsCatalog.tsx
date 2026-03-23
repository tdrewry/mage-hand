import React, { useState, useMemo } from 'react';
import { CardSaveEvent } from '@/components/cards/CardSaveButton';
import { useEffectStore } from '@/stores/effectStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useCreatureStore } from '@/stores/creatureStore';
import type { EffectTemplate, EffectCategory, EffectShape, EffectAnimationType, EffectPersistence, EffectDurationType, EffectTemplateMode, EffectTriggerTiming, EffectRotateDirection, AuraConfig } from '@/types/effectTypes';
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
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
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
  rotate: RotateCw,
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
  rotateDirection: EffectRotateDirection;
  category: EffectCategory;
  multiDropCount: number;
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
  rotateDirection: 'cw',
  category: 'custom',
  multiDropCount: 1,
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
    rotateDirection: t.rotateDirection ?? 'cw',
    category: t.category,
    multiDropCount: t.multiDrop?.count ?? 1,
    isAura: !!t.aura,
    auraAffectSelf: t.aura?.affectSelf ?? false,
    auraWallBlocked: t.aura?.wallBlocked !== false,
  };
}

// --- Shared Form Fields Component (tabbed) ---

type FormTab = 'shape' | 'duration';

const FORM_TABS: { value: FormTab; label: string; icon: React.ElementType }[] = [
  { value: 'shape', label: 'Shape', icon: Wand2 },
  { value: 'duration', label: 'Dur', icon: Timer },
];

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

          <div className="flex flex-wrap gap-2">
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
                initialRepeat={form.textureRepeat}
                showRepeatToggle
                onConfirm={(result: ImageImportResult) => {
                  update('texture', result.imageUrl);
                  update('textureScale', result.scale);
                  update('textureOffsetX', result.offsetX);
                  update('textureOffsetY', result.offsetY);
                  update('textureRepeat', result.repeat ?? false);
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
                  <SelectItem value="rotate">Rotate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Animation speed + rotate direction (shown when animation !== 'none') */}
          {form.animation !== 'none' && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Speed ({form.animationSpeed.toFixed(1)}x)</label>
                <Slider
                  value={[form.animationSpeed]}
                  onValueChange={([v]) => update('animationSpeed', v)}
                  min={0.1}
                  max={3}
                  step={0.1}
                  className="mt-1"
                />
              </div>
              {form.animation === 'rotate' && (
                <div className="w-24">
                  <label className="text-[10px] text-muted-foreground">Direction</label>
                  <Select value={form.rotateDirection} onValueChange={(v) => update('rotateDirection', v as EffectRotateDirection)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cw">Clockwise</SelectItem>
                      <SelectItem value="ccw">Counter-CW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

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
    textureRepeat: form.texture ? (form.textureRepeat || undefined) : undefined,
    opacity: form.opacity,
    animation: form.animation,
    animationSpeed: form.animationSpeed,
    rotateDirection: form.animation === 'rotate' && form.rotateDirection !== 'cw' ? form.rotateDirection : undefined,
    category: form.category,
    multiDrop: form.multiDropCount > 1 ? { count: form.multiDropCount } : undefined,
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
    window.dispatchEvent(new CardSaveEvent({ context: { type: 'effect', id: template.id } }));
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



      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onEdit(template.id); }}
      >
        <Pencil className="w-3 h-3 text-muted-foreground" />
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
            title="Delete Effect"
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Effect Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the effect template "{template.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(template.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Main Card Content ---

export function EffectsCatalog() {
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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const getTemplate = useEffectStore((s) => s.getTemplate);

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
    startPlacement(templateId);
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


      </div>

      {/* Scrollable content: placement status, template library, active effects */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 pb-2 space-y-3">
          {/* Placement status */}
          {placement && (
            <div className="bg-primary/10 border border-primary/30 rounded p-2 text-xs">
              <span className="font-medium">Placing:</span> {placement.template.name}
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={(evt) => evt.stopPropagation()}
                          title="Remove Placed Effect"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(evt) => evt.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Active Effect</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove this active effect from the table?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={(evt) => {
                              evt.stopPropagation();
                              removeEffect(e.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
