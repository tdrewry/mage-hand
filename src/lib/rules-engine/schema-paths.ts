import { useGlobalConfigStore } from '@/stores/globalConfigStore';

export function getV3SchemaPaths(): string[] {
  const state = useGlobalConfigStore.getState();
  const damageTypes = state.categories['damageTypes']?.items || [];
  const conditions = state.categories['conditions']?.items || [];

  const paths: string[] = [];

  // rawResults.damage
  paths.push("rawResults.damage.<type>.amount");
  damageTypes.forEach(t => paths.push(`rawResults.damage.${t.value}.amount`));
  paths.push("rawResults.damage.<type>.formula");
  damageTypes.forEach(t => paths.push(`rawResults.damage.${t.value}.formula`));
  paths.push("rawResults.damage.<type>.rolls");
  damageTypes.forEach(t => paths.push(`rawResults.damage.${t.value}.rolls`));

  // rawResults.effects
  paths.push("rawResults.effects.<type>.duration");
  conditions.forEach(c => paths.push(`rawResults.effects.${c.value}.duration`));

  // targetResult.challengeResult
  paths.push("targetResult.challengeResult.rolls");
  paths.push("targetResult.challengeResult.modifier");
  paths.push("targetResult.challengeResult.total");
  paths.push("targetResult.challengeResult.isSuccess");

  // targetResult.damage
  paths.push("targetResult.damage.<type>.amount");
  damageTypes.forEach(t => paths.push(`targetResult.damage.${t.value}.amount`));

  // targetResult.effectsApplied
  paths.push("targetResult.effectsApplied.<type>.duration");
  conditions.forEach(c => paths.push(`targetResult.effectsApplied.${c.value}.duration`));

  paths.push("targetResult.suggestedResolution");

  return paths;
}
