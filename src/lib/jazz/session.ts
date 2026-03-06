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

/**
 * Create a new Jazz session and push current Zustand state into it.
 * Returns the session info including the CoValue ID that peers use to join.
 */
export function createJazzSession(name: string): JazzSessionInfo {
  console.log(`[jazz-session] Creating session "${name}"`);

  const root = createSessionRoot(name) as any;
  
  // Push current Zustand state into the new Jazz session
  pushAllToJazz(root);
  
  // Start the bidirectional bridge
  startBridge(root);

  const info: JazzSessionInfo = {
    sessionCoId: root.id ?? `session-${Date.now()}`,
    name,
    isCreator: true,
    root,
  };

  currentSession = info;
  console.log(`[jazz-session] Session created: ${info.sessionCoId}`);
  return info;
}

/**
 * Join an existing Jazz session by its CoValue ID.
 * Loads the session root and pulls state into Zustand stores.
 */
export async function joinJazzSession(sessionCoId: string): Promise<JazzSessionInfo> {
  console.log(`[jazz-session] Joining session "${sessionCoId}"`);

  // Load the session root CoValue by ID
  const root = await (JazzSessionRootSchema as any).load(sessionCoId, {
    resolve: {
      tokens: { $each: true },
      maps: { $each: true },
      blobs: { $each: true },
    },
  });

  if (!root) {
    throw new Error(`Failed to load Jazz session: ${sessionCoId}`);
  }

  // Pull remote state into Zustand
  pullAllFromJazz(root);
  
  // Start the bidirectional bridge
  startBridge(root);

  const info: JazzSessionInfo = {
    sessionCoId: root.id ?? sessionCoId,
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
  console.log(`[jazz-session] Left session "${currentSession.sessionCoId}"`);
  currentSession = null;
}

/**
 * Get the current Jazz session info, if any.
 */
export function getCurrentJazzSession(): JazzSessionInfo | null {
  return currentSession;
}
