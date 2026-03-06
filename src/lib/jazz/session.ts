/**
 * Jazz Session Management
 *
 * Handles creation and joining of Jazz-backed sessions.
 * A "session" maps to a JazzSessionRoot CoValue that holds all durable state.
 *
 * Phase 1: Structural scaffolding — actual CoValue creation requires the Jazz
 * auth context which is wired in Phase 2.
 */

import type { JazzSessionRoot } from "./schema";
import { pushAllToJazz, pullAllFromJazz, startBridge, stopBridge } from "./bridge";

export interface JazzSessionInfo {
  /** The CoValue ID of the session root */
  sessionCoId: string;
  /** Human-readable session name */
  name: string;
  /** Whether this client created the session (vs. joined) */
  isCreator: boolean;
}

let currentSession: JazzSessionInfo | null = null;

/**
 * Create a new Jazz session and push current Zustand state into it.
 *
 * Phase 1: Returns a placeholder — actual CoValue creation comes in Phase 2
 * once the JazzProvider auth flow is integrated.
 */
export async function createJazzSession(name: string): Promise<JazzSessionInfo> {
  console.log(`[jazz-session] Creating session "${name}" (Phase 1 — stub)`);

  // Phase 2 will:
  // 1. Create a JazzSessionRoot CoValue via the Jazz account
  // 2. Create child CoValues (JazzTokenList, JazzMapList, JazzDOBlobList)
  // 3. Call pushAllToJazz(sessionRoot)
  // 4. Call startBridge(sessionRoot)

  const info: JazzSessionInfo = {
    sessionCoId: `placeholder-${Date.now()}`,
    name,
    isCreator: true,
  };

  currentSession = info;
  return info;
}

/**
 * Join an existing Jazz session by its CoValue ID.
 *
 * Phase 1: Returns a placeholder — actual CoValue loading comes in Phase 2.
 */
export async function joinJazzSession(sessionCoId: string): Promise<JazzSessionInfo> {
  console.log(`[jazz-session] Joining session "${sessionCoId}" (Phase 1 — stub)`);

  // Phase 2 will:
  // 1. Load the JazzSessionRoot CoValue by ID
  // 2. Call pullAllFromJazz(sessionRoot)
  // 3. Call startBridge(sessionRoot)

  const info: JazzSessionInfo = {
    sessionCoId,
    name: "Joined Session",
    isCreator: false,
  };

  currentSession = info;
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
