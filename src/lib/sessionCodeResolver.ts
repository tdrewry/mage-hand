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
// Base62 encoding of CoValue IDs
// ---------------------------------------------------------------------------
// We use a URL-safe base64 variant (no padding) since true base62 for arbitrary
// binary is complex and CoValue IDs are short ASCII strings.  The result is
// compact, case-sensitive, and fully portable across devices.

/**
 * Encode an arbitrary ASCII string (CoValue ID) into a URL-safe base64 string
 * (no padding, no +/ — uses -_ instead).
 */
function encodeB64(str: string): string {
  // btoa works on ASCII strings directly
  const b64 = btoa(str);
  // Make URL-safe: replace + → -, / → _, strip =
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a URL-safe base64 string back to the original ASCII string.
 */
function decodeB64(encoded: string): string {
  // Restore standard base64
  let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  // Re-pad
  while (b64.length % 4 !== 0) b64 += '=';
  return atob(b64);
}

// ---------------------------------------------------------------------------
// Jazz code encode / decode
// ---------------------------------------------------------------------------

const JAZZ_PREFIX = 'J-';

/**
 * Encode a Jazz CoValue ID into a portable short code.
 * The full ID is embedded in the code so any device can decode it.
 *
 * Example: "co_z1abc123" → "J-Y29fejFhYmMxMjM"
 */
export function encodeJazzCode(coValueId: string): string {
  return `${JAZZ_PREFIX}${encodeB64(coValueId)}`;
}

/**
 * Decode a Jazz short code back to the original CoValue ID.
 * Returns undefined if decoding fails.
 */
export function decodeJazzCode(code: string): string | undefined {
  if (!code.startsWith(JAZZ_PREFIX)) return undefined;
  const payload = code.slice(JAZZ_PREFIX.length);
  if (!payload) return undefined;
  try {
    return decodeB64(payload);
  } catch {
    return undefined;
  }
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

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a user-entered session code into a transport + connection ID.
 * Throws if the code format is unrecognised.
 */
export function resolveSessionCode(rawCode: string): ResolvedSession {
  const code = rawCode.trim();

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
