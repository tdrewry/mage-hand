import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import type { SchemaNode } from './schemas';

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

/**
 * Generates a flat list of dot-notation paths from a SchemaNode.
 * Nested arrays are represented with an `[i]` index placeholder.
 * Dynamic keys (e.g. '{damageType}') are represented exactly as they are or optionally mapping them.
 */
export function generatePathsFromSchema(node: SchemaNode | undefined, prefix = ''): string[] {
  if (!node) return [];
  const paths: string[] = [];

  if (node.type === 'object' && node.properties) {
    for (const [key, childNode] of Object.entries(node.properties)) {
      const segment = key.startsWith('{') && key.endsWith('}') ? '<key>' : key;
      const newPrefix = prefix ? `${prefix}.${segment}` : segment;
      
      if (childNode.type === 'object') {
        const subPaths = generatePathsFromSchema(childNode, newPrefix);
        if (subPaths.length > 0) {
          paths.push(...subPaths);
        } else {
          paths.push(newPrefix);
        }
      } else if (childNode.type === 'array') {
        const arrayPrefix = `${newPrefix}[i]`;
        if (childNode.items) {
          const subPaths = generatePathsFromSchema(childNode.items, arrayPrefix);
          if (subPaths.length > 0) {
            paths.push(...subPaths);
          } else {
            paths.push(arrayPrefix);
          }
        } else {
          paths.push(arrayPrefix);
        }
      } else {
        paths.push(newPrefix);
      }
    }
  } else if (node.type === 'array') {
    const arrayPrefix = prefix ? `${prefix}[i]` : '[i]';
    if (node.items) {
      const subPaths = generatePathsFromSchema(node.items, arrayPrefix);
      paths.push(...subPaths);
    } else {
      paths.push(arrayPrefix);
    }
  }

  if (paths.length === 0 && prefix) {
    paths.push(prefix);
  }

  return paths;
}
