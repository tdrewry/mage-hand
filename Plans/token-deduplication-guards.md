# Token Deduplication Guards

## Problem
Multiple in-memory instances of the same token were being created in the Jazz CoList, causing erratic movement sync. Deleting one token would reveal hidden duplicates, and deleting those could spawn more via echo loops.

## Root Causes
1. **`pushTokensToJazz`** always appended without checking if `tokenId` already existed in the Jazz CoList
2. **Outbound Zustand→Jazz subscription** pushed new tokens without checking Jazz for existing entries
3. **Inbound Jazz→Zustand subscription** didn't deduplicate when the Jazz CoList itself contained duplicate entries
4. **`sessionStore.addToken`** had no guard against inserting a token with an already-existing ID

## Solution (v0.7.73)

### 1. Upsert-on-push (`pushTokensToJazz`)
- Before creating a new Jazz CoMap entry, checks `_getJazzTokenIds()` for existing entries
- If found, updates the existing entry in-place instead of appending a duplicate

### 2. Outbound subscription dedup
- The Zustand→Jazz "added token" path now checks Jazz for existing entries
- Logs a warning and upserts instead of blindly pushing

### 3. Inbound subscription dedup
- Builds a `Map<tokenId, jt>` from the Jazz CoList (last-write-wins) before processing
- This collapses any duplicate entries into a single authoritative state per token

### 4. Local store guard (`sessionStore.addToken`)
- `addToken` now skips if `state.tokens.some(t => t.id === token.id)` is true
- Prevents local duplication regardless of transport

### 5. Startup cleanup (`_dedupeJazzCoList`)
- On `startBridge()`, scans tokens/regions/mapObjects CoLists for duplicate keys
- Removes earlier occurrences, keeping the last (most recent) entry
- Runs once at session join to heal any pre-existing corruption

## Files Changed
- `src/lib/jazz/bridge.ts` — Upsert logic, inbound dedup, startup cleanup
- `src/stores/sessionStore.ts` — `addToken` guard
- `src/lib/version.ts` — 0.7.73
