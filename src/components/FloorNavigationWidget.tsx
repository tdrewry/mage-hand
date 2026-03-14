import React from 'react';
import { ChevronUp, ChevronDown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMapStore, type GameMap } from '@/stores/mapStore';
import { toast } from 'sonner';
import { useBottomNavbarVisible } from '@/hooks/useBottomNavbarVisible';
import { cn } from '@/lib/utils';

/**
 * Small overlay widget showing up/down floor navigation when the focused map
 * belongs to a structure with multiple floors.
 */
export const FloorNavigationWidget: React.FC = () => {
  const maps = useMapStore(s => s.maps);
  const selectedMapId = useMapStore(s => s.selectedMapId);
  const structures = useMapStore(s => s.structures);
  const navigateFloor = useMapStore(s => s.navigateFloor);
  const isBottomNavbarVisible = useBottomNavbarVisible();

  const currentMap = maps.find(m => m.id === selectedMapId);
  if (!currentMap?.structureId) return null;

  const structure = structures.find(s => s.id === currentMap.structureId);
  if (!structure) return null;

  const floorsInStructure = maps
    .filter(m => m.structureId === currentMap.structureId && m.floorNumber !== undefined)
    .sort((a, b) => a.floorNumber! - b.floorNumber!);

  if (floorsInStructure.length < 2) return null;

  const currentIdx = floorsInStructure.findIndex(m => m.id === currentMap.id);
  const canGoUp = currentIdx < floorsInStructure.length - 1;
  const canGoDown = currentIdx > 0;

  const handleNavigate = (dir: 'up' | 'down') => {
    const targetId = navigateFloor(dir);
    if (targetId) {
      const targetMap = maps.find(m => m.id === targetId);
      toast.success(`Floor ${dir === 'up' ? '▲' : '▼'} → ${targetMap?.name || 'Unknown'}`);
    }
  };

  return (
    <div 
      className={cn(
        "absolute right-4 z-50 flex flex-col items-center gap-0.5 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg transition-all duration-300 ease-in-out",
        isBottomNavbarVisible ? "bottom-36" : "bottom-20"
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={!canGoUp}
        onClick={() => handleNavigate('up')}
        title={canGoUp ? `Go up to ${floorsInStructure[currentIdx + 1]?.name}` : 'Top floor'}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      <div className="flex flex-col items-center px-1">
        <Building2 className="h-3.5 w-3.5 text-primary mb-0.5" />
        <span className="text-[9px] text-muted-foreground leading-tight text-center max-w-[60px] truncate">
          {structure.name}
        </span>
        <span className="text-[10px] font-medium text-foreground">
          F{currentMap.floorNumber ?? '?'}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled={!canGoDown}
        onClick={() => handleNavigate('down')}
        title={canGoDown ? `Go down to ${floorsInStructure[currentIdx - 1]?.name}` : 'Bottom floor'}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
};
