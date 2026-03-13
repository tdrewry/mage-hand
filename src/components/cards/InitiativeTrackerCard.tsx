import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InitiativeCard } from '@/components/InitiativeCard';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { ChevronUp, ChevronDown, Swords, Dices, AlignVerticalJustifyStart, AlignHorizontalJustifyStart, Minimize2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { canSeeToken, hasPermission } from '@/lib/rolePermissions';
import { ephemeralBus } from '@/lib/net';

interface InitiativeTrackerCardContentProps {
  selectedTokenIds?: string[];
}

export function InitiativeTrackerCardContent({ selectedTokenIds = [] }: InitiativeTrackerCardContentProps) {
  const {
    currentTurnIndex,
    roundNumber,
    initiativeOrder,
    nextTurn,
    previousTurn,
    removeFromInitiative,
    reorderInitiative,
    updateInitiative,
    addToInitiative,
    resetRound,
    layoutFormat,
    setLayoutFormat
  } = useInitiativeStore();

  const { tokens, players, currentPlayerId } = useSessionStore();
  const { roles } = useRoleStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Local initiative values for the multi-select roll panel
  const [multiInitValues, setMultiInitValues] = useState<Record<string, string>>({});

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isDM = currentPlayer ? hasPermission(currentPlayer, roles, 'canSeeAllFog') : false;

  const handleNextTurn = () => {
    nextTurn();
    setTimeout(() => {
      const activeCard = scrollContainerRef.current?.querySelector('[data-active="true"]');
      activeCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
  };

  const handleCardClick = (tokenId: string) => {
    const event = new CustomEvent('centerOnToken', {
      detail: { tokenId }
    });
    window.dispatchEvent(event);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    try {
      ephemeralBus.emit('initiative.drag.preview', { entryIndex: index, targetIndex: index });
    } catch { /* net off */ }
  };

  const handleDragOver = (e: React.DragEvent, hoverIndex?: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoverIndex !== undefined) {
      try {
        ephemeralBus.emit('initiative.hover', { entryIndex: hoverIndex });
      } catch { /* net off */ }
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(draggedIndex) && draggedIndex !== dropIndex) {
      reorderInitiative(draggedIndex, dropIndex);
      toast.success('Initiative order updated');
    }
    // Clear hover preview
    try {
      ephemeralBus.emit('initiative.hover', { entryIndex: null });
    } catch { /* net off */ }
  };

  const totalCards = initiativeOrder.length + 1;
  const baseSize = 60;
  const maxSize = 75;
  const minSize = 45;
  
  let cardSize = baseSize;
  if (totalCards > 8) {
    cardSize = Math.max(minSize, baseSize * (8 / totalCards));
  } else if (totalCards < 5) {
    cardSize = Math.min(maxSize, baseSize * 1.1);
  }

  // Filter initiative order based on visibility
  const visibleInitiativeOrder = initiativeOrder.filter(entry => {
    const token = tokens.find(t => t.id === entry.tokenId);
    if (!token) return false;
    if (isDM) return true;
    if (currentPlayer) {
      return canSeeToken(token, currentPlayer, roles);
    }
    return true;
  });

  // Track which tokens are hidden (for DM view)
  const getIsHidden = (tokenId: string): boolean => {
    if (!isDM) return false;
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return false;
    return token.isHidden === true;
  };

  // Multi-select initiative panel: tokens selected in play mode that are not in initiative
  const multiSelectedTokens = selectedTokenIds.length > 1
    ? selectedTokenIds.map(id => tokens.find(t => t.id === id)).filter(Boolean)
    : [];

  const rollD20 = () => Math.floor(Math.random() * 20) + 1;

  const handleRollAll = () => {
    multiSelectedTokens.forEach(token => {
      if (!token) return;
      const roll = rollD20();
      setMultiInitValues(prev => ({ ...prev, [token.id]: String(roll) }));
    });
  };

  const handleCommitAll = () => {
    let count = 0;
    multiSelectedTokens.forEach(token => {
      if (!token) return;
      const raw = multiInitValues[token.id];
      const value = raw !== undefined ? parseInt(raw) : rollD20();
      if (!isNaN(value)) {
        addToInitiative(token.id, value);
        count++;
      }
    });
    setMultiInitValues({});
    if (count > 0) toast.success(`Added ${count} token${count !== 1 ? 's' : ''} to initiative`);
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#161a1d] text-muted-foreground w-full max-w-[340px] rounded-2xl border border-white/5 shadow-2xl overflow-hidden h-full">
      {/* Multi-select initiative panel — only visible when 2+ tokens are selected */}
      {multiSelectedTokens.length > 1 && (
        <div className="flex flex-col gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Swords className="h-4 w-4 text-[#e2a899]" />
            <span className="text-lg font-bold text-[#e2a899] font-serif tracking-wide">Group Initiative</span>
          </div>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {multiSelectedTokens.map(token => {
              if (!token) return null;
              const currentEntry = initiativeOrder.find(e => e.tokenId === token.id);
              return (
                <div key={token.id} className="flex items-center gap-3 bg-white/5 p-1.5 rounded-lg border border-white/5">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-white/10"
                    style={{
                      backgroundImage: token.imageUrl ? `url(${token.imageUrl})` : undefined,
                      backgroundColor: !token.imageUrl ? (token.color || '#888') : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  <span className="text-sm font-semibold text-[#8bb4ba] flex-1 min-w-0 truncate">
                    {token.label || token.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#e85d75]" />
                    <Input
                      type="number"
                      placeholder="d20"
                      value={multiInitValues[token.id] ?? ''}
                      onChange={e => setMultiInitValues(prev => ({ ...prev, [token.id]: e.target.value }))}
                      className="w-12 h-7 text-center text-sm font-bold p-0 px-1 bg-transparent border-none text-[#38bdf8] focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-6 text-xs"
              onClick={handleRollAll}
            >
              <Dices className="h-3 w-3 mr-1" />
              Roll All
            </Button>
            <Button
              size="sm"
              className="flex-1 h-6 text-xs"
              onClick={handleCommitAll}
            >
              Add to Init
            </Button>
          </div>
        </div>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
         <span className="text-xl font-bold text-[#e2a899] font-serif tracking-wide">Round {roundNumber}</span>
         
         {/* Format Toggle */}
         <ToggleGroup type="single" value={layoutFormat} onValueChange={(v) => v && setLayoutFormat(v as any)} size="sm" className="bg-black/20 rounded-lg p-0.5">
           <ToggleGroupItem value="vertical" className="h-6 w-6 p-0 rounded-md data-[state=on]:bg-[#38bdf8] data-[state=on]:text-background" title="Vertical Format">
             <AlignVerticalJustifyStart className="h-3 w-3" />
           </ToggleGroupItem>
           <ToggleGroupItem value="horizontal" className="h-6 w-6 p-0 rounded-md data-[state=on]:bg-[#38bdf8] data-[state=on]:text-background" title="Horizontal Format">
             <AlignHorizontalJustifyStart className="h-3 w-3" />
           </ToggleGroupItem>
           <ToggleGroupItem value="mini" className="h-6 w-6 p-0 rounded-md data-[state=on]:bg-[#38bdf8] data-[state=on]:text-background" title="Mini Format">
             <Minimize2 className="h-3 w-3" />
           </ToggleGroupItem>
         </ToggleGroup>
      </div>

      {/* Cards List */}
      <div 
        ref={scrollContainerRef}
        className="flex flex-col gap-2 overflow-y-auto flex-1 scrollbar-hide pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >

        {visibleInitiativeOrder.map((entry, index) => {
          const token = tokens.find(t => t.id === entry.tokenId);
          if (!token) return null;

          // Find the actual index in the full initiative order for drag/drop
          const actualIndex = initiativeOrder.findIndex(e => e.tokenId === entry.tokenId);

          return (
            <div
              key={entry.tokenId}
              data-active={actualIndex === currentTurnIndex}
            >
              <InitiativeCard
                token={token}
                initiative={entry.initiative}
                isActive={actualIndex === currentTurnIndex}
                hasGone={entry.hasGone}
                isHidden={getIsHidden(entry.tokenId)}
                onClick={() => handleCardClick(entry.tokenId)}
                onRemove={() => {
                  removeFromInitiative(entry.tokenId);
                  toast.success('Removed from initiative');
                }}
                onInitiativeChange={(newInit) => {
                  updateInitiative(entry.tokenId, newInit);
                  toast.success('Initiative updated');
                }}
                onDragStart={(e) => handleDragStart(e, actualIndex)}
                onDragOver={(e) => handleDragOver(e, actualIndex)}
                onDrop={(e) => handleDrop(e, actualIndex)}
                layout="vertical"
              />
            </div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-center gap-8 pt-2 pb-1 border-t border-white/5 opacity-80">
        <Button
          variant="ghost"
          size="icon"
          onClick={previousTurn}
          disabled={currentTurnIndex === 0 && roundNumber === 1}
          className="shrink-0 h-10 w-10 rounded-full hover:bg-white/10 hover:text-[#38bdf8] transition-colors"
        >
          <ChevronDown className="h-6 w-6 rotate-90" />
        </Button>
        <div className="flex flex-col items-center">
          <span className="text-xs font-semibold opacity-60">Round</span>
          <span className="text-sm font-bold">{currentTurnIndex + 1} of {visibleInitiativeOrder.length}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextTurn}
          className="shrink-0 h-10 w-10 rounded-full hover:bg-white/10 hover:text-[#38bdf8] transition-colors"
        >
          <ChevronDown className="h-6 w-6 -rotate-90" />
        </Button>
      </div>
    </div>
  );
}
