/**
 * Jazz Provider — wraps the app in JazzReactProvider for CoValue sync.
 *
 * Uses a self-hosted sync server on localhost:4200 for local development.
 * The provider is a thin wrapper that can be swapped for Jazz Cloud later.
 */

import React from "react";
import { JazzReactProvider } from "jazz-tools/react";

/** Default self-hosted sync server URL */
const DEFAULT_SYNC_URL: `ws://${string}` = "ws://localhost:4200";

interface JazzProviderProps {
  children: React.ReactNode;
  /** Override the sync server URL */
  syncUrl?: `ws://${string}` | `wss://${string}`;
}

/**
 * Wraps children in the Jazz sync context.
 * When the sync server is unreachable, Jazz operates in offline-first mode —
 * local mutations are queued and replayed once the connection is established.
 */
export function JazzSessionProvider({ children, syncUrl }: JazzProviderProps) {
  const peer = syncUrl || DEFAULT_SYNC_URL;

  return (
    <JazzReactProvider
      sync={{ peer }}
    >
      {children}
    </JazzReactProvider>
  );
}

export type { JazzProviderProps };
