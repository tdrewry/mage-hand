import { create } from 'zustand';
import type {
  ActionQueueEntry,
  AttackDefinition,
  ActionTarget,
  AttackResolution,
  ActionRollResult,
  DamageResult,
  ActionHistoryEntry,
  DEFAULT_SLAM_ATTACK,
} from '@/types/actionTypes';
import { rollDice } from '@/lib/diceEngine';
import { useSessionStore } from '@/stores/sessionStore';
import { useEffectStore } from '@/stores/effectStore';
import type { EffectImpact } from '@/types/effectTypes';

export interface ResolutionFlash {
  tokenId: string;
  x: number;
  y: number;
  color: 'hit' | 'miss';
  startTime: number;
}

interface ActionState {
  /** Currently active action (null = no action in progress) */
  currentAction: ActionQueueEntry | null;
  
  /** Whether the canvas is in targeting mode */
  isTargeting: boolean;
  
  /** Mouse position during targeting (world coords) for reticle drawing */
  targetingMousePos: { x: number; y: number } | null;
  
  /** History of resolved actions */
  actionHistory: ActionHistoryEntry[];

  /** Active resolution flash effects on canvas */
  resolutionFlashes: ResolutionFlash[];
}

interface ActionActions {
  /** Start a new attack action from a source token */
  startAttack: (sourceTokenId: string, attack: AttackDefinition) => void;
  
  /** Start an effect-based action with pre-populated targets (skips targeting phase) */
  startEffectAction: (params: {
    sourceTokenId?: string;
    templateId: string;
    templateName: string;
    damageType?: string;
    damageFormula?: string;
    placedEffectId: string;
    impacts: EffectImpact[];
  }) => void;
  
  /** Add a target to the current action */
  addTarget: (target: ActionTarget) => void;
  
  /** Remove a target entry by targetKey */
  removeTarget: (targetKey: string) => void;
  
  /** Confirm targets and move to resolve phase (rolls attack + damage) */
  confirmTargets: () => void;
  
  /** Set DM resolution for a target entry */
  setResolution: (targetKey: string, resolution: AttackResolution) => void;
  
  /** Override damage for a target entry */
  overrideDamage: (targetKey: string, adjustedTotal: number) => void;
  
  /** Finalize and commit the action — log to history */
  commitAction: () => void;
  
  /** Cancel the current action */
  cancelAction: () => void;
  
  /** Update targeting mouse position */
  setTargetingMousePos: (pos: { x: number; y: number } | null) => void;
  
  /** Clear history */
  clearHistory: () => void;

  /** Clear expired flashes */
  clearFlashes: () => void;
}

type ActionStore = ActionState & ActionActions;

export const useActionStore = create<ActionStore>((set, get) => ({
  currentAction: null,
  isTargeting: false,
  targetingMousePos: null,
  actionHistory: [],
  resolutionFlashes: [],

  startAttack: (sourceTokenId, attack) => {
    const token = useSessionStore.getState().tokens.find(t => t.id === sourceTokenId);
    if (!token) return;

    const entry: ActionQueueEntry = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      phase: 'targeting',
      category: 'attack',
      sourceTokenId,
      sourceTokenName: token.name || token.label || 'Unknown',
      attack,
      targets: [],
      rollResults: {},
      damageResults: {},
      resolutions: {},
      timestamp: Date.now(),
    };

    set({ currentAction: entry, isTargeting: true, targetingMousePos: null });
  },

  startEffectAction: ({ sourceTokenId, templateId, templateName, damageType, damageFormula, placedEffectId, impacts }) => {
    const sessionTokens = useSessionStore.getState().tokens;
    const sourceToken = sourceTokenId ? sessionTokens.find(t => t.id === sourceTokenId) : null;

    // Convert EffectImpacts to ActionTargets (only tokens, not mapObjects)
    let hitIndex = 0;
    const targets: ActionTarget[] = impacts
      .filter(i => i.targetType === 'token')
      .map(i => {
        const token = sessionTokens.find(t => t.id === i.targetId);
        hitIndex++;
        return {
          targetKey: `${i.targetId}-hit${hitIndex}`,
          tokenId: i.targetId,
          tokenName: token?.name || token?.label || 'Unknown',
          distance: i.distanceFromOrigin,
          defenseValue: 10, // Default — DM can adjust
          defenseType: 'flat' as const,
          defenseLabel: 'Save DC',
        };
      });

    if (targets.length === 0) return;

    // Build a synthetic attack definition from the effect template
    const effectAttack: AttackDefinition = {
      id: `effect-${templateId}`,
      name: templateName,
      attackBonus: 0,
      damageFormula: damageFormula || '0',
      damageType: damageType || 'untyped',
      description: `Effect: ${templateName}`,
    };

    // Roll damage for each target
    const rollResults: Record<string, ActionRollResult> = {};
    const damageResults: Record<string, DamageResult> = {};

    for (const target of targets) {
      rollResults[target.targetKey] = {
        naturalRoll: 0,
        totalRoll: 0,
        attackBonus: 0,
        formula: 'Save',
      };

      if (damageFormula && damageFormula !== '0') {
        const result = rollDice(damageFormula);
        const diceResults = result.groups.flatMap(g => g.keptResults);
        damageResults[target.targetKey] = {
          formula: damageFormula,
          total: result.total,
          diceResults,
          damageType: damageType || 'untyped',
          adjustedTotal: result.total,
        };
      } else {
        damageResults[target.targetKey] = {
          formula: '0',
          total: 0,
          diceResults: [],
          damageType: damageType || 'untyped',
          adjustedTotal: 0,
        };
      }
    }

    const entry: ActionQueueEntry = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      phase: 'resolve', // Skip targeting — targets are pre-populated
      category: 'effect',
      sourceTokenId: sourceTokenId || 'environment',
      sourceTokenName: sourceToken?.name || sourceToken?.label || 'Environment',
      attack: effectAttack,
      targets,
      rollResults,
      damageResults,
      resolutions: {},
      timestamp: Date.now(),
      effectInfo: {
        templateId,
        templateName,
        damageType,
        placedEffectId,
      },
    };

    set({ currentAction: entry, isTargeting: false, targetingMousePos: null });
  },

  addTarget: (target) => {
    const { currentAction } = get();
    if (!currentAction || currentAction.phase !== 'targeting') return;

    set({
      currentAction: {
        ...currentAction,
        targets: [...currentAction.targets, target],
      },
    });
  },

  removeTarget: (targetKey) => {
    const { currentAction } = get();
    if (!currentAction) return;

    const newTargets = currentAction.targets.filter(t => t.targetKey !== targetKey);
    const { [targetKey]: _roll, ...rollResults } = currentAction.rollResults;
    const { [targetKey]: _dmg, ...damageResults } = currentAction.damageResults;
    const { [targetKey]: _res, ...resolutions } = currentAction.resolutions;

    if (newTargets.length === 0) {
      get().cancelAction();
      return;
    }

    set({
      currentAction: {
        ...currentAction,
        targets: newTargets,
        rollResults,
        damageResults,
        resolutions,
      },
    });
  },

  confirmTargets: () => {
    const { currentAction } = get();
    if (!currentAction || currentAction.targets.length === 0 || !currentAction.attack) return;

    // Roll attack and damage for each target
    const rollResults: Record<string, ActionRollResult> = {};
    const damageResults: Record<string, DamageResult> = {};

    for (const target of currentAction.targets) {
      const attackFormula = `1d20+${currentAction.attack.attackBonus}`;
      const attackResult = rollDice(attackFormula);
      const naturalRoll = attackResult.groups[0]?.keptResults[0] ?? 0;
      
      rollResults[target.targetKey] = {
        naturalRoll,
        totalRoll: attackResult.total,
        attackBonus: currentAction.attack.attackBonus,
        formula: attackFormula,
      };

      const damageResult = rollDice(currentAction.attack.damageFormula);
      const diceResults = damageResult.groups.flatMap(g => g.keptResults);
      
      damageResults[target.targetKey] = {
        formula: currentAction.attack.damageFormula,
        total: damageResult.total,
        diceResults,
        damageType: currentAction.attack.damageType,
        adjustedTotal: damageResult.total,
      };
    }

    set({
      currentAction: {
        ...currentAction,
        phase: 'resolve',
        rollResults,
        damageResults,
      },
      isTargeting: false,
      targetingMousePos: null,
    });
  },

  setResolution: (targetKey, resolution) => {
    const { currentAction } = get();
    if (!currentAction || currentAction.phase !== 'resolve') return;

    const damageResults = { ...currentAction.damageResults };
    const existing = damageResults[targetKey];
    if (existing) {
      let adjustedTotal = existing.total;
      if (resolution === 'critical_miss' || resolution === 'miss') {
        adjustedTotal = 0;
      } else if (resolution === 'critical_hit') {
        adjustedTotal = existing.total * 2;
      }
      damageResults[targetKey] = { ...existing, adjustedTotal };
    }

    set({
      currentAction: {
        ...currentAction,
        resolutions: { ...currentAction.resolutions, [targetKey]: resolution },
        damageResults,
      },
    });
  },

  overrideDamage: (targetKey, adjustedTotal) => {
    const { currentAction } = get();
    if (!currentAction || currentAction.phase !== 'resolve') return;

    const existing = currentAction.damageResults[targetKey];
    if (!existing) return;

    set({
      currentAction: {
        ...currentAction,
        damageResults: {
          ...currentAction.damageResults,
          [targetKey]: { ...existing, adjustedTotal },
        },
      },
    });
  },

  commitAction: () => {
    const { currentAction, actionHistory } = get();
    if (!currentAction || !currentAction.attack) return;

    // Remove the placed effect for instant effect actions
    if (currentAction.effectInfo?.placedEffectId && currentAction.category === 'effect') {
      const effectStore = useEffectStore.getState();
      const tpl = effectStore.getTemplate(currentAction.effectInfo.templateId);
      if (tpl?.persistence === 'instant') {
        effectStore.dismissEffect(currentAction.effectInfo.placedEffectId);
      }
    }

    // Build resolution flashes from targets
    const sessionTokens = useSessionStore.getState().tokens;
    const now = Date.now();
    const flashes: ResolutionFlash[] = currentAction.targets.map(t => {
      const token = sessionTokens.find(tk => tk.id === t.tokenId);
      const resolution = currentAction.resolutions[t.targetKey] || 'miss';
      const isHit = resolution === 'hit' || resolution === 'critical_hit' || resolution === 'critical_threat';
      return {
        tokenId: t.tokenId,
        x: token?.x ?? 0,
        y: token?.y ?? 0,
        color: isHit ? 'hit' : 'miss',
        startTime: now,
      };
    });

    // Build history entry
    const historyEntry: ActionHistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'action_resolved',
      timestamp: Date.now(),
      sourceTokenId: currentAction.sourceTokenId,
      sourceTokenName: currentAction.sourceTokenName,
      attack: currentAction.attack,
      targets: currentAction.targets.map(t => ({
        tokenId: t.tokenId,
        tokenName: t.tokenName,
        distance: t.distance,
        defenseValue: t.defenseValue,
        defenseLabel: t.defenseLabel,
        attackRoll: currentAction.rollResults[t.targetKey],
        damage: currentAction.damageResults[t.targetKey],
        resolution: currentAction.resolutions[t.targetKey] || 'miss',
      })),
    };

    set({
      currentAction: null,
      isTargeting: false,
      targetingMousePos: null,
      actionHistory: [historyEntry, ...actionHistory].slice(0, 100),
      resolutionFlashes: [...get().resolutionFlashes, ...flashes],
    });

    // Auto-clear flashes after 1.5s
    setTimeout(() => {
      get().clearFlashes();
    }, 1500);
  },

  cancelAction: () => {
    const { currentAction } = get();

    // Remove the placed effect for instant effect actions
    if (currentAction?.effectInfo?.placedEffectId && currentAction.category === 'effect') {
      const effectStore = useEffectStore.getState();
      const tpl = effectStore.getTemplate(currentAction.effectInfo.templateId);
      if (tpl?.persistence === 'instant') {
        effectStore.dismissEffect(currentAction.effectInfo.placedEffectId);
      }
    }

    set({
      currentAction: null,
      isTargeting: false,
      targetingMousePos: null,
    });
  },

  setTargetingMousePos: (pos) => {
    set({ targetingMousePos: pos });
  },

  clearHistory: () => {
    set({ actionHistory: [] });
  },

  clearFlashes: () => {
    const now = Date.now();
    set({ resolutionFlashes: get().resolutionFlashes.filter(f => now - f.startTime < 1500) });
  },
}));
