# Network Demo UI Plan

## Goal
Add a UI panel to exercise `src/lib/net/demo.ts` functions (sendPing, sendChat, sendTokenMove) and a new `token.sync` op that creates/updates tokens on remote clients.

## Changes Made
1. **`src/lib/net/demo.ts`** — Added `sendSyncTokens()` (broadcasts all local tokens) and `createAndSyncDemoToken()` (creates a random token locally then syncs).
2. **`src/lib/net/OpBridge.ts`** — Registered `token.sync` handler that creates or updates tokens from remote data.
3. **`src/components/cards/NetworkDemoCard.tsx`** — New card UI with Ping, Chat, Token Move, and Token Sync sections.
4. **`src/types/cardTypes.ts`** — Added `NETWORK_DEMO` enum value.
5. **`src/stores/cardStore.ts`** — Added default config for `NETWORK_DEMO` card.
6. **`src/components/CardManager.tsx`** — Added import and switch case for `NetworkDemoCardContent`.
7. **`src/components/cards/MenuCard.tsx`** — Added "Network Demo" button in Multiplayer section.
