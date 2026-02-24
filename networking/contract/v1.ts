// networking/contract/v1.ts
// JSON-only, forward compatible. Keep this file very stable.

export const PROTOCOL_VERSION = 1 as const;

export type SessionId = string;
export type SessionCode = string;
export type UserId = string;
export type ClientId = string;
export type ConnectionId = string;
export type OpSeq = number;
export type ClientSeq = number;
export type Iso8601 = string;

export type RejectCode =
  | "unauthorized"
  | "bad_request"
  | "invalid_session"
  | "session_full"
  | "wrong_password"
  | "expired_token"
  | "permission_denied"
  | "stale_client"
  | "rate_limited"
  | "server_error";

export type PermissionKey =
  | "control_own_tokens"
  | "control_other_tokens"
  | "see_all_no_fog"
  | "see_friendly_vision"
  | "see_hostile_vision"
  | "see_own_tokens"
  | "see_other_tokens"
  | "see_hidden_tokens"
  | "create_tokens"
  | "delete_own_tokens"
  | "delete_other_tokens"
  | "manage_roles"
  | "assign_player_roles"
  | "assign_token_roles"
  | "edit_map"
  | "manage_initiative"
  | "manage_hostility"
  | "manage_fog";

export interface UserSummary {
  userId: UserId;
  username: string;
  roles: string[];
}

export interface SnapshotPointer {
  snapshotId: string;
  snapshotKey: string;
  baseSeq: OpSeq;
  createdAt: Iso8601;
  extras?: Record<string, unknown>;
}

export interface OpLogSegmentPointer {
  fromSeq: OpSeq;
  toSeq: OpSeq;
  key: string;
  createdAt: Iso8601;
  codec?: "ndjson" | "json";
  compression?: "zstd" | "gzip" | "none";
}

export interface EnvelopeBase<TType extends string, TPayload> {
  v: typeof PROTOCOL_VERSION;
  t: TType;
  sessionId?: SessionId;
  sessionCode?: SessionCode;
  clientId: ClientId;
  userId?: UserId;
  clientSeq?: ClientSeq;
  seq?: OpSeq;
  ts: Iso8601;
  p: TPayload;
}

export type Msg<TType extends string, TPayload> = EnvelopeBase<TType, TPayload>;

export interface EngineOp {
  kind: string;
  targets?: {
    tokenIds?: string[];
    layerIds?: string[];
    entityIds?: string[];
  };
  data: unknown;
  opId?: string;
  meta?: Record<string, unknown>;
}

export interface OpBatchPayload {
  fromSeq: OpSeq;
  toSeq: OpSeq;
  ops: Array<{
    seq: OpSeq;
    userId: UserId;
    ts: Iso8601;
    op: EngineOp;
  }>;
}

export interface ProposeOpsPayload {
  ops: Array<{
    clientOpId?: string;
    op: EngineOp;
  }>;
}

export interface AckPayload {
  clientSeq: ClientSeq;
  assigned?: { fromSeq: OpSeq; toSeq: OpSeq };
  opMap?: Array<{ clientOpId?: string; seq: OpSeq }>;
}

export interface RejectPayload {
  clientSeq?: ClientSeq;
  code: RejectCode;
  message?: string;
  requiredPermission?: PermissionKey;
  resumeFromSeq?: OpSeq;
  snapshot?: SnapshotPointer;
}

export interface HelloPayload {
  protocol: typeof PROTOCOL_VERSION;
  username: string;
  inviteToken?: string;
  password?: string;
  /** Client's locally-selected role IDs (e.g. ["dm"] or ["player"]). */
  roles?: string[];
  lastSeenSeq?: OpSeq;
  wantsPresence?: boolean;
  codec?: "json";
}

export interface WelcomePayload {
  sessionId: SessionId;
  user: UserSummary;
  permissions: PermissionKey[];
  currentSeq: OpSeq;
  snapshot?: SnapshotPointer;
  recentSegments?: OpLogSegmentPointer[];
  /** Other users already in the session (excludes self). */
  peers?: UserSummary[];
  features?: {
    opBatching?: boolean;
    maxBatchSize?: number;
    maxMessageBytes?: number;
  };
}

export interface PresencePayload {
  kind: "join" | "leave" | "update";
  user: UserSummary;
  connectionId?: ConnectionId;
}

export interface NeedSnapshotPayload {
  reason: "too_far_behind" | "no_history" | "server_restarted" | "protocol_mismatch";
  snapshot: SnapshotPointer;
}

export interface SnapshotPointerPayload {
  snapshot: SnapshotPointer;
}

export interface CatchupRequestPayload {
  fromSeq: OpSeq;
  limit?: number;
}

export type CatchupResponsePayload = OpBatchPayload;

export interface ChatPostPayload {
  text: string;
  msgId?: string;
}

export interface AssetRegisteredPayload {
  assetId: string;
  sha256: string;
  key: string;
  mime: string;
  bytes: number;
  meta?: Record<string, unknown>;
}

/** Ephemeral payload: fire-and-forget, no sequencing, no persistence. */
export interface EphemeralPayload {
  kind: string;
  data: unknown;
}

export type ClientToServerMessage =
  | Msg<"hello", HelloPayload>
  | Msg<"propose_ops", ProposeOpsPayload>
  | Msg<"catchup_request", CatchupRequestPayload>
  | Msg<"chat_post", ChatPostPayload>
  | Msg<"asset_registered", AssetRegisteredPayload>
  | Msg<"ephemeral", EphemeralPayload>;

export type ServerToClientMessage =
  | Msg<"welcome", WelcomePayload>
  | Msg<"ack", AckPayload>
  | Msg<"reject", RejectPayload>
  | Msg<"op_batch", OpBatchPayload>
  | Msg<"presence", PresencePayload>
  | Msg<"need_snapshot", NeedSnapshotPayload>
  | Msg<"snapshot_pointer", SnapshotPointerPayload>
  | Msg<"ephemeral", EphemeralPayload & { userId: UserId }>;

// Default export for compatibility when this module is transpiled to CJS
// (ESM named imports from CJS will fail in Node).
const Protocol = { PROTOCOL_VERSION } as const;
export default Protocol;
