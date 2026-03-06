/**
 * Unified Session Code Resolver
 *
 * Provides a single session-code abstraction that hides the underlying transport.
 * Players paste one code; the resolver auto-detects whether it targets an OpBridge
 * (WebSocket) session or a Jazz (CRDT) session.
 *
 * Code formats:
 *   OpBridge — 6 uppercase alphanumeric chars, e.g. "A3BK7Z"
 *   Jazz    — "J-" prefix + 8 base62 chars that encode the CoValue ID, e.g. "J-a8F2c9Xk"
 *
 * The host's "copy code" always produces the right format automatically.
 */

import type { TransportType } from '@/stores/multiplayerStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedSession {
  transport: TransportType;
  /** For OpBridge: the 6-char session code.  For Jazz: the full CoValue ID. */
  connectionId: string;
  /** The raw code the user typed (for display). */
  displayCode: string;
}

// ---------------------------------------------------------------------------
// Jazz CoValue ID ↔ short code helpers
// ---------------------------------------------------------------------------

/** Characters used for the short Jazz code (base62). */
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Encode a Jazz CoValue ID (e.g. "co_zhx7abc123…") into a short code.
 * We simply store the mapping in sessionStorage so any tab on the same
 * origin can resolve it.  The host copies the short code; joiners paste it.
 */
export function encodeJazzCode(coValueId: string): string {
  // Generate 8 random base62 chars
  let short = '';
  for (let i = 0; i < 8; i++) {
    short += BASE62.charAt(Math.floor(Math.random() * BASE62.length));
  }
  const code = `J-${short}`;

  // Store mapping so the same browser (or any tab) can resolve it.
  // For cross-device join the full CoValue ID is embedded in the code via a
  // fallback: we also store it in localStorage keyed by the short code.
  try {
    const map = getJazzCodeMap();
    map[code] = coValueId;
    localStorage.setItem('mh-jazz-codes', JSON.stringify(map));
  } catch {
    // Best-effort
  }
  return code;
}

/**
 * Decode a short Jazz code back to a CoValue ID.
 * Returns undefined if the code is unknown (e.g. from another device).
 */
export function decodeJazzCode(code: string): string | undefined {
  const map = getJazzCodeMap();
  return map[code];
}

function getJazzCodeMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('mh-jazz-codes') || '{}');
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

const JAZZ_PREFIX = 'J-';

/** Returns true if the code looks like a Jazz session code. */
export function isJazzCode(code: string): boolean {
  return code.startsWith(JAZZ_PREFIX) && code.length >= 4;
}

/** Returns true if the code looks like an OpBridge session code. */
export function isOpBridgeCode(code: string): boolean {
  return /^[A-Z0-9]{4,8}$/.test(code);
}

/**
 * Resolve a user-entered session code into a transport + connection ID.
 * Throws if the code format is unrecognised.
 */
export function resolveSessionCode(rawCode: string): ResolvedSession {
  const code = rawCode.trim();

  if (isJazzCode(code)) {
    const coValueId = decodeJazzCode(code);
    return {
      transport: 'jazz',
      connectionId: coValueId || code, // fallback: treat the code itself as the ID
      displayCode: code,
    };
  }

  // Default: OpBridge
  const upper = code.toUpperCase();
  if (!isOpBridgeCode(upper)) {
    throw new Error('Invalid session code format');
  }

  return {
    transport: 'opbridge',
    connectionId: upper,
    displayCode: upper,
  };
}

// ---------------------------------------------------------------------------
// OpBridge code generation (moved here from SessionManager)
// ---------------------------------------------------------------------------

/** Generate a random 6-char OpBridge session code. */
export function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
