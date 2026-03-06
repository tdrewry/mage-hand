/**
 * Jazz Session Management
 *
 * Handles creation and joining of Jazz-backed sessions.
 * A "session" maps to a JazzSessionRoot CoValue that holds all durable state.
 *
 * IMPORTANT: This is a standalone transport module — it does NOT interact
 * with OpBridge or NetManager. Both can coexist.
 */

import { JazzSessionRoot as JazzSessionRootSchema, createSessionRoot } from "./schema";
import { pushAllToJazz, pullAllFromJazz, startBridge, stopBridge } from "./bridge";
import { useMultiplayerStore } from "@/stores/multiplayerStore";

export interface JazzSessionInfo {
  /** The CoValue ID of the session root */
  sessionCoId: string;
  /** Human-readable session name */
  name: string;
  /** Whether this client created the session (vs. joined) */
  isCreator: boolean;
  /** Reference to the live session root CoValue */
  root: any;
}

let currentSession: JazzSessionInfo | null = null;

/** Extract CoValue ID from a Jazz object — tries multiple accessors for compat */
function getCoValueId(coValue: any): string | undefined {
  // jazz-tools 0.18+: $jazz.id
  if (coValue?.$jazz?.id) return coValue.$jazz.id;
  // Older versions or raw access
  if (coValue?.id && typeof coValue.id === 'string' && coValue.id.startsWith('co_')) return coValue.id;
  if (coValue?._raw?.id) return coValue._raw.id;
  return undefined;
}

/** Extract the owner/group from a Jazz CoValue */
export function getCoValueGroup(coValue: any): any {
  return coValue?.$jazz?.owner ?? coValue?._owner ?? coValue?.$jazz?.group ?? undefined;
}

/**
 * Create a new Jazz session and push current Zustand state into it.
 * Returns the session info including the CoValue ID that peers use to join.
 */
export function createJazzSession(name: string): JazzSessionInfo {
  console.log(`[jazz-session] Creating session "${name}"`);

  const root = createSessionRoot(name) as any;
  
  // Extract the real CoValue ID
  const coId = getCoValueId(root);
  const group = getCoValueGroup(root);
  
  console.log("[jazz-session] Root created:", {
    coId,
    hasGroup: !!group,
    $jazzKeys: root.$jazz ? Object.keys(root.$jazz) : "no $jazz",
    rootKeys: Object.keys(root).filter((k: string) => !k.startsWith("_")),
    hasTokens: !!root.tokens,
    hasBlobs: !!root.blobs,
  });

  if (!coId) {
    console.error("[jazz-session] CRITICAL: Could not extract CoValue ID from session root!", {
      rootType: typeof root,
      rootConstructor: root?.constructor?.name,
      protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(root) ?? {}),
    });
  }

  // Push current Zustand state into the new Jazz session
  pushAllToJazz(root);
  
  // Start the bidirectional bridge
  startBridge(root);

  // Host is always sync-ready (they own the data)
  useMultiplayerStore.getState().setSyncReady(true);

  const sessionCoId = coId ?? `session-${Date.now()}`;
  
  const info: JazzSessionInfo = {
    sessionCoId,
    name,
    isCreator: true,
    root,
  };

  currentSession = info;
  console.log(`[jazz-session] Session created: ${info.sessionCoId} (isRealCoId: ${!!coId})`);
  return info;
}

/**
 * Join an existing Jazz session by its CoValue ID.
 * Loads the session root and pulls state into Zustand stores.
 */
export async function joinJazzSession(sessionCoId: string): Promise<JazzSessionInfo> {
  console.log(`[jazz-session] Joining session "${sessionCoId}"`);

  // Validate that this looks like a real CoValue ID
  if (!sessionCoId.startsWith('co_')) {
    console.warn(`[jazz-session] Session ID "${sessionCoId}" does not look like a CoValue ID (expected co_...). Load will likely fail.`);
  }

  // Load the session root CoValue by ID
  let root: any;
  try {
    root = await (JazzSessionRootSchema as any).load(sessionCoId, {
      resolve: {
        tokens: { $each: true },
        maps: { $each: true },
        blobs: { $each: true },
      },
    });
  } catch (err) {
    console.error("[jazz-session] Failed to load session root:", err);
    throw new Error(`Failed to load Jazz session: ${sessionCoId} — ${err}`);
  }

  if (!root) {
    throw new Error(`Failed to load Jazz session: ${sessionCoId} — root is null/undefined`);
  }

  // ── Diagnostics: inspect what we got ──
  const loadedId = getCoValueId(root);
  console.log("[jazz-session] Session root loaded:", {
    id: loadedId ?? sessionCoId,
    sessionName: root.sessionName,
    hasTokens: !!root.tokens,
    tokensLength: root.tokens?.length ?? "N/A",
    hasMaps: !!root.maps,
    mapsLength: root.maps?.length ?? "N/A",
    hasBlobs: !!root.blobs,
    blobsLength: root.blobs?.length ?? "N/A",
    rootKeys: Object.keys(root).filter((k: string) => !k.startsWith("_")),
    $jazzKeys: root.$jazz ? Object.keys(root.$jazz) : "no $jazz",
  });

  // Log blob details
  if (root.blobs) {
    const blobLen = root.blobs.length ?? 0;
    for (let i = 0; i < blobLen; i++) {
      const b = root.blobs[i];
      console.log(`[jazz-session] Blob[${i}]:`, {
        kind: b?.kind,
        version: b?.version,
        stateLength: b?.state?.length ?? "N/A",
        updatedAt: b?.updatedAt,
      });
    }
  }

  // Pull remote state into Zustand
  useMultiplayerStore.getState().setSyncReady(false);
  pullAllFromJazz(root);
  
  // Start the bidirectional bridge
  startBridge(root);

  // Mark sync as ready — initial pull is complete
  useMultiplayerStore.getState().setSyncReady(true);
  console.log('[jazz-session] Sync ready — all durable state pulled');

  const info: JazzSessionInfo = {
    sessionCoId: loadedId ?? sessionCoId,
    name: root.sessionName || "Joined Session",
    isCreator: false,
    root,
  };

  currentSession = info;
  console.log(`[jazz-session] Joined session: ${info.sessionCoId}`);
  return info;
}

/**
 * Leave the current Jazz session and tear down the bridge.
 */
export function leaveJazzSession(): void {
  if (!currentSession) return;
  stopBridge();
  useMultiplayerStore.getState().setSyncReady(false);
  console.log(`[jazz-session] Left session "${currentSession.sessionCoId}"`);
  currentSession = null;
}

/**
 * Get the current Jazz session info, if any.
 */
export function getCurrentJazzSession(): JazzSessionInfo | null {
  return currentSession;
}
