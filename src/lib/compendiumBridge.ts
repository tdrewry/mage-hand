/**
 * Compendium Bridge — Handles WebRTC-based bestiary streaming between DMs.
 * 
 * On the HOST DM side:
 *   - Detects when a remote DM connects (via Jazz connectedUsers)
 *   - Chunks the bestiary JSON and streams it via ephemeral data channel
 * 
 * On the REMOTE DM side:
 *   - Receives chunks and reassembles the payload
 *   - Verifies checksum and loads data into the local compendium store
 * 
 * Standard sessions (players only): no compendium data sent.
 * 
 * @see Plans/STEP-008-compendium-sync-strategy.md
 */

import type {
  EphemeralChunkStart,
  EphemeralChunkData,
  EphemeralChunkEnd,
  EphemeralChunkAck,
  ChunkAssemblerState,
  CompendiumDataType,
  CompendiumEphemeralMessage,
} from '@/types/compendiumSync';
import {
  CHUNK_SIZE_BYTES,
  splitIntoChunks,
  assembleChunks,
} from '@/types/compendiumSync';

// ─── Checksum (SHA-256 via Web Crypto API) ────────────────────────────────────

async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Send outgoing messages (injected at startup) ─────────────────────────────

type SendMessage = (msg: CompendiumEphemeralMessage) => void;

let _sendMessage: SendMessage | null = null;

export function initCompendiumBridge(send: SendMessage): void {
  _sendMessage = send;
}

function send(msg: CompendiumEphemeralMessage): void {
  if (!_sendMessage) {
    console.warn('[compendiumBridge] Not initialized — sendMessage is null');
    return;
  }
  _sendMessage(msg);
}

// ─── Active transfers (receiver side) ─────────────────────────────────────────

const _activeTransfers = new Map<string, ChunkAssemblerState>();

// ─── HOST SIDE: Stream bestiary to a remote DM ────────────────────────────────

export interface BestiaryProvider {
  /** Returns the full bestiary JSON string or null if not available. */
  getBestiaryJson(): string | null;
}

let _bestiaryProvider: BestiaryProvider | null = null;

export function setBestiaryProvider(provider: BestiaryProvider): void {
  _bestiaryProvider = provider;
}

/**
 * Called when the host DM detects a remote DM has connected.
 * Streams the full bestiary JSON in chunks over the ephemeral data channel.
 */
export async function streamBestiaryToRemoteDM(
  targetClientId: string,
  dataType: CompendiumDataType = 'bestiary'
): Promise<void> {
  if (!_bestiaryProvider) {
    console.warn('[compendiumBridge] No bestiary provider registered');
    return;
  }

  const json = _bestiaryProvider.getBestiaryJson();
  if (!json) {
    console.warn('[compendiumBridge] Bestiary JSON is null — not streaming');
    return;
  }

  const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const chunks = splitIntoChunks(json);
  const checksum = await sha256Hex(json);
  const totalBytes = new TextEncoder().encode(json).length;

  console.log(
    `[compendiumBridge] Streaming ${dataType} to client ${targetClientId}: ` +
    `${chunks.length} chunks, ${(totalBytes / 1024).toFixed(1)}KB`
  );

  // Send start message
  const startMsg: EphemeralChunkStart = {
    kind: 'chunk_transfer_start',
    transferId,
    dataType,
    totalChunks: chunks.length,
    totalBytes,
    checksum,
  };
  send(startMsg);

  // Send each chunk with a small delay to avoid flooding the data channel
  for (let i = 0; i < chunks.length; i++) {
    const chunkMsg: EphemeralChunkData = {
      kind: 'chunk_transfer_data',
      transferId,
      chunkIndex: i,
      totalChunks: chunks.length,
      data: chunks[i],
    };
    send(chunkMsg);
    // Small yield to avoid blocking
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 0));
  }

  // Send end marker
  const endMsg: EphemeralChunkEnd = { kind: 'chunk_transfer_end', transferId };
  send(endMsg);
}

// ─── RECEIVER SIDE: Handle incoming chunk messages ────────────────────────────

export interface CompendiumLoadHandler {
  /** Called when a full bestiary transfer is complete and assembled. */
  onBestiaryReceived(dataType: CompendiumDataType, json: string): void;
  /** Called with progress updates (0–1). */
  onProgress(transferId: string, progress: number): void;
  /** Called on transfer complete (before parsing). */
  onTransferComplete(transferId: string, success: boolean, error?: string): void;
}

let _loadHandler: CompendiumLoadHandler | null = null;

export function setCompendiumLoadHandler(handler: CompendiumLoadHandler): void {
  _loadHandler = handler;
}

/**
 * Route an incoming CompendiumEphemeralMessage to the appropriate handler.
 * Call this from the main ephemeral message router.
 */
export async function handleCompendiumMessage(msg: CompendiumEphemeralMessage): Promise<void> {
  switch (msg.kind) {
    case 'chunk_transfer_start': {
      _activeTransfers.set(msg.transferId, {
        transferId: msg.transferId,
        dataType: msg.dataType,
        totalChunks: msg.totalChunks,
        totalBytes: msg.totalBytes,
        expectedChecksum: msg.checksum,
        chunks: new Array(msg.totalChunks).fill(null),
        receivedCount: 0,
        isComplete: false,
        startedAt: Date.now(),
      });
      console.log(`[compendiumBridge] Started receiving ${msg.dataType} (${msg.totalChunks} chunks)`);
      break;
    }

    case 'chunk_transfer_data': {
      const state = _activeTransfers.get(msg.transferId);
      if (!state) {
        console.warn(`[compendiumBridge] Unknown transfer ${msg.transferId}`);
        return;
      }
      state.chunks[msg.chunkIndex] = msg.data;
      state.receivedCount++;

      const progress = state.receivedCount / state.totalChunks;
      _loadHandler?.onProgress(msg.transferId, progress);
      break;
    }

    case 'chunk_transfer_end': {
      const state = _activeTransfers.get(msg.transferId);
      if (!state) return;

      // Verify all chunks received
      const missing = state.chunks.findIndex(c => c === null);
      if (missing !== -1) {
        const errMsg = `Missing chunk ${missing}`;
        console.error(`[compendiumBridge] Transfer failed: ${errMsg}`);
        send({ kind: 'chunk_transfer_ack', transferId: msg.transferId, success: false, error: errMsg });
        _loadHandler?.onTransferComplete(msg.transferId, false, errMsg);
        _activeTransfers.delete(msg.transferId);
        return;
      }

      // Reassemble
      const json = assembleChunks(state.chunks);

      // Verify checksum
      const actualChecksum = await sha256Hex(json);
      if (actualChecksum !== state.expectedChecksum) {
        const errMsg = `Checksum mismatch: expected ${state.expectedChecksum}, got ${actualChecksum}`;
        console.error(`[compendiumBridge] ${errMsg}`);
        send({ kind: 'chunk_transfer_ack', transferId: msg.transferId, success: false, error: errMsg });
        _loadHandler?.onTransferComplete(msg.transferId, false, errMsg);
        _activeTransfers.delete(msg.transferId);
        return;
      }

      // Success
      const elapsed = ((Date.now() - state.startedAt) / 1000).toFixed(1);
      console.log(
        `[compendiumBridge] Transfer ${msg.transferId} complete in ${elapsed}s — ` +
        `${(json.length / 1024).toFixed(1)}KB`
      );

      send({ kind: 'chunk_transfer_ack', transferId: msg.transferId, success: true });
      _loadHandler?.onBestiaryReceived(state.dataType, json);
      _loadHandler?.onTransferComplete(msg.transferId, true);
      _activeTransfers.delete(msg.transferId);
      break;
    }

    case 'chunk_transfer_ack': {
      if (!msg.success) {
        console.error(`[compendiumBridge] Remote rejected transfer ${msg.transferId}: ${msg.error}`);
      } else {
        console.log(`[compendiumBridge] Remote ACK for transfer ${msg.transferId}`);
      }
      break;
    }

    case 'bestiary_stream_request': {
      // Remote DM is requesting the bestiary — host triggers the stream
      console.log(`[compendiumBridge] Received bestiary request from ${msg.requestingClientId}`);
      await streamBestiaryToRemoteDM(msg.requestingClientId);
      break;
    }

    default:
      break;
  }
}
