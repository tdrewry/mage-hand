/**
 * Jazz Provider — wraps the app in JazzProvider for CoValue sync.
 *
 * Uses a self-hosted sync server on localhost:4200 for local development.
 * The provider is a thin wrapper that can be swapped for Jazz Cloud later.
 */

import React from "react";
import { JazzProvider as JazzReactProvider, useJazz } from "jazz-react";
import { JazzSessionRoot } from "./schema";

/** Default self-hosted sync server URL */
const DEFAULT_SYNC_URL = "ws://localhost:4200";

interface JazzProviderProps {
  children: React.ReactNode;
  /** Override the sync server URL (defaults to ws://localhost:4200) */
  syncUrl?: string;
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
      AccountSchema={undefined as any}
    >
      {children}
    </JazzReactProvider>
  );
}

export { useJazz };
export type { JazzProviderProps };
