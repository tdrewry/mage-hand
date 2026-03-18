import { JazzSessionRegistry } from "./schema";
import { Group } from "jazz-tools";

/**
 * Global Session Registry
 * Maps short-codes (e.g., "A3BK7Z") or vanity codes (e.g., "DEV-1") 
 * to Jazz CoValue IDs.
 */

import { useMultiplayerStore } from "@/stores/multiplayerStore";

const DEFAULT_REGISTRY_ID = 'co_zRegistryMageHandV1Alpha';

export async function getRegistry(registryId?: string): Promise<any> {
    const id = registryId || useMultiplayerStore.getState().customRegistryId || DEFAULT_REGISTRY_ID;
    try {
      const loadPromise = (JazzSessionRegistry as any).load(id);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Registry load timeout')), 3000));
      
      const registry = await Promise.race([loadPromise, timeoutPromise]);
      if (registry) return registry;
    } catch (err) {
      console.log(`[registry] Registry ${id} not found or timeout.`);
      throw err;
    }
    return undefined;
}

export async function registerCode(shortCode: string, coValueId: string, registryId?: string): Promise<void> {
  try {
    const registry = await getRegistry(registryId);
    if (registry) {
      registry[shortCode.toUpperCase()] = coValueId;
      console.log(`[registry] Registered ${shortCode} -> ${coValueId} in ${registryId || 'default'}`);
    }
  } catch (err) {
    console.warn("[registry] Short-code registration failed (registry unavailable — use J-Code for local/self-hosted sharing):", err);
  }
}

export async function resolveCode(shortCode: string, registryId?: string): Promise<string | undefined> {
  const upper = shortCode.toUpperCase();
  const id = registryId || useMultiplayerStore.getState().customRegistryId || DEFAULT_REGISTRY_ID;
  try {
    // We attempt to load the registry. If it fails with "No active account", we 
    // retry briefly as the Jazz provider might still be initializing the guest account.
    let registry: any;
    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts) {
      try {
        const registryPromise = (JazzSessionRegistry as any).load(id);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Discovery timeout')), 5000));
        registry = await Promise.race([registryPromise, timeoutPromise]);
        if (registry) break;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (msg.includes("No active account") && attempt < maxAttempts - 1) {
          const delay = 400 * (attempt + 1);
          console.log(`[registry] Waiting for active account — retry ${attempt + 1}/${maxAttempts} in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          attempt++;
          continue;
        }
        throw err;
      }
      attempt++;
    }
    
    if (registry) {
      const val = registry[upper];
      if (val) {
        console.log(`[registry] Resolved ${upper} -> ${val} (via ${id})`);
      } else {
        console.log(`[registry] Code ${upper} not found in registry ${id}.`);
      }
      return val;
    }
  } catch (err) {
    console.warn(`[registry] Could not resolve code ${upper} from ${id}:`, err);
  }
  return undefined;
}

/**
 * Explicitly provision a new registry.
 * This should be triggered by user action to ensure a stable, shared registry exists.
 */
export function provisionRegistry(owner?: any): string {
    const group = owner ? Group.create({ owner }) : Group.create();
    group.addMember("everyone", "writer");
    
    const registry = JazzSessionRegistry.create({}, group);
    const id = (registry as any).$jazz?.id || (registry as any).id;
    console.log("[registry] Provisioned new registry. ID:", id);
    return id;
}
