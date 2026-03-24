import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Swords, Sparkles, Dices, BookOpen, Target, Send, Focus } from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import { useCreatureStore } from '@/stores/creatureStore';
import { useActionStore } from '@/stores/actionStore';
import { useMapTemplateStore } from '@/stores/mapTemplateStore';
import { collectAllActions, type TokenActionItem } from '@/lib/attackParser';
import type { IntentPayload } from '@/lib/rules-engine/types';
import { evaluateIntent } from '@/lib/rules-engine/evaluator';

interface ActionDeclareCardProps {
  draftId: string;
  actorId: string;
  category: string;
  onCancel?: (draftId: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  attack: <Swords className="w-5 h-5 text-red-400" />,
  spell: <Sparkles className="w-5 h-5 text-blue-400" />,
  skill: <Dices className="w-5 h-5 text-green-400" />,
  trait: <BookOpen className="w-5 h-5 text-amber-400" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  attack: 'Attacks',
  spell: 'Spells',
  skill: 'Skills',
  trait: 'Traits & Features',
};

export function ActionDeclareCardContent({ draftId, actorId, category, onCancel }: ActionDeclareCardProps) {
  const tokens = useSessionStore((s) => s.tokens);
  const selectedTokenIds = useSessionStore((s) => s.selectedTokenIds);
  const token = tokens.find((t) => t.id === actorId);
  
  // Local state for the action config
  const [selectedActionId, setSelectedActionId] = useState<string>('');
  const [castLevel, setCastLevel] = useState<string>('base');
  const [sneakAttack, setSneakAttack] = useState(false);
  const [smite, setSmite] = useState(false);
  const [waitingForPlacement, setWaitingForPlacement] = useState(false);

  const placedEffects = useMapTemplateStore(s => s.placedEffects);
  const allTemplates = useMapTemplateStore(s => s.allTemplates);
  const draftingIntents = useActionStore(s => s.draftingIntents);
  const currentDraft = draftingIntents.find(d => d.id === draftId);

  // Get available actions for the selected category
  const actions = useMemo(() => {
    if (!token) return [];
    
    // Default empty actions
    let allActions: TokenActionItem[] = [];
    
    // Stat block JSON first
    if (token.statBlockJson) {
      try {
        const json = JSON.parse(token.statBlockJson);
        allActions = collectAllActions(json);
      } catch { /* ignore */ }
    } else if (token.entityRef?.entityId) {
      // Linked creature
      const creatureStore = useCreatureStore.getState();
      const monster = creatureStore.getMonsterById(token.entityRef.entityId);
      if (monster) {
        allActions = collectAllActions(monster);
      } else {
        const character = creatureStore.getCharacterById(token.entityRef.entityId);
        if (character) allActions = collectAllActions(character);
      }
    }

    // Include basic slam if none found
    if (allActions.length === 0) {
      allActions = [{
        id: 'default-slam',
        name: 'Slam',
        category: 'attack',
        attackBonus: 0,
        damageFormula: '1d4',
        damageType: 'bludgeoning',
        range: '5 ft.',
        description: 'A basic melee attack.'
      }];
    }

    return allActions.filter((a) => a.category === category);
  }, [token, category]);

  // Find the detail for the currently selected action
  const currentAction = actions.find(a => a.id === selectedActionId) || actions[0];

  const matchedTemplate = useMemo(() => {
    if (!currentAction) return null;
    if (currentAction.mapTemplateId) {
      return allTemplates.find(t => t.id === currentAction.mapTemplateId) || null;
    }
    // Attempt name match
    return allTemplates.find(t => t.name.toLowerCase() === currentAction.name.toLowerCase()) || null;
  }, [currentAction, allTemplates]);

  const [useTemplate, setUseTemplate] = useState(false);

  // Auto-enable template if one matched
  React.useEffect(() => {
    setUseTemplate(!!matchedTemplate);
  }, [matchedTemplate]);

  // Auto-select first action if not set, but do it safely
  React.useEffect(() => {
    if (actions.length > 0 && !actions.find(a => a.id === selectedActionId)) {
      setSelectedActionId(actions[0].id);
    }
  }, [actions, selectedActionId]);

  const handlePlaceTemplate = () => {
    if (!matchedTemplate || !token) return;
    setWaitingForPlacement(true);
    // If there is already a template placed for this draft, cancel the old one
    if (currentDraft?.placedMapTemplateId) {
      useMapTemplateStore.getState().cancelEffect(currentDraft.placedMapTemplateId, () => ({}));
    }
    useMapTemplateStore.getState().startPlacement(matchedTemplate.id, token.id);
  };

  React.useEffect(() => {
    if (waitingForPlacement && matchedTemplate && token) {
      // Find the most recently placed effect matching this template and caster
      const recentEffect = [...placedEffects].reverse().find(
        e => e.templateId === matchedTemplate.id && e.casterId === token.id
      );
      if (recentEffect && currentDraft?.placedMapTemplateId !== recentEffect.id) {
        setWaitingForPlacement(false);
        useActionStore.getState().setDraftPlacedEffectId(draftId, recentEffect.id);
        
        // Auto-select the targets hit by the collision calculation
        if (recentEffect.impactedTargets && recentEffect.impactedTargets.length > 0) {
          useSessionStore.getState().setSelectedTokens(
            recentEffect.impactedTargets.map(t => t.targetId)
          );
        }
      }
    }
  }, [placedEffects, waitingForPlacement, matchedTemplate, token, draftId, currentDraft?.placedMapTemplateId]);

  const handleSubmit = async () => {
    if (!token || !currentAction) return;
    
    const payload: IntentPayload = {
      actorId: token.id,
      actionId: currentAction.id,
      actionType: category as IntentPayload['actionType'],
      targets: selectedTokenIds,
      modifiers: {
        castLevel: castLevel !== 'base' ? parseInt(castLevel, 10) : currentAction.spellLevel || 0,
        sneakAttack,
        smite,
      },
      placedMapTemplateId: useTemplate ? currentDraft?.placedMapTemplateId : undefined,
    };
    
    // Evaluate the intent to produce a resolution payload
    const resolutionPayload = await evaluateIntent(payload);
    
    // Submit evaluated intent directly to resolve phase
    useActionStore.getState().submitIntentResolution(payload, resolutionPayload);
    
    // Clear drafting intent so ui switches
    useActionStore.getState().cancelDrafting(draftId);
  };

  if (!token) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        Token not found or removed.
      </div>
    );
  }

  const selectedTargetsCount = selectedTokenIds.length;
  const targetTokens = tokens.filter(t => selectedTokenIds.includes(t.id));

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {token.name || token.label}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
            {CATEGORY_ICONS[category]}
            {CATEGORY_LABELS[category] || 'Action'}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {actions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No {CATEGORY_LABELS[category]?.toLowerCase()} available for this token.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Action Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Select Action</Label>
              <Select value={selectedActionId} onValueChange={setSelectedActionId}>
                <SelectTrigger className="w-full bg-slate-900 border-slate-700 h-10">
                  <SelectValue placeholder="Select an action..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {actions.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="focus:bg-slate-800">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentAction && currentAction.description && (
                <p className="text-xs text-slate-500 mt-2 bg-slate-900/50 p-2 rounded">
                  {currentAction.description}
                </p>
              )}
            </div>

            <Separator className="bg-slate-800" />

            {/* Modifiers Section */}
            <div className="space-y-4">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Modifiers & Scaling</Label>
              
              {/* Fake spell level scaling if category is spell */}
              {category === 'spell' && (
                <div className="space-y-3 bg-slate-900/50 p-3 rounded-md border border-slate-800">
                  <Label className="text-xs text-slate-300">Cast at Level</Label>
                  <RadioGroup value={castLevel} onValueChange={setCastLevel} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="base" id="l-base" className="border-slate-600" />
                      <Label htmlFor="l-base" className="text-xs">Base ({currentAction?.spellLevel || 1})</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={(currentAction?.spellLevel || 1) + 1 + ''} id="l-up1" className="border-slate-600" />
                      <Label htmlFor="l-up1" className="text-xs">+1 Level</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={(currentAction?.spellLevel || 1) + 2 + ''} id="l-up2" className="border-slate-600" />
                      <Label htmlFor="l-up2" className="text-xs">+2 Levels</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Optional Switches */}
              <div className="space-y-3 bg-slate-900/50 p-3 rounded-md border border-slate-800">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sneak-attack" className="text-xs font-medium cursor-pointer">Sneak Attack (+2d6)</Label>
                  <Switch id="sneak-attack" checked={sneakAttack} onCheckedChange={setSneakAttack} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="divine-smite" className="text-xs font-medium cursor-pointer">Divine Smite</Label>
                  <Switch id="divine-smite" checked={smite} onCheckedChange={setSmite} />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            {/* Targeting Summary */}
            <div className="space-y-4">
              {matchedTemplate && (
                <div className="bg-indigo-900/30 border border-indigo-500/30 p-3 rounded-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                        <Focus className="w-3.5 h-3.5" /> Area of Effect
                      </Label>
                      <p className="text-xs text-indigo-200/70 mt-1">Found template: {matchedTemplate.name}</p>
                    </div>
                    <Switch checked={useTemplate} onCheckedChange={setUseTemplate} />
                  </div>
                  
                  {useTemplate && (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
                      onClick={handlePlaceTemplate}
                    >
                      <Focus className="w-4 h-4 mr-2" />
                      {currentDraft?.placedMapTemplateId ? 'Replace Template' : 'Place Template'}
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-3.5 h-3.5" /> Targets Selected ({selectedTargetsCount})
              </Label>
              {selectedTargetsCount === 0 ? (
                <div className="text-xs text-amber-500/80 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                  Select targets on the canvas before submitting.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {targetTokens.map(t => (
                    <div key={t.id} className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">
                      {t.name || t.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 flex gap-3">
        {onCancel && (
          <Button 
            variant="outline"
            className="flex-1 bg-slate-800 border-slate-700 hover:bg-slate-700" 
            onClick={() => onCancel(draftId)}
          >
            Cancel
          </Button>
        )}
        <Button 
          className="flex-1 font-bold gap-2 text-primary-foreground" 
          size="lg"
          onClick={handleSubmit}
          disabled={!currentAction}
        >
          <Send className="w-4 h-4" /> Submit to DM
        </Button>
      </div>
    </div>
  );
}
