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
  
  /** Add a target to the current action */
  addTarget: (target: ActionTarget) => void;
  
  /** Confirm targets and move to resolve phase (rolls attack + damage) */
  confirmTargets: () => void;
  
  /** Set DM resolution for a target */
  setResolution: (targetTokenId: string, resolution: AttackResolution) => void;
  
  /** Override damage for a target */
  overrideDamage: (targetTokenId: string, adjustedTotal: number) => void;
  
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

  confirmTargets: () => {
    const { currentAction } = get();
    if (!currentAction || currentAction.targets.length === 0 || !currentAction.attack) return;

    // Roll attack and damage for each target
    const rollResults: Record<string, ActionRollResult> = {};
    const damageResults: Record<string, DamageResult> = {};

    for (const target of currentAction.targets) {
      // Attack roll: 1d20 + attackBonus
      const attackFormula = `1d20+${currentAction.attack.attackBonus}`;
      const attackResult = rollDice(attackFormula);
      const naturalRoll = attackResult.groups[0]?.keptResults[0] ?? 0;
      
      rollResults[target.tokenId] = {
        naturalRoll,
        totalRoll: attackResult.total,
        attackBonus: currentAction.attack.attackBonus,
        formula: attackFormula,
      };

      // Damage roll
      const damageResult = rollDice(currentAction.attack.damageFormula);
      const diceResults = damageResult.groups.flatMap(g => g.keptResults);
      
      damageResults[target.tokenId] = {
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

  setResolution: (targetTokenId, resolution) => {
    const { currentAction } = get();
    if (!currentAction || currentAction.phase !== 'resolve') return;

    // Auto-adjust damage based on resolution
    const damageResults = { ...currentAction.damageResults };
    const existing = damageResults[targetTokenId];
    if (existing) {
      let adjustedTotal = existing.total;
      if (resolution === 'critical_miss' || resolution === 'miss') {
        adjustedTotal = 0;
      } else if (resolution === 'critical_hit') {
        adjustedTotal = existing.total * 2;
      }
      // critical_threat keeps normal damage until confirmed
      damageResults[targetTokenId] = { ...existing, adjustedTotal };
    }

    set({
      currentAction: {
        ...currentAction,
        resolutions: { ...currentAction.resolutions, [targetTokenId]: resolution },
        damageResults,
      },
    });
  },

  overrideDamage: (targetTokenId, adjustedTotal) => {
    const { currentAction } = get();
    if (!currentAction || currentAction.phase !== 'resolve') return;

    const existing = currentAction.damageResults[targetTokenId];
    if (!existing) return;

    set({
      currentAction: {
        ...currentAction,
        damageResults: {
          ...currentAction.damageResults,
          [targetTokenId]: { ...existing, adjustedTotal },
        },
      },
    });
  },

  commitAction: () => {
    const { currentAction, actionHistory } = get();
    if (!currentAction || !currentAction.attack) return;

    // Build resolution flashes from targets
    const sessionTokens = useSessionStore.getState().tokens;
    const now = Date.now();
    const flashes: ResolutionFlash[] = currentAction.targets.map(t => {
      const token = sessionTokens.find(tk => tk.id === t.tokenId);
      const resolution = currentAction.resolutions[t.tokenId] || 'miss';
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
        attackRoll: currentAction.rollResults[t.tokenId],
        damage: currentAction.damageResults[t.tokenId],
        resolution: currentAction.resolutions[t.tokenId] || 'miss',
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
