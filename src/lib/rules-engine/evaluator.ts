import * as jsonLogic from 'json-logic-js';
import { useSessionStore } from '@/stores/sessionStore';
import { useRuleStore } from '@/stores/ruleStore';
import { rollDice } from '@/lib/diceEngine';
import type { IntentPayload, ResolutionPayload, TargetResult } from './types';
import type { MageHandEntity } from '@/types/native-schema';
import { useCreatureStore } from '@/stores/creatureStore';
import { collectAllActions, type TokenActionItem } from '@/lib/attackParser';
import { useAdapterStore } from '@/stores/adapterStore';

function pathGet(obj: any, path: string) {
  if (path === '.') return obj;
  return path.split('.').reduce((acc: any, part: string) => acc && acc[part], obj);
}

function pathSet(obj: any, path: string, value: any) {
  if (path === '.') return;
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function mountAdapterData(token: any, backingData: any, sourceId: string) {
  if (!backingData || !token) return;
  const adapters = useAdapterStore.getState().getAdaptersForSource(sourceId);
  for (const adapter of adapters) {
    for (const mapping of adapter.mappings) {
      const sourceValue = pathGet(backingData, mapping.sourcePath);
      if (sourceValue !== undefined) {
        pathSet(token, mapping.mountPoint, sourceValue);
      }
    }
  }
}

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
  let actorBackingData: any = null;
  let actorSourceId = 'any';

  if ((actor as any)?.statBlockJson) {
    try {
      actorBackingData = JSON.parse((actor as any).statBlockJson);
      actorSourceId = 'json-statblock';
      allActions = collectAllActions(actorBackingData);
    } catch {}
  } else if ((actor as any)?.entityRef?.entityId) {
    const creatureStore = useCreatureStore.getState();
    const monster = creatureStore.getMonsterById((actor as any).entityRef.entityId);
    if (monster) {
      actorBackingData = monster;
      actorSourceId = 'monster-5e';
      allActions = collectAllActions(monster);
    } else {
      const character = creatureStore.getCharacterById((actor as any).entityRef.entityId);
      if (character) {
        actorBackingData = character;
        actorSourceId = 'character-5e';
        allActions = collectAllActions(character);
      }
    }
  }

  // Mount adapter data onto actor
  if (actor && actorBackingData) {
    mountAdapterData(actor, actorBackingData, actorSourceId);
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

  const sharedNodeResults: Record<string, any> = {};

  for (const target of targetTokens) {
    let targetBackingData: any = null;
    let targetSourceId = 'any';

    if ((target as any)?.statBlockJson) {
      try {
        targetBackingData = JSON.parse((target as any).statBlockJson);
        targetSourceId = 'json-statblock';
      } catch {}
    } else if ((target as any)?.entityRef?.entityId) {
      const creatureStore = useCreatureStore.getState();
      const monster = creatureStore.getMonsterById((target as any).entityRef.entityId);
      if (monster) {
        targetBackingData = monster;
        targetSourceId = 'monster-5e';
      } else {
        const character = creatureStore.getCharacterById((target as any).entityRef.entityId);
        if (character) {
          targetBackingData = character;
          targetSourceId = 'character-5e';
        }
      }
    }

    if (targetBackingData) {
      mountAdapterData(target, targetBackingData, targetSourceId);
    }

    const microContext = { actor, target, intent, action: declaredAction };
    
    let targetResult: TargetResult | undefined;
    
    if (compiledNodes.length > 0) {
      const { executePipeline } = await import('./compiler');
      const compiledState = executePipeline(compiledNodes, microContext, sharedNodeResults);
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
