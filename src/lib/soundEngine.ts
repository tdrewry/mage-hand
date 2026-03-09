/**
 * Event Sound System — Core Engine
 * 
 * Provides synthesized default sounds via Web Audio API and supports
 * custom audio file overrides stored in IndexedDB.
 * Future: file-based sound packs can replace synthesized defaults.
 */

// ── Event Taxonomy ──────────────────────────────────────────────────────

export type SoundEventCategory =
  | 'action'    // combat actions, skill checks
  | 'chat'      // messages, whispers
  | 'dice'      // rolls
  | 'initiative' // turn changes, combat start/end
  | 'effect'    // spell/effect placement, removal
  | 'portal'    // portal activation, teleportation
  | 'movement'  // token move commit, collision
  | 'fog'       // fog reveal, fog hide
  | 'asset'     // art submission, approval
  | 'ui'        // generic alerts, errors
  | 'ambient';  // background, environmental

export type SoundEvent =
  // Action
  | 'action.received'
  | 'action.resolved'
  | 'action.pending'
  | 'action.claim'
  // Chat
  | 'chat.message'
  | 'chat.whisper'
  // Dice
  | 'dice.roll'
  | 'dice.result'
  // Initiative
  | 'initiative.turnChange'
  | 'initiative.combatStart'
  | 'initiative.combatEnd'
  // Effect
  | 'effect.placed'
  | 'effect.removed'
  | 'effect.triggered'
  // Portal
  | 'portal.activate'
  | 'portal.teleport'
  // Movement
  | 'movement.commit'
  | 'movement.collision'
  // Fog
  | 'fog.reveal'
  | 'fog.hide'
  // Asset
  | 'asset.submitted'
  | 'asset.approved'
  | 'asset.rejected'
  // UI
  | 'ui.notification'
  | 'ui.error'
  | 'ui.success'
  // Ambient
  | 'ambient.loop';

// ── Synthesizer definitions ─────────────────────────────────────────────

interface SynthDef {
  type: OscillatorType;
  frequency: number;
  duration: number;
  /** Optional second tone for two-tone alerts */
  frequency2?: number;
  gain?: number;
  /** Ramp-down style */
  decay?: 'linear' | 'exponential';
}

const SYNTH_DEFAULTS: Record<SoundEvent, SynthDef> = {
  // Action — urgent double-beep
  'action.received':   { type: 'sine', frequency: 880, frequency2: 1100, duration: 0.25, gain: 0.35 },
  'action.resolved':   { type: 'sine', frequency: 660, duration: 0.15, gain: 0.25 },
  'action.pending':    { type: 'sine', frequency: 800, frequency2: 1000, duration: 0.3, gain: 0.35 },
  'action.claim':      { type: 'sine', frequency: 500, duration: 0.12, gain: 0.2 },

  // Chat — soft ping
  'chat.message':      { type: 'sine', frequency: 1200, duration: 0.08, gain: 0.15 },
  'chat.whisper':      { type: 'sine', frequency: 1400, duration: 0.06, gain: 0.1 },

  // Dice
  'dice.roll':         { type: 'triangle', frequency: 300, duration: 0.2, gain: 0.2 },
  'dice.result':       { type: 'triangle', frequency: 500, duration: 0.15, gain: 0.2 },

  // Initiative
  'initiative.turnChange':  { type: 'sine', frequency: 700, frequency2: 900, duration: 0.2, gain: 0.25 },
  'initiative.combatStart': { type: 'sawtooth', frequency: 440, frequency2: 660, duration: 0.4, gain: 0.3 },
  'initiative.combatEnd':   { type: 'sine', frequency: 660, frequency2: 440, duration: 0.4, gain: 0.25 },

  // Effect
  'effect.placed':    { type: 'sine', frequency: 600, duration: 0.15, gain: 0.2 },
  'effect.removed':   { type: 'sine', frequency: 400, duration: 0.12, gain: 0.15 },
  'effect.triggered': { type: 'square', frequency: 500, frequency2: 700, duration: 0.25, gain: 0.2 },

  // Portal
  'portal.activate':  { type: 'sine', frequency: 300, frequency2: 600, duration: 0.35, gain: 0.25, decay: 'exponential' },
  'portal.teleport':  { type: 'sine', frequency: 200, frequency2: 800, duration: 0.5, gain: 0.3, decay: 'exponential' },

  // Movement
  'movement.commit':    { type: 'sine', frequency: 400, duration: 0.06, gain: 0.1 },
  'movement.collision': { type: 'square', frequency: 200, duration: 0.1, gain: 0.15 },

  // Fog
  'fog.reveal': { type: 'sine', frequency: 500, duration: 0.1, gain: 0.1 },
  'fog.hide':   { type: 'sine', frequency: 350, duration: 0.1, gain: 0.1 },

  // Asset
  'asset.submitted': { type: 'sine', frequency: 900, duration: 0.1, gain: 0.15 },
  'asset.approved':  { type: 'sine', frequency: 800, frequency2: 1000, duration: 0.2, gain: 0.2 },
  'asset.rejected':  { type: 'sine', frequency: 400, frequency2: 300, duration: 0.2, gain: 0.2 },

  // UI
  'ui.notification': { type: 'sine', frequency: 1000, duration: 0.1, gain: 0.2 },
  'ui.error':        { type: 'square', frequency: 300, duration: 0.15, gain: 0.2 },
  'ui.success':      { type: 'sine', frequency: 800, frequency2: 1200, duration: 0.15, gain: 0.2 },

  // Ambient (placeholder — real ambient would use file-based loops)
  'ambient.loop':    { type: 'sine', frequency: 200, duration: 0.01, gain: 0 },
};

// ── Audio Context (lazy singleton — only created on user gesture) ────────

let audioCtx: AudioContext | null = null;
let userHasInteracted = false;

// Listen for first user gesture to unlock audio
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    userHasInteracted = true;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Only resume if user has interacted (avoids browser warning)
  if (audioCtx.state === 'suspended' && userHasInteracted) {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// ── Custom sound storage (IndexedDB) ────────────────────────────────────

const SOUND_DB_NAME = 'magehand-sounds-db';
const SOUND_DB_VERSION = 1;
const SOUND_STORE = 'sounds';

interface SoundEntry {
  eventName: string;
  audioData: ArrayBuffer;
  mimeType: string;
  fileName: string;
  addedAt: number;
}

let soundDb: IDBDatabase | null = null;

async function getSoundDb(): Promise<IDBDatabase> {
  if (soundDb) return soundDb;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SOUND_DB_NAME, SOUND_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SOUND_STORE)) {
        db.createObjectStore(SOUND_STORE, { keyPath: 'eventName' });
      }
    };
    req.onsuccess = () => { soundDb = req.result; resolve(soundDb); };
    req.onerror = () => reject(req.error);
  });
}

/** Store a custom audio file for an event */
export async function setCustomSound(eventName: SoundEvent, file: File): Promise<void> {
  const db = await getSoundDb();
  const buf = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOUND_STORE, 'readwrite');
    tx.objectStore(SOUND_STORE).put({
      eventName,
      audioData: buf,
      mimeType: file.type,
      fileName: file.name,
      addedAt: Date.now(),
    } satisfies SoundEntry);
    tx.oncomplete = () => { customSoundCache.delete(eventName); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove a custom sound, reverting to synthesized default */
export async function removeCustomSound(eventName: SoundEvent): Promise<void> {
  const db = await getSoundDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOUND_STORE, 'readwrite');
    tx.objectStore(SOUND_STORE).delete(eventName);
    tx.oncomplete = () => { customSoundCache.delete(eventName); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

/** Retrieve a custom sound entry */
async function getCustomSound(eventName: SoundEvent): Promise<SoundEntry | null> {
  const db = await getSoundDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOUND_STORE, 'readonly');
    const req = tx.objectStore(SOUND_STORE).get(eventName);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Get all custom sound entries (for export) */
export async function getAllCustomSounds(): Promise<SoundEntry[]> {
  const db = await getSoundDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOUND_STORE, 'readonly');
    const req = tx.objectStore(SOUND_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Import custom sounds from an exported profile */
export async function importCustomSounds(entries: SoundEntry[]): Promise<void> {
  const db = await getSoundDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SOUND_STORE, 'readwrite');
    const store = tx.objectStore(SOUND_STORE);
    for (const entry of entries) {
      store.put(entry);
    }
    tx.oncomplete = () => { customSoundCache.clear(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

// In-memory decoded buffer cache
const customSoundCache = new Map<string, AudioBuffer | null>();

async function loadCustomBuffer(eventName: SoundEvent): Promise<AudioBuffer | null> {
  if (customSoundCache.has(eventName)) return customSoundCache.get(eventName)!;
  const entry = await getCustomSound(eventName);
  if (!entry) {
    customSoundCache.set(eventName, null);
    return null;
  }
  try {
    const ctx = getAudioContext();
    const buffer = await ctx.decodeAudioData(entry.audioData.slice(0));
    customSoundCache.set(eventName, buffer);
    return buffer;
  } catch {
    customSoundCache.set(eventName, null);
    return null;
  }
}

// ── Playback ────────────────────────────────────────────────────────────

/** Play a synthesized tone from a SynthDef */
function playSynth(def: SynthDef, masterGain: number): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  const effectiveGain = (def.gain ?? 0.2) * masterGain;
  gain.gain.setValueAtTime(effectiveGain, now);

  if (def.decay === 'exponential') {
    gain.gain.exponentialRampToValueAtTime(0.001, now + def.duration);
  } else {
    gain.gain.linearRampToValueAtTime(0, now + def.duration);
  }
  gain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = def.type;
  osc.frequency.setValueAtTime(def.frequency, now);

  if (def.frequency2) {
    osc.frequency.linearRampToValueAtTime(def.frequency2, now + def.duration * 0.5);
  }

  osc.connect(gain);
  osc.start(now);
  osc.stop(now + def.duration);
}

/** Play a custom AudioBuffer */
function playBuffer(buffer: AudioBuffer, masterGain: number): void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(masterGain, ctx.currentTime);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

// ── Public API ──────────────────────────────────────────────────────────

import { useSoundStore } from '@/stores/soundStore';
import { getAudioBuffer } from './audioLibrary';

/**
 * Play a sound for the given event.
 * Priority: event queue (random pick) → legacy custom file → synth fallback.
 */
export async function playSound(event: SoundEvent): Promise<void> {
  const state = useSoundStore.getState();
  if (!state.enabled) return;
  if (state.disabledEvents[event]) return;
  if (event === 'ambient.loop') return; // ambient handled by ambientEngine

  const masterGain = state.masterVolume;
  const categoryGain = state.categoryVolumes[getCategory(event)] ?? 1;
  const effectiveGain = masterGain * categoryGain;
  if (effectiveGain <= 0) return;

  // 1) Try event queue (audio library) — random pick
  const queue = state.eventQueues?.[event] ?? [];
  if (queue.length > 0) {
    const randomId = queue[Math.floor(Math.random() * queue.length)];
    try {
      const ctx = getAudioContext();
      const buffer = await getAudioBuffer(randomId, ctx);
      if (buffer) {
        playBuffer(buffer, effectiveGain);
        return;
      }
    } catch { /* fall through */ }
  }

  // 2) Legacy: single custom sound per event (backward compat)
  try {
    const buffer = await loadCustomBuffer(event);
    if (buffer) {
      playBuffer(buffer, effectiveGain);
      return;
    }
  } catch { /* fall through */ }

  // 3) Synthesized default
  const def = SYNTH_DEFAULTS[event];
  if (def && def.gain !== 0) {
    playSynth(def, effectiveGain);
  }
}

/** Fire-and-forget wrapper (no await needed at call sites) */
export function triggerSound(event: SoundEvent): void {
  playSound(event).catch(() => {});
}

// ── Helpers ─────────────────────────────────────────────────────────────

function getCategory(event: SoundEvent): SoundEventCategory {
  return event.split('.')[0] as SoundEventCategory;
}

/** Get the full event taxonomy for UI enumeration */
export function getAllSoundEvents(): SoundEvent[] {
  return Object.keys(SYNTH_DEFAULTS) as SoundEvent[];
}

/** Get events grouped by category */
export function getSoundEventsByCategory(): Record<SoundEventCategory, SoundEvent[]> {
  const result: Partial<Record<SoundEventCategory, SoundEvent[]>> = {};
  for (const event of getAllSoundEvents()) {
    const cat = getCategory(event);
    (result[cat] ??= []).push(event);
  }
  return result as Record<SoundEventCategory, SoundEvent[]>;
}

// ── Sound Profile Export/Import ─────────────────────────────────────────

export interface SoundProfileLibraryEntry {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  audioBase64: string;
}

export interface SoundProfile {
  version: 2;
  name: string;
  description?: string;
  exportedAt: number;
  settings: {
    masterVolume: number;
    categoryVolumes: Record<string, number>;
    disabledEvents: Record<string, boolean>;
    eventQueues: Record<string, string[]>;
    ambientVolume: number;
    customAmbientLoopIds: string[];
    activeAmbientLoopId: string | null;
  };
  /** Legacy per-event custom sounds (v1 compat) */
  customSounds: Array<{
    eventName: string;
    mimeType: string;
    fileName: string;
    audioBase64: string;
  }>;
  /** Audio library entries referenced by eventQueues and ambient loops */
  libraryEntries: SoundProfileLibraryEntry[];
}

export async function exportSoundProfile(name: string, description?: string): Promise<SoundProfile> {
  const state = useSoundStore.getState();
  const customs = await getAllCustomSounds();

  // Collect all referenced library IDs from event queues + ambient loops
  const referencedIds = new Set<string>();
  for (const ids of Object.values(state.eventQueues)) {
    ids.forEach(id => referencedIds.add(id));
  }
  for (const id of state.customAmbientLoopIds) {
    referencedIds.add(id);
  }

  // Export referenced library entries with embedded audio data
  const { exportLibraryEntries } = await import('@/lib/audioLibrary');
  const libEntries = await exportLibraryEntries([...referencedIds]);
  const libraryEntries: SoundProfileLibraryEntry[] = libEntries.map(e => ({
    id: e.id,
    name: e.name,
    fileName: e.fileName,
    mimeType: e.mimeType,
    audioBase64: arrayBufferToBase64(e.audioData),
  }));

  return {
    version: 2,
    name,
    description,
    exportedAt: Date.now(),
    settings: {
      masterVolume: state.masterVolume,
      categoryVolumes: { ...state.categoryVolumes },
      disabledEvents: { ...state.disabledEvents },
      eventQueues: { ...state.eventQueues },
      ambientVolume: state.ambientVolume,
      customAmbientLoopIds: [...state.customAmbientLoopIds],
      activeAmbientLoopId: state.activeAmbientLoopId,
    },
    customSounds: customs.map(c => ({
      eventName: c.eventName,
      mimeType: c.mimeType,
      fileName: c.fileName,
      audioBase64: arrayBufferToBase64(c.audioData),
    })),
    libraryEntries,
  };
}

export async function importSoundProfile(profile: SoundProfile): Promise<void> {
  const store = useSoundStore.getState();
  store.setMasterVolume(profile.settings.masterVolume);
  store.setCategoryVolumes(profile.settings.categoryVolumes);
  store.setDisabledEvents(profile.settings.disabledEvents);

  // Import legacy custom sounds (v1 compat)
  if (profile.customSounds?.length) {
    const entries: SoundEntry[] = profile.customSounds.map(c => ({
      eventName: c.eventName,
      mimeType: c.mimeType,
      fileName: c.fileName,
      audioData: base64ToArrayBuffer(c.audioBase64),
      addedAt: Date.now(),
    }));
    await importCustomSounds(entries);
  }

  // Import audio library entries (v2)
  if (profile.libraryEntries?.length) {
    const { importLibraryEntries, invalidateAudioBuffer } = await import('@/lib/audioLibrary');
    const libEntries = profile.libraryEntries.map(e => ({
      id: e.id,
      name: e.name,
      fileName: e.fileName,
      mimeType: e.mimeType,
      audioData: base64ToArrayBuffer(e.audioBase64),
      addedAt: Date.now(),
    }));
    await importLibraryEntries(libEntries);
    invalidateAudioBuffer();
  }

  // Restore event queues and ambient settings (v2)
  if (profile.settings.eventQueues) {
    store.setEventQueues(profile.settings.eventQueues);
  }
  if (profile.settings.ambientVolume !== undefined) {
    store.setAmbientVolume(profile.settings.ambientVolume);
  }
  if (profile.settings.customAmbientLoopIds) {
    // Replace custom ambient loop IDs
    const current = store.customAmbientLoopIds;
    for (const id of current) store.removeCustomAmbientLoop(id);
    for (const id of profile.settings.customAmbientLoopIds) store.addCustomAmbientLoop(id);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
