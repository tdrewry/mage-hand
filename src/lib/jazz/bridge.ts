/**
 * Jazz ↔ Zustand Bridge
 *
 * Bidirectional sync between Jazz CoValues and the existing Zustand stores.
 *
 * Two sync strategies:
 *   1. Fine-grained: Tokens use per-field CoValue sync for low-latency movement
 *   2. Blob sync: All other DO kinds use JazzDOBlob (JSON serialized state)
 *      via the DurableObjectRegistry extractors/hydrators
 *
 * Echo prevention: a `_fromJazz` flag is set during hydration so that
 * store subscriptions don't re-push the same change back to Jazz.
 *
 * IMPORTANT: This module does NOT import from src/lib/net/ — it's a standalone
 * transport that feeds into the same Zustand stores.
 */

import { useSessionStore, type Token } from "@/stores/sessionStore";
import { JazzToken as JazzTokenSchema, JazzDOBlob as JazzDOBlobSchema } from "./schema";
import { DurableObjectRegistry } from "@/lib/durableObjects";
import "@/lib/durableObjectRegistry"; // Side-effect: registers all DO kinds
import { useMapStore } from "@/stores/mapStore";
import { useRegionStore } from "@/stores/regionStore";
import { useGroupStore } from "@/stores/groupStore";
import { useInitiativeStore } from "@/stores/initiativeStore";
import { useRoleStore } from "@/stores/roleStore";
import { useVisionProfileStore } from "@/stores/visionProfileStore";
import { useFogStore } from "@/stores/fogStore";
import { useLightStore } from "@/stores/lightStore";
import { useIlluminationStore } from "@/stores/illuminationStore";
import { useDungeonStore } from "@/stores/dungeonStore";
import { useMapObjectStore } from "@/stores/mapObjectStore";
import { useCreatureStore } from "@/stores/creatureStore";
import { useHatchingStore } from "@/stores/hatchingStore";
import { useEffectStore } from "@/stores/effectStore";
import { useActionStore } from "@/stores/actionStore";
import { useDiceStore } from "@/stores/diceStore";

// ── Echo prevention ────────────────────────────────────────────────────────

let _fromJazz = false;

/** Returns true when the current store mutation originated from Jazz (inbound sync). */
export function isFromJazz(): boolean {
  return _fromJazz;
}

/**
 * Run a callback with the _fromJazz flag set.
 * Use this when hydrating stores from Jazz CoValue changes.
 */
export function runFromJazz(fn: () => void): void {
  const prev = _fromJazz;
  _fromJazz = true;
  try {
    fn();
  } finally {
    _fromJazz = prev;
  }
}

// ── Bridge lifecycle ───────────────────────────────────────────────────────

type Unsubscribe = () => void;

/** Active store subscriptions for the current session */
const activeSubscriptions: Unsubscribe[] = [];

/** The current Jazz session root being bridged (typed as any to avoid MaybeLoaded issues) */
let _sessionRoot: any = null;

/** Cached child CoValue references — Jazz proxies can go stale when accessed later */
let _cachedTokens: any = null;
let _cachedBlobs: any = null;
let _cachedGroup: any = null;

/**
 * Get the currently bridged session root (if any).
 * Returns a wrapper that uses cached child refs to avoid stale proxy issues.
 */
export function getBridgedSessionRoot(): any {
  if (!_sessionRoot) return null;
  // Return a facade that uses cached refs
  return {
    ...(_sessionRoot),
    tokens: _cachedTokens ?? _sessionRoot.tokens,
    blobs: _cachedBlobs ?? _sessionRoot.blobs,
    _owner: _cachedGroup ?? _sessionRoot._owner,
    get $jazz() { return _sessionRoot.$jazz; },
  };
}

// ── DO kinds to sync via blob (excludes tokens — fine-grained, and UI-only kinds) ──

const BLOB_SYNC_KINDS = [
  'maps', 'regions', 'groups', 'initiative', 'roles', 'visionProfiles',
  'fog', 'lights', 'illumination', 'dungeon', 'mapObjects', 'creatures',
  'hatching', 'effects', 'actions', 'dice',
];

// Kinds excluded from blob sync:
// - 'tokens': fine-grained CoValue sync
// - 'cards': UI layout, per-user
// - 'viewportTransforms': per-user viewport

// ── Token bridge helpers ───────────────────────────────────────────────────

/** Convert a Zustand Token to a JazzToken-compatible init object */
function tokenToJazzInit(t: Token): Record<string, any> {
  const extras: Record<string, unknown> = {};
  if (t.imageHash) extras.imageHash = t.imageHash;
  if (t.roleId) extras.roleId = t.roleId;
  if (t.isHidden) extras.isHidden = t.isHidden;
  if (t.labelPosition) extras.labelPosition = t.labelPosition;
  if (t.labelColor) extras.labelColor = t.labelColor;
  if (t.labelBackgroundColor) extras.labelBackgroundColor = t.labelBackgroundColor;
  if (t.notes) extras.notes = t.notes;
  if (t.initiative != null) extras.initiative = t.initiative;
  if (t.inCombat) extras.inCombat = t.inCombat;
  if (t.pathStyle) extras.pathStyle = t.pathStyle;

  return {
    tokenId: t.id,
    x: t.x,
    y: t.y,
    color: t.color || "#666",
    label: t.label || "",
    name: t.name || "",
    gridWidth: t.gridWidth,
    gridHeight: t.gridHeight,
    hp: (t as any).hp,
    maxHp: (t as any).maxHp,
    ac: (t as any).ac,
    hostility: (t as any).hostility,
    mapId: t.mapId,
    extras: Object.keys(extras).length > 0 ? JSON.stringify(extras) : undefined,
  };
}

/** Convert a JazzToken CoValue (as any) to a Zustand Token */
function jazzToZustandToken(jt: any): Token {
  let extras: Record<string, any> = {};
  try {
    if (jt.extras) extras = JSON.parse(jt.extras);
  } catch { /* invalid JSON */ }

  return {
    id: jt.tokenId,
    name: jt.name || "",
    imageUrl: "",
    imageHash: extras.imageHash,
    x: jt.x,
    y: jt.y,
    gridWidth: jt.gridWidth,
    gridHeight: jt.gridHeight,
    label: jt.label || "",
    labelPosition: extras.labelPosition || "below",
    labelColor: extras.labelColor,
    labelBackgroundColor: extras.labelBackgroundColor,
    roleId: extras.roleId || "",
    isHidden: extras.isHidden || false,
    color: jt.color,
    mapId: jt.mapId,
    initiative: extras.initiative,
    inCombat: extras.inCombat,
    pathStyle: extras.pathStyle,
    notes: extras.notes,
  };
}

// ── Blob sync helpers ──────────────────────────────────────────────────────

/** Throttle state: last push hash per kind to avoid redundant writes */
const _lastPushedHash = new Map<string, string>();

/** Simple hash for change detection */
function quickHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

/** Find blob index in session root by kind */
function findBlobIndex(kind: string): number {
  const blobs = _cachedBlobs ?? _sessionRoot?.blobs;
  if (!blobs) return -1;
  const len = blobs.length ?? 0;
  for (let i = 0; i < len; i++) {
    const b = blobs[i];
    if (b && b.kind === kind) return i;
  }
  return -1;
}

/** Push a single DO kind's state to Jazz as a blob */
function pushBlobToJazz(kind: string): void {
  const blobs = _cachedBlobs ?? _sessionRoot?.blobs;
  if (!blobs) return;
  const reg = DurableObjectRegistry.get(kind);
  if (!reg) return;

  try {
    const state = reg.extractor();
    const json = JSON.stringify(state);
    const hash = quickHash(json);

    // Skip if unchanged
    if (_lastPushedHash.get(kind) === hash) return;
    _lastPushedHash.set(kind, hash);

    const group = _sessionRoot._owner ?? _sessionRoot.$jazz?.group;
    const idx = findBlobIndex(kind);

    if (idx >= 0) {
      // Update existing blob
      const blob = _sessionRoot.blobs[idx];
      try {
        blob.$jazz.set("state", json);
        blob.$jazz.set("version", reg.version);
        blob.$jazz.set("updatedAt", new Date().toISOString());
      } catch (err) {
        console.error(`[jazz-bridge] Failed to update blob ${kind}:`, err);
      }
    } else {
      // Create new blob
      try {
        const blob = JazzDOBlobSchema.create({
          kind,
          version: reg.version,
          state: json,
          updatedAt: new Date().toISOString(),
        } as any, group);
        _sessionRoot.blobs.$jazz.push(blob);
      } catch (err) {
        console.error(`[jazz-bridge] Failed to create blob ${kind}:`, err);
      }
    }

    console.log(`[jazz-bridge] → Jazz blob: ${kind}`);
  } catch (err) {
    console.error(`[jazz-bridge] Blob push error for ${kind}:`, err);
  }
}

/** Pull a single blob from Jazz into Zustand via the DO hydrator */
function pullBlobFromJazz(kind: string, stateJson: string): void {
  const reg = DurableObjectRegistry.get(kind);
  if (!reg) {
    console.warn(`[jazz-bridge] Unknown DO kind in blob: ${kind}`);
    return;
  }

  try {
    const state = JSON.parse(stateJson);
    const hash = quickHash(stateJson);
    _lastPushedHash.set(kind, hash); // prevent echo

    runFromJazz(() => {
      reg.hydrator(state);
    });
    console.log(`[jazz-bridge] ← Jazz blob: ${kind}`);
  } catch (err) {
    console.error(`[jazz-bridge] Blob pull error for ${kind}:`, err);
  }
}

// ── Push: Zustand → Jazz ───────────────────────────────────────────────────

/**
 * Push all current tokens from Zustand into the Jazz session root.
 */
export function pushTokensToJazz(sessionRoot: any): void {
  const tokens = useSessionStore.getState().tokens;
  const jazzTokens = sessionRoot.tokens;
  if (!jazzTokens) {
    console.warn("[jazz-bridge] No tokens list on session root");
    return;
  }

  console.log(`[jazz-bridge] Pushing ${tokens.length} tokens to Jazz`);

  const group = sessionRoot._owner ?? sessionRoot.$jazz?.group;
  console.log("[jazz-bridge] Token push group:", group ? "found" : "MISSING", typeof group);

  for (const t of tokens) {
    const init = tokenToJazzInit(t);
    try {
      const jt = JazzTokenSchema.create(init as any, group);
      jazzTokens.$jazz.push(jt);
      console.log(`[jazz-bridge] → Jazz token: ${t.id} (${t.name})`);
    } catch (err) {
      console.error(`[jazz-bridge] Failed to create/push JazzToken ${t.id}:`, err);
    }
  }
}

/**
 * Push all DO blob states to Jazz.
 */
export function pushBlobsToJazz(sessionRoot: any): void {
  const group = sessionRoot._owner ?? sessionRoot.$jazz?.group;
  console.log("[jazz-bridge] Blob push group:", group ? "found" : "MISSING", typeof group);

  if (!sessionRoot.blobs) {
    console.warn("[jazz-bridge] No blobs list on session root");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const kind of BLOB_SYNC_KINDS) {
    const reg = DurableObjectRegistry.get(kind);
    if (!reg) {
      console.warn(`[jazz-bridge] No registry entry for DO kind: ${kind}`);
      failCount++;
      continue;
    }

    try {
      const state = reg.extractor();
      const json = JSON.stringify(state);
      _lastPushedHash.set(kind, quickHash(json));

      const blob = JazzDOBlobSchema.create({
        kind,
        version: reg.version,
        state: json,
        updatedAt: new Date().toISOString(),
      } as any, group);
      sessionRoot.blobs.$jazz.push(blob);
      successCount++;
      console.log(`[jazz-bridge] → Jazz blob: ${kind} (${json.length} chars)`);
    } catch (err) {
      failCount++;
      console.error(`[jazz-bridge] Failed to push blob ${kind}:`, err);
    }
  }

  console.log(`[jazz-bridge] Pushed ${successCount}/${BLOB_SYNC_KINDS.length} DO blobs (${failCount} failed)`);
}

/**
 * Push all current Zustand state into Jazz CoValues.
 */
export function pushAllToJazz(sessionRoot: any): void {
  pushTokensToJazz(sessionRoot);
  pushBlobsToJazz(sessionRoot);
}

// ── Pull: Jazz → Zustand ──────────────────────────────────────────────────

/**
 * Pull all tokens from Jazz into Zustand.
 */
export function pullTokensFromJazz(sessionRoot: any): void {
  const jazzTokens = sessionRoot.tokens;
  if (!jazzTokens) {
    console.warn("[jazz-bridge] No tokens list on session root");
    return;
  }

  const len = jazzTokens.length ?? 0;
  console.log(`[jazz-bridge] Pulling ${len} tokens from Jazz`);

  runFromJazz(() => {
    const store = useSessionStore.getState();
    store.tokens.forEach((t) => store.removeToken(t.id));
    for (let i = 0; i < len; i++) {
      const jt = jazzTokens[i];
      if (jt) {
        store.addToken(jazzToZustandToken(jt));
      }
    }
  });
}

/**
 * Pull all DO blobs from Jazz into Zustand.
 */
export function pullBlobsFromJazz(sessionRoot: any): void {
  if (!sessionRoot.blobs) {
    console.warn("[jazz-bridge] No blobs list on session root");
    return;
  }

  const len = sessionRoot.blobs.length ?? 0;
  console.log(`[jazz-bridge] Pulling ${len} DO blobs from Jazz`);

  for (let i = 0; i < len; i++) {
    const blob = sessionRoot.blobs[i];
    if (!blob || !blob.kind || !blob.state) continue;
    pullBlobFromJazz(blob.kind, blob.state);
  }
}

/**
 * Pull all Jazz CoValue state into Zustand stores.
 */
export function pullAllFromJazz(sessionRoot: any): void {
  pullTokensFromJazz(sessionRoot);
  pullBlobsFromJazz(sessionRoot);
}

// ── Blob store subscriptions ──────────────────────────────────────────────

/** Map of DO kind → the Zustand store to subscribe to */
const STORE_FOR_KIND: Record<string, () => any> = {
  maps: () => useMapStore,
  regions: () => useRegionStore,
  groups: () => useGroupStore,
  initiative: () => useInitiativeStore,
  roles: () => useRoleStore,
  visionProfiles: () => useVisionProfileStore,
  fog: () => useFogStore,
  lights: () => useLightStore,
  illumination: () => useIlluminationStore,
  dungeon: () => useDungeonStore,
  mapObjects: () => useMapObjectStore,
  creatures: () => useCreatureStore,
  hatching: () => useHatchingStore,
  effects: () => useEffectStore,
  actions: () => useActionStore,
  dice: () => useDiceStore,
};

/** Throttle timers per kind */
const _throttleTimers = new Map<string, number>();
const BLOB_THROTTLE_MS = 1000; // 1Hz max per kind

function throttledPushBlob(kind: string): void {
  if (_throttleTimers.has(kind)) return; // already scheduled
  _throttleTimers.set(kind, window.setTimeout(() => {
    _throttleTimers.delete(kind);
    pushBlobToJazz(kind);
  }, BLOB_THROTTLE_MS));
}

// ── Live bridge: subscribe to both directions ─────────────────────────────

/**
 * Start the bidirectional bridge for tokens + all DO blob kinds.
 */
export function startBridge(sessionRoot: any): void {
  _sessionRoot = sessionRoot;
  // Cache child refs immediately while the proxy is still live
  _cachedTokens = sessionRoot.tokens ?? null;
  _cachedBlobs = sessionRoot.blobs ?? null;
  _cachedGroup = sessionRoot._owner ?? sessionRoot.$jazz?.group ?? null;
  console.log("[jazz-bridge] Starting bridge, cached refs:", {
    tokens: !!_cachedTokens,
    blobs: !!_cachedBlobs,
    group: !!_cachedGroup,
  });

  // ── Token sync: Direction 1 (Zustand → Jazz) ──
  let prevTokens = useSessionStore.getState().tokens;
  const unsubZustand = useSessionStore.subscribe((state) => {
    const tokens = state.tokens;
    if (tokens === prevTokens) return;
    if (_fromJazz) { prevTokens = tokens; return; }
    if (!_sessionRoot?.tokens) { prevTokens = tokens; return; }

    const jazzTokens = _sessionRoot.tokens;
    const group = _sessionRoot._owner ?? _sessionRoot.$jazz?.group;

      // Detect added tokens
      const prevIds = new Set(prevTokens.map((t: Token) => t.id));
      for (const t of tokens) {
        if (!prevIds.has(t.id)) {
          const init = tokenToJazzInit(t);
          try {
            const jt = JazzTokenSchema.create(init as any, group);
            jazzTokens.$jazz.push(jt);
            console.log(`[jazz-bridge] → Jazz: added token ${t.id}`);
          } catch (err) {
            console.error(`[jazz-bridge] Failed to create JazzToken:`, err);
          }
        }
      }

      // Detect moved/updated tokens
      for (const t of tokens) {
        if (prevIds.has(t.id)) {
          const prev = prevTokens.find((pt: Token) => pt.id === t.id);
          if (!prev) continue;
          if (prev.x !== t.x || prev.y !== t.y || prev.label !== t.label || prev.color !== t.color) {
            const len = jazzTokens.length ?? 0;
            for (let i = 0; i < len; i++) {
              const jt = jazzTokens[i];
              if (jt && jt.tokenId === t.id) {
                try {
                  jt.$jazz.set("x", t.x);
                  jt.$jazz.set("y", t.y);
                  if (t.label !== prev.label) jt.$jazz.set("label", t.label || "");
                  if (t.color !== prev.color) jt.$jazz.set("color", t.color || "#666");
                } catch (err) {
                  console.error(`[jazz-bridge] Failed to update JazzToken:`, err);
                }
                break;
              }
            }
          }
        }
      }

      // Detect removed tokens
      const currentIds = new Set(tokens.map((t: Token) => t.id));
      for (const prev of prevTokens) {
        if (!currentIds.has(prev.id)) {
          const len = jazzTokens.length ?? 0;
          for (let i = 0; i < len; i++) {
            const jt = jazzTokens[i];
            if (jt && jt.tokenId === prev.id) {
              try {
                jazzTokens.$jazz.splice(i, 1);
              } catch (err) {
                console.error(`[jazz-bridge] Failed to remove JazzToken:`, err);
              }
              console.log(`[jazz-bridge] → Jazz: removed token ${prev.id}`);
              break;
            }
          }
        }
      }

      prevTokens = tokens;
    });
  activeSubscriptions.push(unsubZustand);

  // ── Token sync: Direction 2 (Jazz → Zustand) ──
  if (sessionRoot.tokens?.$jazz?.subscribe) {
    try {
      const unsubJazz = sessionRoot.tokens.$jazz.subscribe(
        { resolve: { $each: true } },
        (tokens: any) => {
          if (!tokens) return;

          runFromJazz(() => {
            const store = useSessionStore.getState();
            const currentIds = new Set(store.tokens.map((t) => t.id));
            const jazzIds = new Set<string>();
            const len = tokens.length ?? 0;

            for (let i = 0; i < len; i++) {
              const jt = tokens[i];
              if (!jt) continue;
              jazzIds.add(jt.tokenId);

              if (currentIds.has(jt.tokenId)) {
                const existing = store.tokens.find((t) => t.id === jt.tokenId);
                if (existing && (existing.x !== jt.x || existing.y !== jt.y)) {
                  store.updateTokenPosition(jt.tokenId, jt.x, jt.y);
                }
              } else {
                store.addToken(jazzToZustandToken(jt));
                console.log(`[jazz-bridge] ← Jazz: added token ${jt.tokenId}`);
              }
            }

            for (const t of store.tokens) {
              if (!jazzIds.has(t.id)) {
                store.removeToken(t.id);
                console.log(`[jazz-bridge] ← Jazz: removed token ${t.id}`);
              }
            }
          });
        },
      );
      activeSubscriptions.push(unsubJazz);
    } catch (err) {
      console.warn("[jazz-bridge] Could not subscribe to Jazz tokens:", err);
    }
  } else {
    console.warn("[jazz-bridge] Jazz tokens list does not support subscribe — inbound sync disabled");
  }

  // ── Blob sync: Zustand → Jazz (all DO kinds) ──
  for (const kind of BLOB_SYNC_KINDS) {
    const getStore = STORE_FOR_KIND[kind];
    if (!getStore) continue;

    try {
      const store = getStore();
      const unsub = store.subscribe(() => {
        if (_fromJazz) return;
        throttledPushBlob(kind);
      });
      activeSubscriptions.push(unsub);
    } catch (err) {
      console.warn(`[jazz-bridge] Could not subscribe to store for ${kind}:`, err);
    }
  }

  // ── Blob sync: Jazz → Zustand (inbound blob changes) ──
  if (sessionRoot.blobs?.$jazz?.subscribe) {
    try {
      const unsubBlobs = sessionRoot.blobs.$jazz.subscribe(
        { resolve: { $each: true } },
        (blobs: any) => {
          if (!blobs) return;
          const len = blobs.length ?? 0;
          for (let i = 0; i < len; i++) {
            const blob = blobs[i];
            if (!blob || !blob.kind || !blob.state) continue;

            // Check if this is newer than what we last pushed
            const hash = quickHash(blob.state);
            if (_lastPushedHash.get(blob.kind) === hash) continue;

            pullBlobFromJazz(blob.kind, blob.state);
          }
        },
      );
      activeSubscriptions.push(unsubBlobs);
    } catch (err) {
      console.warn("[jazz-bridge] Could not subscribe to Jazz blobs:", err);
    }
  }

  console.log(`[jazz-bridge] Bridge started with token sync + ${BLOB_SYNC_KINDS.length} DO blob kinds`);
}

/**
 * Tear down all active bridge subscriptions.
 */
export function stopBridge(): void {
  for (const unsub of activeSubscriptions) {
    unsub();
  }
  activeSubscriptions.length = 0;

  // Clear throttle timers
  for (const timer of _throttleTimers.values()) {
    clearTimeout(timer);
  }
  _throttleTimers.clear();
  _lastPushedHash.clear();

  _sessionRoot = null;
  _cachedTokens = null;
  _cachedBlobs = null;
  _cachedGroup = null;
  console.log("[jazz-bridge] Bridge stopped");
}
