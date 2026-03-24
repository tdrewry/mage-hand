/**
 * Standard merge helper for Zustand persist stores.
 * When application code updates system-managed definitions (like schemas or adapters),
 * this helper ensures runtime code always overrides the cached localStorage versions
 * of those entities, while preserving user-created custom entities.
 * 
 * @param persistedState The state loaded from localStorage
 * @param currentState The initial state defined in the store (containing code seeds)
 * @param seedManifest A mapping of store keys to the specific seed objects that should be enforced
 * @returns The safely merged state object
 */
export function applySystemSeeds<T extends Record<string, any>>(
  persistedState: unknown,
  currentState: T,
  seedManifest: Partial<Record<keyof T, Record<string, any>>>
): T {
  const persisted = (persistedState as Partial<T>) || {};
  const merged = { ...currentState, ...persisted };

  for (const storeKey in seedManifest) {
    const seeds = seedManifest[storeKey];
    if (seeds && merged[storeKey]) {
      // For system seeds, we insert them if they are completely missing.
      // If a modified system schema exists, its properties take precedence.
      const persistedBlock = merged[storeKey] as Record<string, any>;
      merged[storeKey] = { ...persistedBlock } as any;
      for (const [key, seedValue] of Object.entries(seeds)) {
        if (!persistedBlock[key]) {
          (merged[storeKey] as Record<string, any>)[key] = seedValue;
        } else {
          // Deep-merge the properties of the rootSchema to ensure new code-driven fields 
          // are appended, without destroying user-added fields
          const p = persistedBlock[key];
          if (p.rootSchema?.properties && seedValue.rootSchema?.properties) {
            (merged[storeKey] as Record<string, any>)[key] = {
              ...p,
              rootSchema: {
                ...p.rootSchema,
                properties: {
                  ...seedValue.rootSchema.properties,
                  ...p.rootSchema.properties
                }
              }
            };
          }
        }
      }
    }
  }

  return merged;
}
