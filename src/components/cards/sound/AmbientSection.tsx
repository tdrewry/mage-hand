import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Play, Square, Radio, Upload, Trash2, Volume2, Plus,
} from 'lucide-react';
import { useSoundStore } from '@/stores/soundStore';
import { useMultiplayerStore } from '@/stores/multiplayerStore';
import {
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
    categoryVolumes, masterVolume, setAmbientVolume, setActiveAmbientLoopId,
    addCustomAmbientLoop, removeCustomAmbientLoop, setCategoryVolume,
  } = useSoundStore();

  const roles = useMultiplayerStore((s) => s.roles);
  const isDM = roles.includes('dm');
  const uploadRef = useRef<HTMLInputElement>(null);
  const [customName, setCustomName] = useState('');

  // Resolve custom loop names from library
  const [loops, setLoops] = useState<AmbientLoopMeta[]>([]);
  useEffect(() => {
    Promise.all(
      customAmbientLoopIds.map(async (id) => {
        const entry = await getFromAudioLibrary(id);
        return entry
          ? { id, name: entry.name, description: entry.fileName }
          : null;
      })
    ).then((results) => setLoops(results.filter(Boolean) as AmbientLoopMeta[]));
  }, [customAmbientLoopIds]);

  // Sync ambient gain when master, category, or ambient volume changes
  useEffect(() => {
    if (activeAmbientLoopId) setAmbientGain(ambientVolume);
  }, [masterVolume, categoryVolumes, ambientVolume, activeAmbientLoopId]);

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
      const name = customName.trim() || file.name.replace(/\.[^/.]+$/, '');
      const entry = await addToAudioLibrary(file, name);
      addCustomAmbientLoop(entry.id);
      setCustomName('');
      toast.success(`Added "${entry.name}" as ambient loop`);
    } catch {
      toast.error('Failed to add ambient loop');
    }
    e.target.value = '';
  };

  const handleRemoveCustom = (id: string) => {
    removeCustomAmbientLoop(id);
    if (activeAmbientLoopId === id) handleStop();
    toast.success('Ambient loop removed');
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
      {loops.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic py-2">
          No ambient loops added yet. Upload an audio file below.
        </p>
      )}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {loops.map((loop) => (
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
              <p className="text-[10px] text-muted-foreground truncate">{loop.description}</p>
            </div>

            {/* Preview (local only) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handlePlay(loop.id)}
                >
                  <Play className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Preview locally</TooltipContent>
            </Tooltip>

            {/* Broadcast (DM only) */}
            {isDM && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-5 w-5 shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => handleBroadcast(loop.id)}
                  >
                    <Radio className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Broadcast to all players</TooltipContent>
              </Tooltip>
            )}

            {/* Remove */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  className="h-5 w-5 shrink-0 text-destructive/70 hover:text-destructive"
                  onClick={() => handleRemoveCustom(loop.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Remove loop</TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>

      {/* Add custom loop with name */}
      <Separator />
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground font-medium">Add Sound</span>
        <Input
          placeholder="Loop name (optional)"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="h-7 text-xs"
        />
        <Button
          variant="outline" size="sm"
          className="w-full h-7 text-xs"
          onClick={() => uploadRef.current?.click()}
        >
          <Plus className="h-3 w-3 mr-1.5" /> Choose Audio File
        </Button>
      </div>
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
