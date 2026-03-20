/**
 * Compendium Sync Types
 * 
 * Types for the compendium synchronization system (STEP-008).
 * 
 * Data classification:
 * - Reference Data (monsters, spells, items): DM-only; streamed via WebRTC to remote DMs.
 * - Promoted Creatures: synced via Jazz as CharacterRef (compact, player-visible subset).
 * 
 * @see Plans/STEP-008-compendium-sync-strategy.md
 */

// ─── CharacterRef (Promoted Creatures) ───────────────────────────────────────

/**
 * A minimal, player-visible summary of a creature that has been "promoted"
 * from a monster stat block to an active character on the map.
 * 
 * Full stat block stays DM-side only. CharacterRef is what syncs to players.
 */
export interface CharacterRef {
  tokenId: string;
  name: string;
  species?: string;
  hp: { current: number; max: number; temp: number };
  ac: number;
  statuses?: string[];
  /** True when this creature is a companion/familiar/summon (tracks owner). */
  companionOf?: string;     // token ID of owner
}

// ─── Chunked Transfer Protocol ────────────────────────────────────────────────
// Used for WebRTC binary streaming of large compendium data (> 1MB) between DMs.

export type CompendiumDataType = 'bestiary' | 'spells' | 'items' | 'compendium';

/**
 * Sent first to announce a chunked transfer.
 * Receiver allocates a buffer for `totalChunks` chunks of combined size `totalBytes`.
 */
export interface EphemeralChunkStart {
  kind: 'chunk_transfer_start';
  transferId: string;
  dataType: CompendiumDataType;
  totalChunks: number;
  totalBytes: number;
  /** Content hash for integrity verification (sha-256 hex of the full payload). */
  checksum: string;
}

/**
 * Sent once per chunk. All chunks must arrive in order.
 * `data` is base64-encoded segment of the full JSON string.
 */
export interface EphemeralChunkData {
  kind: 'chunk_transfer_data';
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string;             // base64-encoded binary chunk
}

/**
 * Sent after all chunk data messages to signal transfer completion.
 * Receiver should verify using the checksum from EphemeralChunkStart.
 */
export interface EphemeralChunkEnd {
  kind: 'chunk_transfer_end';
  transferId: string;
}

/**
 * Sent by receiver to acknowledge a completed transfer or report an error.
 */
export interface EphemeralChunkAck {
  kind: 'chunk_transfer_ack';
  transferId: string;
  success: boolean;
  error?: string;
}

/**
 * Sent by host when a remote DM connects (to initiate bestiary stream).
 */
export interface EphemeralBestiaryStreamRequest {
  kind: 'bestiary_stream_request';
  requestingClientId: string;
}

export type CompendiumEphemeralMessage =
  | EphemeralChunkStart
  | EphemeralChunkData
  | EphemeralChunkEnd
  | EphemeralChunkAck
  | EphemeralBestiaryStreamRequest;

// ─── CompendiumChunkAssembler ─────────────────────────────────────────────────

/**
 * State machine for reassembling chunked transfers on the receiver side.
 * One instance per active transfer (keyed by transferId).
 */
export interface ChunkAssemblerState {
  transferId: string;
  dataType: CompendiumDataType;
  totalChunks: number;
  totalBytes: number;
  expectedChecksum: string;
  chunks: string[];           // Indexed by chunkIndex
  receivedCount: number;
  isComplete: boolean;
  startedAt: number;
}

/** Maximum chunk size in bytes for WebRTC data channel messages (~64KB safe limit). */
export const CHUNK_SIZE_BYTES = 64 * 1024;

/**
 * Split a JSON string into base64-encoded chunks for transmission.
 * Returns an array of base64 strings, one per chunk.
 */
export function splitIntoChunks(jsonStr: string): string[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonStr);
  const chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE_BYTES) {
    const slice = bytes.slice(offset, offset + CHUNK_SIZE_BYTES);
    // Convert Uint8Array to base64
    const binary = Array.from(slice).map(b => String.fromCharCode(b)).join('');
    chunks.push(btoa(binary));
  }

  return chunks;
}

/**
 * Reassemble base64 chunks back into a JSON string.
 * Throws if any chunk is missing (null/undefined at any index).
 */
export function assembleChunks(chunks: string[]): string {
  const bytes: number[] = [];
  for (const chunk of chunks) {
    const binary = atob(chunk);
    for (let i = 0; i < binary.length; i++) {
      bytes.push(binary.charCodeAt(i));
    }
  }
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}
