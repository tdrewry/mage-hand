import * as jsonLogic from 'json-logic-js';
import { useSessionStore } from '@/stores/sessionStore';
import { useRuleStore } from '@/stores/ruleStore';
import { rollDice } from '@/lib/diceEngine';
import type { IntentPayload, ResolutionPayload, TargetResult } from './types';
import type { MageHandEntity } from '@/types/native-schema';
import { useCreatureStore } from '@/stores/creatureStore';
import { collectAllActions, type TokenActionItem } from '@/lib/attackParser';

/**
 * Evaluates a player's declared intent and produces a standard V3 ResolutionPayload
 * to be dispatched to the DM.
 */
export async function evaluateIntent(intent: IntentPayload): Promise<ResolutionPayload> {
  const sessionStore = useSessionStore.getState();
  
  // We cast the session tokens locally to the authoritative MageHandEntity schema
  const actor = sessionStore.tokens.find(t => t.id === intent.actorId) as unknown as MageHandEntity | undefined;
  const targetTokens = sessionStore.tokens.filter(t => intent.targets.includes(t.id)) as unknown as MageHandEntity[];

  let allActions: TokenActionItem[] = [];
  if ((actor as any)?.statBlockJson) {
    try {
      allActions = collectAllActions(JSON.parse((actor as any).statBlockJson));
    } catch {}
  } else if ((actor as any)?.entityRef?.entityId) {
    const creatureStore = useCreatureStore.getState();
    const monster = creatureStore.getMonsterById((actor as any).entityRef.entityId);
    if (monster) {
      allActions = collectAllActions(monster);
    } else {
      const character = creatureStore.getCharacterById((actor as any).entityRef.entityId);
      if (character) allActions = collectAllActions(character);
    }
  }

  const declaredAction = allActions.find(a => a.id === intent.actionId);
  const pipelineId = (declaredAction as any)?.pipelineId;

  let compiledNodes: any[] = [];
  if (pipelineId) {
    const pipeline = useRuleStore.getState().pipelines.find(p => p.id === pipelineId);
    if (pipeline) {
      const { compilePipeline } = await import('./compiler');
      compiledNodes = compilePipeline(pipeline.nodes as any, pipeline.entryNodeId);
    }
  }

  const payload: ResolutionPayload = {
    source: { name: actor?.name || 'Unknown', type: intent.actionType },
    targets: targetTokens.map(t => ({ id: t.id, name: t.name || 'Unknown' })),
    challenge: { type: 'attack', versus: 'ac', target: 10 }, // mock vs target.stats.ac
    rawResults: { damage: {}, effects: {} },
    targetResults: {}
  };

  for (const target of targetTokens) {
    const microContext = { actor, target, intent, action: declaredAction };
    
    let targetResult: TargetResult | undefined;
    
    if (compiledNodes.length > 0) {
      const { executePipeline } = await import('./compiler');
      const compiledState = executePipeline(compiledNodes, microContext);
      if (compiledState && compiledState.targetResult) {
        targetResult = compiledState.targetResult as TargetResult;
      }
    }

    if (!targetResult) {
      // Fallback: If pipeline did not execute or yielded nothing, provide a basic mock result
      // Construct the actual singular TargetResult based on mock rolling and the pipeline's conceptual output
      // Assuming attacking using actor's strength modifier vs target's AC as mock logic:
      const actorStrMod = actor?.stats?.["str.mod"] ?? 5;
      const targetAc = target?.stats?.["ac"] ?? 10;
      
      payload.challenge!.target = targetAc;
      
      const attackRollResult = rollDice(`1d20+${actorStrMod}`);
      const attackTotal = attackRollResult.total;
      const isSuccess = attackTotal >= targetAc;
      
      const damageRollResult = rollDice('1d8+3');
      
      targetResult = {
        challengeResult: {
          rolls: attackRollResult.groups[0]?.keptResults || [0],
          modifier: actorStrMod,
          total: attackTotal,
          isSuccess
        },
        damage: isSuccess ? {
          "bludgeoning": { amount: { total: damageRollResult.total, formula: '1d8+3', rolls: damageRollResult.groups[0]?.keptResults || [] } }
        } : {},
        effectsApplied: {},
        suggestedResolution: isSuccess ? 'hit' : 'miss'
      };
    }

    payload.targetResults[target.id] = targetResult;
  }

  return payload;
}
