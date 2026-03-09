/**
 * Shared Audio Library — IndexedDB-backed pool of uploaded audio files.
 * Events reference library entries by ID via eventQueues in soundStore.
 * Ambient loops and per-event custom sounds all live here.
 */

const DB_NAME = 'magehand-audio-library';
const DB_VERSION = 1;
const STORE_NAME = 'library';

export interface AudioLibraryEntry {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  audioData: ArrayBuffer;
  addedAt: number;
}

// ── IndexedDB handle ────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

async function getDb(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db!); };
    req.onerror = () => reject(req.error);
  });
}

// ── CRUD ─────────────────────────────────────────────────────────────────

/** Upload a file to the shared library, returns the stored entry. */
export async function addToAudioLibrary(file: File, customName?: string): Promise<AudioLibraryEntry> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const audioData = await file.arrayBuffer();
  const entry: AudioLibraryEntry = {
    id,
    name: customName ?? file.name.replace(/\.[^.]+$/, ''),
    fileName: file.name,
    mimeType: file.type,
    audioData,
    addedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove an entry by ID. */
export async function removeFromAudioLibrary(id: string): Promise<void> {
  const db = await getDb();
  _bufferCache.delete(id);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Get a single entry by ID (null if missing). */
export async function getFromAudioLibrary(id: string): Promise<AudioLibraryEntry | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** List all entries in the library. */
export async function listAudioLibrary(): Promise<AudioLibraryEntry[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

// ── Bulk export/import (sound profiles) ──────────────────────────────────

/** Export specific library entries for embedding in a sound profile. */
export async function exportLibraryEntries(ids: string[]): Promise<AudioLibraryEntry[]> {
  const all = await listAudioLibrary();
  return all.filter(e => ids.includes(e.id));
}

/** Import library entries (upsert). */
export async function importLibraryEntries(entries: AudioLibraryEntry[]): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const entry of entries) {
      tx.objectStore(STORE_NAME).put(entry);
    }
    tx.oncomplete = () => { _bufferCache.clear(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

// ── Decoded AudioBuffer cache ────────────────────────────────────────────

const _bufferCache = new Map<string, AudioBuffer | null>();

/** Decode and cache an AudioBuffer for playback. */
export async function getAudioBuffer(id: string, ctx: AudioContext): Promise<AudioBuffer | null> {
  if (_bufferCache.has(id)) return _bufferCache.get(id)!;
  const entry = await getFromAudioLibrary(id);
  if (!entry) { _bufferCache.set(id, null); return null; }
  try {
    const buffer = await ctx.decodeAudioData(entry.audioData.slice(0));
    _bufferCache.set(id, buffer);
    return buffer;
  } catch {
    _bufferCache.set(id, null);
    return null;
  }
}

/** Invalidate cached buffers (call after library changes). */
export function invalidateAudioBuffer(id?: string): void {
  if (id) _bufferCache.delete(id);
  else _bufferCache.clear();
}
