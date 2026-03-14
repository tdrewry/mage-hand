# Mage-Hand Networking Audit & Deployment Guide

## 1. Networking Audit: Missing Sync Tasks

Following the UX/UI refresh, the core architecture correctly leverages the [durableObjectRegistry.ts](file:///m:/projects/Like%20a%20boss/mage-hand/src/lib/durableObjectRegistry.ts) to transform Zustand stores into Yjs/Jazz-compatible data structures. The UI mega-panels (Compendium, Environment, Play, Campaign), Map Tree, and Initiative Card updates are fundamentally driven by stores that are already covered by this registry (e.g., `cardStore`, `campaignStore`, `mapStore`, `initiativeStore`).

However, the audit of `./networking/server-local`, `src/lib/net/ephemeral/miscHandlers.ts`, and `src/lib/durableObjectRegistry.ts` revealed the following **missing network tasks**:

### Missing Durable Sync Tasks (Jazz Transport)
1. **Handouts (`useHandoutStore`)**
   - **Current State:** The store persists to `localStorage` but is omitted from `durableObjectRegistry.ts`.
   - **Impact:** DMs can craft custom handouts, but because they are not synced durably, players connecting to the session cannot see or read them.
   - **Fix:** Add `handouts` to `durableObjectRegistry.ts` so custom handouts propagate to all clients upon joining.

2. **Ambient Audio / Background Music (`useSoundStore`)**
   - **Current State:** The `activeAmbientLoopId` is kept strictly local. Ephemeral handlers trigger UI sounds (dice rolls, chat whispers), but continuous ambient tracks are not broadcast.
   - **Impact:** If a DM starts a tavern background track, clients do not hear it. It must be durable (rather than ephemeral) so that players who refresh or join late also receive the currently playing track ID.
   - **Fix:** Register `activeAmbientLoopId` and `ambientVolume` within the `durableObjectRegistry`.

*(Note: `useItemStore` was intentionally designed local-only, as items are meant to only "travel with tokens". This is functioning as intended.)*

---

## 2. Deployment Guide: Jazz.tools Cloud Services

Because the architecture already implements `JazzReactProvider` (in `src/lib/jazz/provider.tsx`) and maps state using CoValues, migrating from the local `roomServer.ts` WebSocket relay to Jazz Cloud is exceptionally smooth.

### Step 1: Procure a Jazz Cloud Account
1. Visit `jazz.tools` and sign up for a Developer or Production account.
2. Obtain your **API Key** and **custom Mesh URL** (e.g., `wss://your-project.mesh.jazz.workers.dev`).

### Step 2: Configure the Client Environment
The application currently defaults to `ws://localhost:4200` for `jazz` connections when no URL is provided.
1. Add an environment variable to your frontend build (e.g., `.env.production`):
   ```env
   VITE_JAZZ_SYNC_URL="wss://your-project.mesh.jazz.workers.dev"
   ```
2. Ensure `provider.tsx` consumes this environment variable when falling back from a user-provided URL.

### Step 3: Implement Account & Auth Routing
Jazz uses decentralized authentication (crypto keypairs). Currently, the app utilizes `MageHandAccount`.
1. Ensure players retain their local seed phrases via `localStorage` (which Jazz handles under the hood for anonymous accounts).
2. If moving to persistent user accounts, implement `JazzAuth` (e.g., passkeys, Clerk, or NextAuth integration) to allow players to log in from different devices and retain their characters.

### Step 4: Deprecate `roomServer.ts`
Once the React app is served via any static host (Vercel, Cloudflare Pages, Netlify) and pointed at the Jazz Cloud Mesh, the `./networking/server-local` Node service is completely obsolete and can be decommissioned. All traffic routes through Cloudflare's edge via Jazz.
