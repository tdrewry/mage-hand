/**
 * Jazz Provider — wraps the app in JazzReactProvider for CoValue sync.
 *
 * Uses a self-hosted sync server on localhost:4200 for local development.
 * The provider is a thin wrapper that can be swapped for Jazz Cloud later.
 *
 * IMPORTANT: This is an OPTIONAL transport module. The app works without it.
 * Jazz only connects when the user explicitly selects Jazz as their transport.
 */

import React, { useEffect } from "react";
import { JazzReactProvider, useAccount } from "jazz-tools/react";
import { useDemoAuth, DemoAuthBasicUI } from 'jazz-tools/react';
import { MageHandAccount } from "./schema";
import { toast } from "sonner";
import { useMultiplayerStore } from "@/stores/multiplayerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { createJazzSession, joinJazzSession } from "./session";
import { encodeJazzCode } from "../sessionCodeResolver";
import { netManager } from "../net/index";
import { JazzTransport } from "../net/transports/JazzTransport";

/** Default self-hosted sync server URL */
const DEFAULT_SYNC_URL: `ws://${string}` = "ws://localhost:4200";

interface JazzProviderProps {
  children: React.ReactNode;
  /** Override the sync server URL */
  syncUrl?: `ws://${string}` | `wss://${string}`;
}

/**
 * Error boundary that catches Jazz provider crashes (e.g. handshake failures)
 * and shows a toast instead of a blank screen.
 */
class JazzErrorBoundary extends React.Component<
  { children: React.ReactNode; syncUrl: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; syncUrl: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[jazz-provider] Provider error:", error);
    toast.error(`Jazz sync error: ${error.message}`, {
      description: `Could not connect to sync server at ${this.props.syncUrl}. The app will continue in offline mode.`,
      duration: 8000,
    });
  }

  render() {
    if (this.state.hasError) {
      // Render children without Jazz — app degrades gracefully
      return this.props.children;
    }
    return this.props.children;
  }
}

/**
 * Monitors the WebSocket connection to the Jazz sync server
 * and shows toasts on connection failures or unhandled protocol messages.
 */
function useJazzConnectionMonitor(syncUrl: string) {
  useEffect(() => {
    // Intercept console warnings from Jazz about unhandled messages
    const originalWarn = console.warn;
    const originalError = console.error;
    let hasShownHandshakeWarning = false;

    console.warn = (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      if (msg.includes("Unhandled") && msg.includes("hello") && !hasShownHandshakeWarning) {
        hasShownHandshakeWarning = true;
        toast.warning("Jazz sync handshake issue", {
          description: `The sync server at ${syncUrl} sent an unrecognized "hello" message. This usually means a version mismatch between the client and server. Check that your Jazz sync server version matches jazz-tools.`,
          duration: 12000,
        });
      }
      originalWarn.apply(console, args);
    };

    console.error = (...args: unknown[]) => {
      const msg = args.map(String).join(" ");
      if (
        (msg.includes("WebSocket") || msg.includes("ws://") || msg.includes("wss://")) &&
        (msg.includes("failed") || msg.includes("error") || msg.includes("ECONNREFUSED"))
      ) {
        toast.error("Jazz sync server unreachable", {
          description: `Could not connect to ${syncUrl}. Jazz will operate in offline-first mode — changes will sync when the server is available.`,
          duration: 8000,
        });
      }
      originalError.apply(console, args);
    };

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [syncUrl]);
}

/**
 * Worker component that runs inside the Jazz Provider.
 * Waits for `me` to be initialized by `guestMode`, then performs
 * pending create/join actions. 
 */
function JazzSetupWorker() {
  const me = useAccount();

  useEffect(() => {
    console.log('[JazzSetupWorker] Check me:', { me, isLoaded: (me as any)?.$isLoaded, type: me?.[Symbol.for('cojson.TypeSym')] || (me as any)?.$type$ });
    // Wait for the local agent to be fully initialized by guestMode
    if (!me || !(me as any).$isLoaded) return;

    const state = useMultiplayerStore.getState();
    const action = state.pendingJazzAction;
    if (!action) return;

    // Clear the action so we don't double-fire
    state.setPendingJazzAction(null);

    const runSetup = async () => {
      try {
        const { type, username, sessionCoId } = action;

        // Resolve local roles
        const sessionState = useSessionStore.getState();
        const currentPlayer = sessionState.players.find(p => p.id === sessionState.currentPlayerId);
        let playerRoles = currentPlayer?.roleIds;
        if (!playerRoles || playerRoles.length === 0) {
          playerRoles = type === 'create' ? ['dm'] : ['player'];
        }

        let info;
        if (type === 'create') {
          info = createJazzSession(username);
        } else if (type === 'join' && sessionCoId) {
          info = await joinJazzSession(sessionCoId);
        } else {
          return;
        }

        const shortCode = encodeJazzCode(info.sessionCoId);
        
        // Hydration stores
        useMultiplayerStore.getState().setRoles(playerRoles);
        useMultiplayerStore.getState().setCurrentSession({
          sessionCode: shortCode,
          sessionId: info.sessionCoId,
          createdAt: Date.now(),
          hasPassword: false,
        });

        // Spin up tandem ephemeral presence
        const transport = new JazzTransport(info.root);
        netManager.connectWithTransport({
          transport,
          sessionCode: shortCode,
          username,
          roles: playerRoles,
        }).then(() => {
          console.log('✅ [JazzSetupWorker] Jazz Ephemeral Transport injected');
        }).catch((err) => {
          console.warn('⚠️ [JazzSetupWorker] Transport injection failed:', err);
        });

        if (type === 'create') {
          toast.success(`Jazz session created — code: ${shortCode}`);
        } else {
          toast.success(`Joined Jazz session ${shortCode}`);
        }

      } catch (err: any) {
        console.error('[JazzSetupWorker] Setup failed:', err);
        toast.error(`Session setup failed: ${err.message}`);
        useMultiplayerStore.getState().setActiveTransport(null);
      }
    };

    runSetup();
  }, [me]);

  return null;
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const me = useAccount();

  if (!me || !(me as any).$isLoaded) {
    // @ts-expect-error DemoAuthBasicUI is typed natively but TS 5.1/React 18 rejects its return signature occasionally
    return <DemoAuthBasicUI appName="Owlbear" />;
  }

  return (
    <>
      <JazzSetupWorker />
      {children}
    </>
  );
}

/**
 * Inner component that only mounts the JazzReactProvider when jazz transport is active.
 */
function JazzActiveProvider({ children, syncUrl }: { children: React.ReactNode; syncUrl: `ws://${string}` | `wss://${string}` }) {
  useJazzConnectionMonitor(syncUrl);

  return (
    <JazzErrorBoundary syncUrl={syncUrl}>
      <JazzReactProvider
        sync={{ peer: syncUrl }}
        AccountSchema={MageHandAccount}
      >
        <AuthWrapper>
          {children}
        </AuthWrapper>
      </JazzReactProvider>
    </JazzErrorBoundary>
  );
}

/**
 * Wraps children in the Jazz sync context ONLY when the Jazz transport is active.
 * When no Jazz session is running, children render without any WebSocket connections.
 */
export function JazzSessionProvider({ children, syncUrl }: JazzProviderProps) {
  const activeTransport = useMultiplayerStore((s) => s.activeTransport);
  const customJazzUrl = useMultiplayerStore((s) => s.customJazzUrl);
  
  const peer = customJazzUrl || syncUrl || import.meta.env.VITE_JAZZ_SYNC_URL || DEFAULT_SYNC_URL;

  if (activeTransport === 'jazz') {
    return <JazzActiveProvider syncUrl={peer as `ws://${string}` | `wss://${string}`}>{children}</JazzActiveProvider>;
  }

  // No Jazz transport active — render children without any WebSocket overhead
  return <>{children}</>;
}

export type { JazzProviderProps };
