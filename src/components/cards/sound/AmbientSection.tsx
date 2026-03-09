import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Play, Square, Radio, Upload, Trash2, Volume2,
} from 'lucide-react';
import { useSoundStore } from '@/stores/soundStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import {
  BUILTIN_AMBIENT_LOOPS,
  playAmbientLoop,
  stopAmbientLoop,
  setAmbientGain,
  type AmbientLoopMeta,
} from '@/lib/ambientEngine';
import { addToAudioLibrary, getFromAudioLibrary } from '@/lib/audioLibrary';
import { emitAmbientLoopPlay, emitAmbientLoopStop } from '@/lib/net/ephemeral/ambientHandlers';
import { toast } from 'sonner';

export const AmbientSection: React.FC = () => {
  const {
    activeAmbientLoopId, ambientVolume, customAmbientLoopIds,
    categoryVolumes, setAmbientVolume, setActiveAmbientLoopId,
    addCustomAmbientLoop, removeCustomAmbientLoop, setCategoryVolume,
  } = useSoundStore();

  const roles = useMultiplayerStore((s) => s.roles);
  const isDM = roles.includes('dm');
  const uploadRef = useRef<HTMLInputElement>(null);

  // Resolve custom loop names from library
  const [customLoops, setCustomLoops] = useState<AmbientLoopMeta[]>([]);
  useEffect(() => {
    Promise.all(
      customAmbientLoopIds.map(async (id) => {
        const entry = await getFromAudioLibrary(id);
        return entry
          ? { id, name: entry.name, description: entry.fileName, builtin: false }
          : null;
      })
    ).then((results) => setCustomLoops(results.filter(Boolean) as AmbientLoopMeta[]));
  }, [customAmbientLoopIds]);

  const allLoops = [...BUILTIN_AMBIENT_LOOPS, ...customLoops];
  const ambientCatVol = categoryVolumes['ambient'] ?? 1;

  const handlePlay = (loopId: string) => {
    setActiveAmbientLoopId(loopId);
    playAmbientLoop(loopId, ambientVolume).catch(() => {});
  };

  const handleBroadcast = (loopId: string) => {
    handlePlay(loopId);
    emitAmbientLoopPlay(loopId, ambientVolume);
    toast.success('Ambient loop broadcast to all players');
  };

  const handleStop = () => {
    setActiveAmbientLoopId(null);
    stopAmbientLoop();
    if (isDM) emitAmbientLoopStop();
  };

  const handleVolumeChange = (v: number) => {
    setAmbientVolume(v);
    setAmbientGain(v);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const entry = await addToAudioLibrary(file);
      addCustomAmbientLoop(entry.id);
      toast.success(`Added "${entry.name}" as ambient loop`);
    } catch {
      toast.error('Failed to add ambient loop');
    }
    e.target.value = '';
  };

  const handleRemoveCustom = (id: string) => {
    removeCustomAmbientLoop(id);
    if (activeAmbientLoopId === id) handleStop();
    toast.success('Custom ambient loop removed');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5 text-foreground" />
          <span className="text-xs font-medium">Ambient Loops</span>
        </div>
        {activeAmbientLoopId && (
          <Button variant="destructive" size="sm" onClick={handleStop} className="h-6 text-[10px] px-2 gap-1">
            <Square className="h-2.5 w-2.5" /> Stop
          </Button>
        )}
      </div>

      {/* Ambient volume */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-16 shrink-0">Volume</span>
        <Slider
          min={0} max={1} step={0.01}
          value={[ambientVolume]}
          onValueChange={([v]) => handleVolumeChange(v)}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
          {Math.round(ambientVolume * 100)}%
        </span>
      </div>

      {/* Category volume */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-16 shrink-0">Category</span>
        <Slider
          min={0} max={1} step={0.01}
          value={[ambientCatVol]}
          onValueChange={([v]) => setCategoryVolume('ambient', v)}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
          {Math.round(ambientCatVol * 100)}%
        </span>
      </div>

      {/* Loop list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {allLoops.map((loop) => (
          <div
            key={loop.id}
            className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-xs transition-colors ${
              activeAmbientLoopId === loop.id
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-muted/50'
            }`}
          >
            {activeAmbientLoopId === loop.id && (
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground">{loop.name}</span>
              {loop.builtin && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-1.5">synth</Badge>
              )}
              <p className="text-[10px] text-muted-foreground truncate">{loop.description}</p>
            </div>

            {/* Preview (local only) */}
            <Button
              variant="ghost" size="icon"
              className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => handlePlay(loop.id)}
              title="Preview locally"
            >
              <Play className="h-3 w-3" />
            </Button>

            {/* Broadcast (DM only) */}
            {isDM && (
              <Button
                variant="ghost" size="icon"
                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-primary"
                onClick={() => handleBroadcast(loop.id)}
                title="Broadcast to all players"
              >
                <Radio className="h-3 w-3" />
              </Button>
            )}

            {/* Remove custom */}
            {!loop.builtin && (
              <Button
                variant="ghost" size="icon"
                className="h-5 w-5 shrink-0 text-destructive/70 hover:text-destructive"
                onClick={() => handleRemoveCustom(loop.id)}
                title="Remove custom loop"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Upload custom */}
      <Button
        variant="outline" size="sm"
        className="w-full h-7 text-xs"
        onClick={() => uploadRef.current?.click()}
      >
        <Upload className="h-3 w-3 mr-1.5" /> Add Custom Loop
      </Button>
      <input
        ref={uploadRef} type="file" accept="audio/*"
        className="hidden" onChange={handleUpload}
      />

      {!isDM && activeAmbientLoopId && (
        <p className="text-[10px] text-muted-foreground italic">
          Ambient loop set by the host. Adjust volume locally above.
        </p>
      )}
    </div>
  );
};
