import * as jsonLogic from 'json-logic-js';
import { useSessionStore } from '@/stores/sessionStore';
import { rollDice } from '@/lib/diceEngine';
import type { IntentPayload, ResolutionPayload, TargetResult } from './types';

/**
 * Evaluates a player's declared intent and produces a standard V3 ResolutionPayload
 * to be dispatched to the DM.
 */
export async function evaluateIntent(intent: IntentPayload): Promise<ResolutionPayload> {
  const sessionStore = useSessionStore.getState();
  const actor = sessionStore.tokens.find(t => t.id === intent.actorId);
  const targetTokens = sessionStore.tokens.filter(t => intent.targets.includes(t.id));

  // The Pipeline Mock
  // Since we haven't fully implemented the jsonLogic graph traversal yet, we use a basic mock pipeline.
  const mockPipeline = {
    // A mock pipeline that merely returns a static indicator or executes some mock logic
    "===": [1, 1]
  };

  const payload: ResolutionPayload = {
    source: { name: actor?.name || actor?.label || 'Unknown', type: intent.actionType },
    targets: targetTokens.map(t => ({ id: t.id, name: t.name || t.label || 'Unknown' })),
    challenge: { type: 'attack', versus: 'AC', target: 10 }, // mock AC=10
    rawResults: { damage: {}, effects: {} },
    targetResults: {}
  };

  for (const target of targetTokens) {
    const microContext = { actor, source: intent, target };
    
    // Execute the mock pipeline via jsonLogic
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _pipelineResult = jsonLogic.apply(mockPipeline, microContext);
    
    // Construct the actual singular TargetResult based on mock rolling and the pipeline's conceptual output
    const attackRollResult = rollDice('1d20+5');
    const attackTotal = attackRollResult.total;
    const isSuccess = attackTotal >= 10;
    
    const damageRollResult = rollDice('1d8+3');
    
    const targetResult: TargetResult = {
      challengeResult: {
        rolls: attackRollResult.groups[0]?.keptResults || [0],
        modifier: 5,
        total: attackTotal,
        isSuccess
      },
      damage: isSuccess ? {
        "bludgeoning": { amount: damageRollResult.total }
      } : {},
      effectsApplied: {},
      suggestedResolution: isSuccess ? 'hit' : 'miss'
    };

    payload.targetResults[target.id] = targetResult;
  }

  return payload;
}
