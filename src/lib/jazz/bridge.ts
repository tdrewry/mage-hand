/**
 * Jazz ↔ Zustand Bridge
 *
 * Bidirectional sync between Jazz CoValues and the existing Zustand stores.
 *
 * Echo prevention: a `_fromJazz` flag is set during hydration so that
 * store subscriptions don't re-push the same change back to Jazz.
 *
 * IMPORTANT: This module does NOT import from src/lib/net/ — it's a standalone
 * transport that feeds into the same Zustand stores.
 *
 * NOTE: Jazz types use MaybeLoaded wrappers which make direct property access
 * tricky at compile time. We use `as any` casts in the bridge layer since we
 * only call these functions with fully-loaded CoValues.
 */

import { useSessionStore, type Token } from "@/stores/sessionStore";
import { JazzToken as JazzTokenSchema } from "./schema";

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

/**
 * Get the currently bridged session root (if any).
 */
export function getBridgedSessionRoot(): any {
  return _sessionRoot;
}

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

  for (const t of tokens) {
    const init = tokenToJazzInit(t);
    const jt = JazzTokenSchema.create(init as any, group);
    jazzTokens.push(jt);
  }
}

/**
 * Push all current Zustand state into Jazz CoValues.
 */
export function pushAllToJazz(sessionRoot: any): void {
  pushTokensToJazz(sessionRoot);
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
 * Pull all Jazz CoValue state into Zustand stores.
 */
export function pullAllFromJazz(sessionRoot: any): void {
  pullTokensFromJazz(sessionRoot);
}

// ── Live bridge: subscribe to both directions ─────────────────────────────

/**
 * Start the bidirectional bridge for tokens.
 */
export function startBridge(sessionRoot: any): void {
  _sessionRoot = sessionRoot;
  console.log("[jazz-bridge] Starting bridge");

  // ── Direction 1: Zustand → Jazz ──
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
            jazzTokens.push(jt);
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
                jazzTokens.splice(i, 1);
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

  // ── Direction 2: Jazz → Zustand ──
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

  console.log("[jazz-bridge] Bridge started with token sync");
}

/**
 * Tear down all active bridge subscriptions.
 */
export function stopBridge(): void {
  for (const unsub of activeSubscriptions) {
    unsub();
  }
  activeSubscriptions.length = 0;
  _sessionRoot = null;
  console.log("[jazz-bridge] Bridge stopped");
}
