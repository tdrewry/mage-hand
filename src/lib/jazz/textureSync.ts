/**
 * Jazz FileStream Texture Sync
 *
 * Distributes binary texture data (token images, region backgrounds, effect
 * textures, map images) between peers via Jazz FileStreams.  FileStreams have
 * no transaction-size limit — they chunk automatically.
 *
 * Flow:
 *   DM (creator) → collects all referenced texture hashes from stores →
 *     loads data URIs from IndexedDB → uploads as FileStreams → pushes
 *     JazzTextureEntry refs into session root.
 *
 *   Player (joiner) → subscribes to sessionRoot.textures → downloads
 *     missing FileStreams → converts to data URIs → saves to IndexedDB.
 */

import { co } from "jazz-tools";
import { loadTextureByHash, saveTextureByHash } from "@/lib/textureStorage";
import { useSessionStore } from "@/stores/sessionStore";
import { useRegionStore } from "@/stores/regionStore";
import { useEffectStore } from "@/stores/effectStore";
import { useMapStore } from "@/stores/mapStore";
import {
  notifyTextureDownloadStart,
  notifyTextureDownloadComplete,
  notifyTextureDownloadError,
} from "@/components/TextureDownloadProgress";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert a data-URI string to a Blob */
function dataUriToBlob(dataUri: string): Blob {
  const [header, base64] = dataUri.split(",");
  const mime = header?.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Convert a Blob to a data-URI string */
async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Hash collection ────────────────────────────────────────────────────────

/** Collect all unique texture hashes referenced by any store */
export function collectAllTextureHashes(): Set<string> {
  const hashes = new Set<string>();

  // Tokens
  for (const t of useSessionStore.getState().tokens) {
    if (t.imageHash) hashes.add(t.imageHash);
  }

  // Regions
  for (const r of useRegionStore.getState().regions) {
    if (r.textureHash) hashes.add(r.textureHash);
  }

  // Placed effects (snapshot template texture)
  for (const e of useEffectStore.getState().placedEffects) {
    if (e.template?.textureHash) hashes.add(e.template.textureHash);
  }

  // Custom effect templates
  for (const t of useEffectStore.getState().customTemplates) {
    if (t.textureHash) hashes.add(t.textureHash);
  }

  // Maps
  for (const m of useMapStore.getState().maps) {
    if ((m as any).imageHash) hashes.add((m as any).imageHash);
  }

  return hashes;
}

// ── Push: DM → Jazz ────────────────────────────────────────────────────────

/** Map of hash → FileStream CoValue ID for deduplication within the session */
const _uploadedHashes = new Map<string, string>();

/**
 * Upload all referenced textures to Jazz FileStreams and register them in
 * the session root's texture list.
 */
export async function pushTexturesToJazz(sessionRoot: any): Promise<void> {
  const textures = sessionRoot.textures;
  if (!textures) {
    console.warn("[jazz-texture] No textures list on session root");
    return;
  }

  const group =
    sessionRoot.$jazz?.owner ??
    sessionRoot._owner ??
    sessionRoot.$jazz?.group;
  if (!group) {
    console.warn("[jazz-texture] No group on session root — cannot upload");
    return;
  }

  const hashes = collectAllTextureHashes();
  if (hashes.size === 0) {
    console.log("[jazz-texture] No textures to push");
    return;
  }

  // Check which hashes are already uploaded in the session
  const existingHashes = new Set<string>();
  const len = textures.length ?? 0;
  for (let i = 0; i < len; i++) {
    const entry = textures[i];
    if (entry?.hash) existingHashes.add(entry.hash);
  }

  let uploaded = 0;
  let skipped = 0;

  for (const hash of hashes) {
    if (existingHashes.has(hash) || _uploadedHashes.has(hash)) {
      skipped++;
      continue;
    }

    // Load data URI from IndexedDB
    const dataUrl = await loadTextureByHash(hash);
    if (!dataUrl) {
      console.warn(`[jazz-texture] Hash ${hash} not found in IndexedDB — skipping`);
      skipped++;
      continue;
    }

    try {
      const blob = dataUriToBlob(dataUrl);
      const mimeType = blob.type || "image/png";

      // Create FileStream from Blob
      const fileStream = await co.fileStream().createFromBlob(blob, {
        owner: group,
      });

      // Get the FileStream's CoValue ID for storage
      const fileStreamId =
        fileStream?.$jazz?.id ?? fileStream?.id ?? fileStream?._raw?.id;

      if (!fileStreamId) {
        console.warn(`[jazz-texture] Could not get FileStream ID for hash ${hash}`);
        continue;
      }

      // Store entry: hash + mimeType + fileStreamId (as string ref)
      // We store the ID as a string since we can't embed a co.fileStream() ref
      // in a dynamically created CoMap
      const entryData = JSON.stringify({ hash, mimeType, fileStreamId });

      // Push as a simple string entry in the textures list
      // We'll use JazzDOBlob-style approach: store metadata as JSON
      const { JazzTextureEntry } = await import("./schema");
      const entry = JazzTextureEntry.create(
        { hash, mimeType, fileStreamId } as any,
        group
      );
      textures.$jazz.push(entry);
      _uploadedHashes.set(hash, fileStreamId);
      uploaded++;

      console.log(`[jazz-texture] → Uploaded texture ${hash} (${(blob.size / 1024).toFixed(1)}KB)`);
    } catch (err) {
      console.error(`[jazz-texture] Failed to upload texture ${hash}:`, err);
    }
  }

  console.log(
    `[jazz-texture] Push complete: ${uploaded} uploaded, ${skipped} skipped (of ${hashes.size} total)`
  );
}

// ── Pull: Player ← Jazz ───────────────────────────────────────────────────

/** Set of hashes we've already downloaded this session (avoid re-fetching) */
const _downloadedHashes = new Set<string>();

/**
 * Download all textures from Jazz FileStreams into local IndexedDB.
 */
export async function pullTexturesFromJazz(sessionRoot: any): Promise<void> {
  const textures = sessionRoot.textures;
  if (!textures) {
    console.log("[jazz-texture] No textures list on session root");
    return;
  }

  const len = textures.length ?? 0;
  if (len === 0) {
    console.log("[jazz-texture] No textures to pull");
    return;
  }

  console.log(`[jazz-texture] Pulling ${len} texture entries from Jazz`);

  let downloaded = 0;
  let skipped = 0;

  for (let i = 0; i < len; i++) {
    const entry = textures[i];
    if (!entry?.hash || !entry?.fileStreamId) continue;

    const hash = entry.hash;

    // Skip if already downloaded
    if (_downloadedHashes.has(hash)) {
      skipped++;
      continue;
    }

    // Check if already in local IndexedDB
    const existing = await loadTextureByHash(hash);
    if (existing) {
      _downloadedHashes.add(hash);
      skipped++;
      continue;
    }

    // Download via FileStream
    notifyTextureDownloadStart(hash);
    try {
      const blob = await co.fileStream().loadAsBlob(entry.fileStreamId);

      if (blob) {
        const dataUrl = await blobToDataUri(blob);
        await saveTextureByHash(hash, dataUrl);
        _downloadedHashes.add(hash);
        downloaded++;
        notifyTextureDownloadComplete(hash);
        console.log(`[jazz-texture] ← Downloaded texture ${hash} (${(blob.size / 1024).toFixed(1)}KB)`);
      } else {
        console.warn(`[jazz-texture] FileStream for ${hash} returned null blob`);
        notifyTextureDownloadError(hash);
      }
    } catch (err) {
      console.error(`[jazz-texture] Failed to download texture ${hash}:`, err);
      notifyTextureDownloadError(hash);
    }
  }

  console.log(
    `[jazz-texture] Pull complete: ${downloaded} downloaded, ${skipped} skipped (of ${len} total)`
  );
}

// ── Subscription for live texture updates ──────────────────────────────────

let _textureUnsubscribe: (() => void) | null = null;

/**
 * Subscribe to the session root's texture list for live additions.
 * When the DM uploads a new texture, players auto-download it.
 */
export function subscribeToTextureChanges(sessionRoot: any): () => void {
  if (_textureUnsubscribe) _textureUnsubscribe();

  const textures = sessionRoot.textures;
  if (!textures?.$jazz?.subscribe) {
    console.warn("[jazz-texture] Textures list does not support subscribe");
    return () => {};
  }

  try {
    _textureUnsubscribe = textures.$jazz.subscribe(
      { resolve: { $each: true } },
      async (textureList: any) => {
        if (!textureList) return;
        const len = textureList.length ?? 0;

        for (let i = 0; i < len; i++) {
          const entry = textureList[i];
          if (!entry?.hash || !entry?.fileStreamId) continue;
          if (_downloadedHashes.has(entry.hash)) continue;

          // Check local cache
          const existing = await loadTextureByHash(entry.hash);
          if (existing) {
            _downloadedHashes.add(entry.hash);
            continue;
          }

          // New texture — download it
          notifyTextureDownloadStart(entry.hash);
          try {
            const blob = await co.fileStream().loadAsBlob(entry.fileStreamId);
            if (blob) {
              const dataUrl = await blobToDataUri(blob);
              await saveTextureByHash(entry.hash, dataUrl);
              _downloadedHashes.add(entry.hash);
              notifyTextureDownloadComplete(entry.hash);
              console.log(`[jazz-texture] ← Live download: ${entry.hash} (${(blob.size / 1024).toFixed(1)}KB)`);
            } else {
              notifyTextureDownloadError(entry.hash);
            }
          } catch (err) {
            console.error(`[jazz-texture] Live download failed for ${entry.hash}:`, err);
            notifyTextureDownloadError(entry.hash);
          }
        }
      }
    );
  } catch (err) {
    console.warn("[jazz-texture] Failed to subscribe to texture changes:", err);
  }

  return () => {
    if (_textureUnsubscribe) {
      _textureUnsubscribe();
      _textureUnsubscribe = null;
    }
  };
}

/** Clean up texture sync state */
export function cleanupTextureSync(): void {
  if (_textureUnsubscribe) {
    _textureUnsubscribe();
    _textureUnsubscribe = null;
  }
  _uploadedHashes.clear();
  _downloadedHashes.clear();
}
