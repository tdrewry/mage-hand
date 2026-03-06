# Unified Session Code System

## Status: Implemented (v0.7.12)

## Problem
Players needed to understand whether the host used WebSocket or Jazz to join.
Jazz sessions used long CoValue IDs while WebSocket used short codes.
This forced transport awareness onto non-technical players.

## Solution — Prefixed codes with auto-detection
- **OpBridge codes:** 6-char uppercase alphanumeric (e.g. `A3BK7Z`)
- **Jazz codes:** `J-` prefix + 8 base62 chars (e.g. `J-a8F2c9Xk`)
- A `resolveSessionCode(code)` utility auto-detects the transport from the code format
- The Join UI has **one input field** — no transport selector needed
- The host's "copy code" always emits the correct format

## Code mapping
Jazz CoValue IDs are long, so we generate short codes and store the mapping in
`localStorage` under key `mh-jazz-codes`. Cross-device join falls back to treating
the code as the raw CoValue ID if the mapping isn't found locally.

## Files
- `src/lib/sessionCodeResolver.ts` — resolver, encoder, decoder, code generation
- `src/components/SessionManager.tsx` — unified join flow with auto-detect
- `Plans/unified-session-codes.md` — this file
