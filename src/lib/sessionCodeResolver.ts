/**
 * Unified Session Code Resolver
 *
 * Provides a single session-code abstraction that hides the underlying transport.
 * Players paste one code; the resolver auto-detects whether it targets an OpBridge
 * (WebSocket) session or a Jazz (CRDT) session.
 *
 * Code formats:
 *   OpBridge — 6 uppercase alphanumeric chars, e.g. "A3BK7Z"
 *   Jazz    — "J-" prefix + base62-encoded CoValue ID, e.g. "J-Y29femFiYzEyMw"
 *
 * Jazz codes are fully self-contained: the CoValue ID is encoded directly into
 * the code so any device can decode it without a shared registry.
 */

import type { TransportType } from '@/stores/multiplayerStore';

export interface ResolvedSession {
  transport: TransportType;
  /** For OpBridge: the 6-char session code. For Jazz: the full CoValue ID. */
  connectionId: string;
  /** The raw code the user typed (for display). */
  displayCode: string;
}

import { resolveCode as resolveFromRegistry } from './jazz/registry';

// Removed B64 conversion since it bloats entropy instead of compressing it


// ---------------------------------------------------------------------------
// Jazz code encode / decode
// ---------------------------------------------------------------------------

const JAZZ_PREFIX = 'J-';

/**
 * Encode a Jazz CoValue ID into a portable short code.
 * The full ID is embedded in the code so any device can decode it.
 * We strip 'co_z' or 'co_' to save visual space.
 *
 * Example: "co_z1abc123" → "J-z1abc123"
 */
export function encodeJazzCode(coValueId: string): string {
  if (coValueId.startsWith('co_z')) {
    return coValueId.replace('co_z', JAZZ_PREFIX);
  }
  if (coValueId.startsWith('co_')) {
    return coValueId.replace('co_', JAZZ_PREFIX);
  }
  return `${JAZZ_PREFIX}${coValueId}`;
}

/**
 * Decode a Jazz short code back to the original CoValue ID.
 * Returns undefined if decoding fails.
 */
export function decodeJazzCode(code: string): string | undefined {
  if (!code.startsWith(JAZZ_PREFIX)) return undefined;
  
  const payload = code.slice(JAZZ_PREFIX.length);
  if (!payload) return undefined;

  // Most sessions are groups (co_z). If the original ID was just 'co_', it might be malformed, 
  // but we default to 'co_z' because 99% of our shared sessions are Groups. We can also try standard 'co_'
  // Let's assume groups (co_z) unless otherwise handled.
  return `co_z${payload}`;
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/** Returns true if the code looks like a Jazz session code. */
export function isJazzCode(code: string): boolean {
  return code.startsWith(JAZZ_PREFIX) && code.length >= 4;
}

/** Returns true if the code looks like an OpBridge session code. */
export function isOpBridgeCode(code: string): boolean {
  return /^[A-Z0-9]{4,8}$/.test(code);
}

/** Returns true if the code looks like a vanity code (e.g. DEV-1). */
export function isVanityCode(code: string): boolean {
  return /^[a-zA-Z0-9-]{3,32}$/.test(code) && !isJazzCode(code);
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a user-entered session code into a transport + connection ID.
 * Supports legacy Jazz codes (J-), OpBridge codes (registry only!), and Vanity/ShortCodes via Registry.
 * Returns a Promise since Registry lookup is async.
 */
export async function resolveSessionCode(rawCode: string): Promise<ResolvedSession> {
  const code = rawCode.trim();

  // 1. Direct Jazz Code (Legacy/Deep Link)
  if (isJazzCode(code)) {
    const coValueId = decodeJazzCode(code);
    if (!coValueId) {
      throw new Error('Invalid Jazz session code — could not decode CoValue ID');
    }
    return {
      transport: 'jazz',
      connectionId: coValueId,
      displayCode: code,
    };
  }

  // 1.5 Local Dev Sandbox Escape Hatch
  if (code.toUpperCase() === 'DEV_LOCAL') {
    return {
      transport: 'jazz',
      connectionId: 'co_zLocalDevSession0000000000000000',
      displayCode: 'DEV_LOCAL',
    };
  }

  // 2. Registry Lookup (Vanity / ShortCodes)
  // We prioritize Jazz-backed registry lookups for unqualified codes
  const resolvedCoId = await resolveFromRegistry(code);
  if (resolvedCoId) {
    return {
      transport: 'jazz',
      connectionId: resolvedCoId,
      displayCode: code,
    };
  }

  // 3. Failure
  throw new Error(`Session code "${code}" could not be resolved in the Jazz registry.`);
}

// ---------------------------------------------------------------------------
// OpBridge code generation
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
