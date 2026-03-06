import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActionQueueEntry,
  AttackDefinition,
  ActionTarget,
  AttackResolution,
  ActionRollResult,
  DamageResult,
  DamageBreakdownEntry,
  ActionHistoryEntry,
  DEFAULT_SLAM_ATTACK,
} from '@/types/actionTypes';
import { rollDice } from '@/lib/diceEngine';
import { useSessionStore } from '@/stores/sessionStore';
import { useChatStore } from '@/stores/chatStore';
import { useEffectStore } from '@/stores/effectStore';
import type { EffectImpact, DamageDiceEntry } from '@/types/effectTypes';
import { ephemeralBus } from '@/lib/net';

/** Broadcast the current action queue state to other DM sessions */
function broadcastActionQueue() {
  const { currentAction, pendingActions, actionHistory } = useActionStore.getState();
  try {
    ephemeralBus.emit('action.queue.sync', {
      currentAction,
      pendingActions,
      actionHistory,
    });
  } catch {
    // ephemeralBus may not be connected — silently ignore
  }
}

/** Broadcast action.pending to all peers (players see toast) */
function broadcastActionPending(action: ActionQueueEntry) {
  if (!action.attack) return;
  try {
    ephemeralBus.emit('action.pending', {
      actionId: action.id,
      sourceName: action.sourceTokenName,
      attackName: action.attack.name,
      targetNames: action.targets.map(t => t.tokenName),
      category: action.category,
    });
  } catch { /* ignore */ }
}

/** Broadcast action.resolved to all peers (players see outcome) */
function broadcastActionResolved(action: ActionQueueEntry) {
  if (!action.attack) return;
  try {
    ephemeralBus.emit('action.resolved', {
      actionId: action.id,
      sourceName: action.sourceTokenName,
      attackName: action.attack.name,
      category: action.category,
      targets: action.targets.map(t => ({
        tokenName: t.tokenName,
        resolution: action.resolutions[t.targetKey] || 'miss',
        totalDamage: action.damageResults[t.targetKey]?.adjustedTotal ?? 0,
        damageType: action.damageResults[t.targetKey]?.damageType ?? 'untyped',
      })),
    });
  } catch { /* ignore */ }
}

/** Broadcast resolution claim / release for multi-DM coordination */
export function broadcastResolutionClaim(actionId: string, claimedBy: string | null, claimedByName: string | null) {
  try {
    ephemeralBus.emit('action.resolution.claim', {
      actionId,
      claimedBy,
      claimedByName,
    });
  } catch { /* ignore */ }
}

/** Broadcast action.inProgress so peers know an action phase is active */
function broadcastActionInProgress(actionType: string, sourceTokenId?: string) {
  try {
    ephemeralBus.emit('action.inProgress', { actionType, sourceTokenId });
  } catch { /* ignore */ }
}
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
  
  /** Queued actions waiting to be resolved (FIFO) */
  pendingActions: ActionQueueEntry[];
  
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
  
  /** Start a skill check action (rolls d20+modifier, goes straight to resolve) */
  startSkillCheck: (sourceTokenId: string, skillName: string, modifier: number) => void;
  
  /** Start an effect-based action with pre-populated targets (skips targeting phase) */
  startEffectAction: (params: {
    sourceTokenId?: string;
    templateId: string;
    templateName: string;
    damageType?: string;
    damageFormula?: string;
    damageDice?: DamageDiceEntry[];
    placedEffectId: string;
    groupId?: string;
    castLevel?: number;
    impacts: EffectImpact[];
    attackRoll?: { enabled: boolean; abilitySource: string; fixedBonus?: number; addProficiency?: boolean };
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
  
  /** Cancel the current action and all queued actions */
  cancelAllActions: () => void;
  
  /** Update targeting mouse position */
  setTargetingMousePos: (pos: { x: number; y: number } | null) => void;
  
  /** Clear history */
  clearHistory: () => void;

  /** Clear expired flashes */
  clearFlashes: () => void;

  /** Swap currentAction with a pending action by index, allowing any-order resolution */
  swapToAction: (pendingIndex: number) => void;

  /** Hydrate the full action queue from an external source (ephemeral sync) */
  hydrateQueue: (currentAction: ActionQueueEntry | null, pendingActions: ActionQueueEntry[], actionHistory: ActionHistoryEntry[]) => void;
}

type ActionStore = ActionState & ActionActions;

export const useActionStore = create<ActionStore>()(
  persist(
    (set, get) => ({
  currentAction: null,
  pendingActions: [],
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

    const { currentAction } = get();
    if (currentAction) {
      set({ pendingActions: [...get().pendingActions, entry] });
    } else {
      set({ currentAction: entry, isTargeting: true, targetingMousePos: null });
      broadcastActionInProgress('targeting', sourceTokenId);
    }
  },

  startSkillCheck: (sourceTokenId, skillName, modifier) => {
    const token = useSessionStore.getState().tokens.find(t => t.id === sourceTokenId);
    if (!token) return;

    const formula = `1d20${modifier >= 0 ? '+' : ''}${modifier}`;
    const result = rollDice(formula);
    const naturalRoll = result.groups[0]?.keptResults[0] ?? 0;

    const skillAttack: AttackDefinition = {
      id: `skill-${skillName.toLowerCase().replace(/\s+/g, '-')}`,
      name: skillName,
      attackBonus: modifier,
      damageFormula: '0',
      damageType: 'none',
      description: `Skill check: ${skillName}`,
    };

    const tokenName = token.name || token.label || 'Unknown';
    const targetKey = `${sourceTokenId}-skill`;

    const entry: ActionQueueEntry = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      phase: 'resolve',
      category: 'skill',
      sourceTokenId,
      sourceTokenName: tokenName,
      attack: skillAttack,
      targets: [{
        targetKey,
        tokenId: sourceTokenId,
        tokenName: tokenName,
        distance: 0,
        defenseValue: 0,
        defenseType: 'flat',
        defenseLabel: 'DC',
      }],
      rollResults: {
        [targetKey]: {
          naturalRoll,
          totalRoll: result.total,
          attackBonus: modifier,
          formula,
        },
      },
      damageResults: {
        [targetKey]: {
          formula: '0',
          total: 0,
          diceResults: [],
          damageType: 'none',
          adjustedTotal: 0,
        },
      },
      resolutions: {},
      timestamp: Date.now(),
    };

    const { currentAction } = get();
    if (currentAction) {
      set({ pendingActions: [...get().pendingActions, entry] });
    } else {
      set({ currentAction: entry, isTargeting: false, targetingMousePos: null });
    }
  },

  startEffectAction: ({ sourceTokenId, templateId, templateName, damageType, damageFormula, damageDice, placedEffectId, groupId, castLevel, impacts, attackRoll }) => {
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
          defenseLabel: attackRoll?.enabled ? 'AC' : 'Save DC',
        };
      });

    if (targets.length === 0) return;

    // Resolve attack bonus from caster data or fixed bonus
    let resolvedAttackBonus = 0;
    if (attackRoll?.enabled) {
      if (attackRoll.fixedBonus !== undefined) {
        resolvedAttackBonus = attackRoll.fixedBonus;
      }
      // Note: Character-based ability resolution would happen here
      // when the caster has linked character data
      if (attackRoll.addProficiency !== false) {
        // Default: add proficiency if available (would come from character data)
      }
    }

    // Determine effective damage dice rows
    const effectiveDamageDice: DamageDiceEntry[] = (damageDice && damageDice.length > 0)
      ? damageDice
      : (damageFormula && damageFormula !== '0')
        ? [{ formula: damageFormula, damageType: damageType || 'untyped' }]
        : [];

    // Build a synthetic attack definition from the effect template
    const combinedFormula = effectiveDamageDice.map(d => d.formula).join(' + ') || '0';
    const primaryType = effectiveDamageDice[0]?.damageType || damageType || 'untyped';

    const effectAttack: AttackDefinition = {
      id: `effect-${templateId}`,
      name: templateName,
      attackBonus: attackRoll?.enabled ? resolvedAttackBonus : 0,
      damageFormula: combinedFormula,
      damageType: primaryType,
      description: `Effect: ${templateName}`,
    };

    // Roll damage for each target
    const rollResults: Record<string, ActionRollResult> = {};
    const damageResults: Record<string, DamageResult> = {};

    for (const target of targets) {
      if (attackRoll?.enabled) {
        // Roll attack for effect (spell attack)
        const attackFormula = `1d20+${resolvedAttackBonus}`;
        const attackResult = rollDice(attackFormula);
        const naturalRoll = attackResult.groups[0]?.keptResults[0] ?? 0;
        rollResults[target.targetKey] = {
          naturalRoll,
          totalRoll: attackResult.total,
          attackBonus: resolvedAttackBonus,
          formula: attackFormula,
        };
      } else {
        rollResults[target.targetKey] = {
          naturalRoll: 0,
          totalRoll: 0,
          attackBonus: 0,
          formula: 'Save',
        };
      }

      if (effectiveDamageDice.length > 0) {
        // Roll each damage dice row independently
        const breakdown: DamageBreakdownEntry[] = effectiveDamageDice.map(dd => {
          const result = rollDice(dd.formula);
          const diceResults = result.groups.flatMap(g => g.keptResults);
          return {
            formula: dd.formula,
            total: result.total,
            diceResults,
            damageType: dd.damageType,
            adjustedTotal: result.total,
          };
        });

        const grandTotal = breakdown.reduce((sum, b) => sum + b.total, 0);
        const allDice = breakdown.flatMap(b => b.diceResults);

        damageResults[target.targetKey] = {
          formula: combinedFormula,
          total: grandTotal,
          diceResults: allDice,
          damageType: primaryType,
          adjustedTotal: grandTotal,
          breakdown: breakdown.length > 1 ? breakdown : undefined,
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
        groupId,
        castLevel,
      },
    };

    // If there's already an active action, queue this one
    const { currentAction } = get();
    if (currentAction) {
      set({ pendingActions: [...get().pendingActions, entry] });
    } else {
      set({ currentAction: entry, isTargeting: false, targetingMousePos: null });
      // Effect actions go straight to resolve — broadcast pending
      broadcastActionPending(entry);
      broadcastActionInProgress('resolve', sourceTokenId);
    }
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

    const updatedAction = {
      ...currentAction,
      phase: 'resolve' as const,
      rollResults,
      damageResults,
    };

    set({
      currentAction: updatedAction,
      isTargeting: false,
      targetingMousePos: null,
    });

    // Broadcast to players that resolution is pending
    broadcastActionPending(updatedAction);
    broadcastActionInProgress('resolve', updatedAction.sourceTokenId);
  },

  setResolution: (targetKey, resolution) => {
    const { currentAction } = get();
    if (!currentAction || currentAction.phase !== 'resolve') return;

    const damageResults = { ...currentAction.damageResults };
    const existing = damageResults[targetKey];
    if (existing) {
      let adjustedTotal = existing.total;
      let updatedBreakdown = existing.breakdown;

      if (resolution === 'critical_miss' || resolution === 'miss') {
        adjustedTotal = 0;
        if (updatedBreakdown) {
          updatedBreakdown = updatedBreakdown.map(b => ({ ...b, adjustedTotal: 0 }));
        }
      } else if (resolution === 'half') {
        adjustedTotal = Math.floor(existing.total / 2);
        if (updatedBreakdown) {
          updatedBreakdown = updatedBreakdown.map(b => ({ ...b, adjustedTotal: Math.floor(b.total / 2) }));
        }
      } else if (resolution === 'critical_hit') {
        adjustedTotal = existing.total * 2;
        if (updatedBreakdown) {
          updatedBreakdown = updatedBreakdown.map(b => ({ ...b, adjustedTotal: b.total * 2 }));
        }
      } else {
        // hit or critical_threat — reset to base totals
        if (updatedBreakdown) {
          updatedBreakdown = updatedBreakdown.map(b => ({ ...b, adjustedTotal: b.total }));
        }
      }

      damageResults[targetKey] = { ...existing, adjustedTotal, breakdown: updatedBreakdown };
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

    // Remove placed effects for instant effect actions (including all multi-drop group members)
    if (currentAction.category === 'effect' && currentAction.effectInfo) {
      const effectStore = useEffectStore.getState();
      const tpl = effectStore.getTemplate(currentAction.effectInfo.templateId);
      if (tpl?.persistence === 'instant') {
        if (currentAction.effectInfo.groupId) {
          // Dismiss all effects in this multi-drop group
          const groupEffects = effectStore.placedEffects.filter(
            e => e.groupId === currentAction.effectInfo!.groupId
          );
          for (const fx of groupEffects) {
            effectStore.dismissEffect(fx.id);
          }
        } else {
          effectStore.dismissEffect(currentAction.effectInfo.placedEffectId);
        }
      }
    }

    // Build resolution flashes from targets
    const sessionTokens = useSessionStore.getState().tokens;
    const now = Date.now();
    const flashes: ResolutionFlash[] = currentAction.targets.map(t => {
      const token = sessionTokens.find(tk => tk.id === t.tokenId);
      const resolution = currentAction.resolutions[t.targetKey] || 'miss';
      const isHit = resolution === 'hit' || resolution === 'half' || resolution === 'critical_hit' || resolution === 'critical_threat';
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

    // Advance queue: pop next pending action if any
    const [nextAction, ...remainingActions] = get().pendingActions;

    set({
      currentAction: nextAction || null,
      pendingActions: remainingActions,
      isTargeting: nextAction?.phase === 'targeting',
      targetingMousePos: null,
      actionHistory: [historyEntry, ...actionHistory].slice(0, 100),
      resolutionFlashes: [...get().resolutionFlashes, ...flashes],
    });

    // Broadcast action flashes to all peers
    import("@/lib/net").then(({ ephemeralBus }) => {
      for (const flash of flashes) {
        const result = flash.color === 'hit' ? 'hit' : 'miss';
        ephemeralBus.emit("action.flash", {
          targetTokenId: flash.tokenId,
          result,
        });
      }
    }).catch(() => { /* net not available */ });

    // Broadcast resolved outcome to all peers (players see summary)
    broadcastActionResolved(currentAction);
    // Release any resolution claim
    broadcastResolutionClaim(currentAction.id, null, null);

    // Auto-clear flashes after 1.5s
    setTimeout(() => {
      get().clearFlashes();
    }, 1500);
  },

  cancelAction: () => {
    const { currentAction } = get();

    // Remove placed effects for instant effect actions (including all multi-drop group members)
    if (currentAction?.category === 'effect' && currentAction.effectInfo) {
      const effectStore = useEffectStore.getState();
      const tpl = effectStore.getTemplate(currentAction.effectInfo.templateId);
      if (tpl?.persistence === 'instant') {
        if (currentAction.effectInfo.groupId) {
          const groupEffects = effectStore.placedEffects.filter(
            e => e.groupId === currentAction.effectInfo!.groupId
          );
          for (const fx of groupEffects) {
            effectStore.dismissEffect(fx.id);
          }
        } else {
          effectStore.dismissEffect(currentAction.effectInfo.placedEffectId);
        }
      }
    }

    // Clear pending notification for cancelled action
    if (currentAction) {
      broadcastResolutionClaim(currentAction.id, null, null);
    }

    // Advance queue: pop next pending action if any
    const [nextAction, ...remainingActions] = get().pendingActions;

    set({
      currentAction: nextAction || null,
      pendingActions: remainingActions,
      isTargeting: nextAction?.phase === 'targeting',
      targetingMousePos: null,
    });
  },

  cancelAllActions: () => {
    const { currentAction, pendingActions } = get();
    const allActions = [currentAction, ...pendingActions].filter(Boolean) as ActionQueueEntry[];
    const effectStore = useEffectStore.getState();

    for (const action of allActions) {
      if (action.category === 'effect' && action.effectInfo) {
        const tpl = effectStore.getTemplate(action.effectInfo.templateId);
        if (tpl?.persistence === 'instant') {
          if (action.effectInfo.groupId) {
            const groupEffects = effectStore.placedEffects.filter(
              e => e.groupId === action.effectInfo!.groupId
            );
            for (const fx of groupEffects) {
              effectStore.dismissEffect(fx.id);
            }
          } else {
            effectStore.dismissEffect(action.effectInfo.placedEffectId);
          }
        }
      }
    }

    set({
      currentAction: null,
      pendingActions: [],
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

  swapToAction: (pendingIndex) => {
    const { currentAction, pendingActions } = get();
    if (!currentAction || pendingIndex < 0 || pendingIndex >= pendingActions.length) return;
    const target = pendingActions[pendingIndex];
    const newPending = [...pendingActions];
    newPending[pendingIndex] = currentAction;
    set({
      currentAction: target,
      pendingActions: newPending,
      isTargeting: target.phase === 'targeting',
      targetingMousePos: null,
    });
  },

  hydrateQueue: (currentAction, pendingActions, actionHistory) => {
    set({
      currentAction,
      pendingActions,
      actionHistory,
      isTargeting: currentAction?.phase === 'targeting',
      targetingMousePos: null,
      resolutionFlashes: [],
    });
  },
}),
    {
      name: 'vtt-action-store',
      partialize: (state) => ({
        currentAction: state.currentAction,
        pendingActions: state.pendingActions,
        actionHistory: state.actionHistory,
      }),
    }
  )
);

// Auto-broadcast action queue changes to other DM sessions via ephemeral bus
let _lastBroadcastJson = '';
let _lastHistoryLength = 0;
useActionStore.subscribe((state) => {
  // Only broadcast meaningful queue state changes (skip flashes, mouse pos)
  const snapshot = JSON.stringify({
    ca: state.currentAction,
    pa: state.pendingActions,
    ah: state.actionHistory,
  });
  if (snapshot !== _lastBroadcastJson) {
    _lastBroadcastJson = snapshot;
    broadcastActionQueue();
  }

  // Feed new history entries into the chat log
  if (state.actionHistory.length > _lastHistoryLength && _lastHistoryLength > 0) {
    const newEntries = state.actionHistory.slice(0, state.actionHistory.length - _lastHistoryLength);
    try {
      for (const entry of newEntries) {
        useChatStore.getState().addActionEntry(entry);
      }
    } catch { /* chatStore may not be loaded yet */ }
  }
  _lastHistoryLength = state.actionHistory.length;
});
