/**
 * Ambient Loop Engine — manages background audio playback for the VTT.
 *
 * All ambient loops are user-uploaded audio files stored in the shared
 * audio library (IndexedDB). The host selects which loop to play and
 * broadcasts the choice to connected clients via ephemeral events.
 */

import { getAudioBuffer } from './audioLibrary';
import { useSoundStore } from '@/stores/soundStore';

// ── Public types ────────────────────────────────────────────────────────

export interface AmbientLoopMeta {
  id: string;
  name: string;
  description: string;
}

// ── Audio context (lazy singleton) ──────────────────────────────────────

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

/** Expose the audio context for external consumers that need it. */
export function getAmbientAudioContext(): AudioContext {
  return getCtx();
}

// ── Active playback state ───────────────────────────────────────────────

interface ActiveState {
  loopId: string;
  gainNode: GainNode;
  stop: () => void;
}

let _active: ActiveState | null = null;

// ── Public API ──────────────────────────────────────────────────────────

/** Start an ambient loop. Stops any currently-playing loop first. */
export async function playAmbientLoop(loopId: string, volume: number): Promise<void> {
  stopAmbientLoop();

  const state = useSoundStore.getState();
  if (!state.enabled) return;

  const ctx = getCtx();
  const masterVol = state.masterVolume * (state.categoryVolumes['ambient'] ?? 1) * volume;
  const gainNode = ctx.createGain();
  gainNode.gain.value = Math.max(0, Math.min(1, masterVol));
  gainNode.connect(ctx.destination);

  const buffer = await getAudioBuffer(loopId, ctx);
  if (!buffer) { gainNode.disconnect(); return; }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(gainNode);
  src.start();
  const stopFn = () => { try { src.stop(); } catch {} };

  _active = { loopId, gainNode, stop: stopFn };
}

/** Stop the currently-playing ambient loop. */
export function stopAmbientLoop(): void {
  if (!_active) return;
  _active.stop();
  try { _active.gainNode.disconnect(); } catch {}
  _active = null;
}

/** Update the gain on the active loop (e.g. when volume sliders change). */
export function setAmbientGain(volume: number): void {
  if (!_active) return;
  const state = useSoundStore.getState();
  const masterVol = state.masterVolume * (state.categoryVolumes['ambient'] ?? 1) * volume;
  _active.gainNode.gain.value = Math.max(0, Math.min(1, masterVol));
}

/** Whether any ambient loop is currently playing. */
export function isAmbientPlaying(): boolean {
  return _active !== null;
}

/** Get the ID of the currently-playing ambient loop (null if silent). */
export function getActiveAmbientLoopId(): string | null {
  return _active?.loopId ?? null;
}
