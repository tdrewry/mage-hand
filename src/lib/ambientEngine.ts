/**
 * Ambient Loop Engine — manages background audio playback for the VTT.
 *
 * Built-in presets use Web Audio API noise synthesis (no external files needed).
 * Custom loops play user-uploaded files from the shared audio library.
 */

import { getAudioBuffer } from './audioLibrary';
import { useSoundStore } from '@/stores/soundStore';

// ── Built-in preset metadata ────────────────────────────────────────────

export type BuiltinAmbientId =
  | 'builtin:tavern'
  | 'builtin:dungeon'
  | 'builtin:forest'
  | 'builtin:rain'
  | 'builtin:ocean'
  | 'builtin:fire';

export interface AmbientLoopMeta {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
}

export const BUILTIN_AMBIENT_LOOPS: AmbientLoopMeta[] = [
  { id: 'builtin:tavern',  name: 'Tavern',    description: 'Warm filtered noise — busy inn',        builtin: true },
  { id: 'builtin:dungeon', name: 'Dungeon',   description: 'Low drone with resonant sub-bass',      builtin: true },
  { id: 'builtin:forest',  name: 'Forest',    description: 'Wind through leaves — band-pass noise', builtin: true },
  { id: 'builtin:rain',    name: 'Rain',      description: 'Steady high-frequency rainfall',        builtin: true },
  { id: 'builtin:ocean',   name: 'Ocean',     description: 'Brown noise with slow wave LFO',        builtin: true },
  { id: 'builtin:fire',    name: 'Fireplace', description: 'Crackling noise with LFO flutter',      builtin: true },
];

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

// ── Noise buffer generator ──────────────────────────────────────────────

function makeNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink' | 'brown', durationS = 6): AudioBuffer {
  const len = ctx.sampleRate * durationS;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      d[i] = (last + 0.02 * w) / 1.02;
      last = d[i];
      d[i] *= 3.5;
    }
  } else {
    // Pink noise (Paul Kellet algorithm)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

function noiseSource(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = makeNoiseBuffer(ctx, type);
  s.loop = true;
  return s;
}

// ── Preset builder functions ────────────────────────────────────────────
// Each returns a teardown function that stops all running nodes.

type PresetFn = (ctx: AudioContext, out: GainNode) => () => void;

const PRESET_FNS: Record<BuiltinAmbientId, PresetFn> = {
  'builtin:tavern': (ctx, out) => {
    const src = noiseSource(ctx, 'pink');
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 700; lpf.Q.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.07;
    lfo.connect(lfoG); lfoG.connect(out.gain);
    src.connect(lpf); lpf.connect(out);
    src.start(); lfo.start();
    return () => { try { src.stop(); lfo.stop(); } catch {} };
  },

  'builtin:dungeon': (ctx, out) => {
    const src = noiseSource(ctx, 'brown');
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 180; lpf.Q.value = 2;
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 55;
    const oscG = ctx.createGain(); oscG.gain.value = 0.15;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.04;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.04;
    lfo.connect(lfoG); lfoG.connect(out.gain);
    src.connect(lpf); lpf.connect(out);
    osc.connect(oscG); oscG.connect(out);
    src.start(); osc.start(); lfo.start();
    return () => { try { src.stop(); osc.stop(); lfo.stop(); } catch {} };
  },

  'builtin:forest': (ctx, out) => {
    const src = noiseSource(ctx, 'white');
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 1100; bpf.Q.value = 0.3;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.1;
    lfo.connect(lfoG); lfoG.connect(out.gain);
    src.connect(bpf); bpf.connect(out);
    src.start(); lfo.start();
    return () => { try { src.stop(); lfo.stop(); } catch {} };
  },

  'builtin:rain': (ctx, out) => {
    const src = noiseSource(ctx, 'white');
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 500;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 2800; bpf.Q.value = 0.6;
    src.connect(hpf); hpf.connect(bpf); bpf.connect(out);
    src.start();
    return () => { try { src.stop(); } catch {} };
  },

  'builtin:ocean': (ctx, out) => {
    const src = noiseSource(ctx, 'brown');
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 500;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.25;
    lfo.connect(lfoG); lfoG.connect(out.gain);
    src.connect(lpf); lpf.connect(out);
    src.start(); lfo.start();
    return () => { try { src.stop(); lfo.stop(); } catch {} };
  },

  'builtin:fire': (ctx, out) => {
    const src = noiseSource(ctx, 'pink');
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 900; lpf.Q.value = 1.2;
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth'; lfo.frequency.value = 2.5;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.12;
    lfo.connect(lfoG); lfoG.connect(out.gain);
    src.connect(lpf); lpf.connect(out);
    src.start(); lfo.start();
    return () => { try { src.stop(); lfo.stop(); } catch {} };
  },
};

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

  let stopFn: () => void;

  if (loopId.startsWith('builtin:')) {
    const fn = PRESET_FNS[loopId as BuiltinAmbientId];
    if (!fn) { gainNode.disconnect(); return; }
    stopFn = fn(ctx, gainNode);
  } else {
    // Custom loop from audio library
    const buffer = await getAudioBuffer(loopId, ctx);
    if (!buffer) { gainNode.disconnect(); return; }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(gainNode);
    src.start();
    stopFn = () => { try { src.stop(); } catch {} };
  }

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
