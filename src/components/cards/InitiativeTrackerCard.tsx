import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InitiativeCard } from '@/components/InitiativeCard';
import { TurnCard } from '@/components/TurnCard';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { ChevronUp, ChevronDown, Swords, Dices } from 'lucide-react';
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
    resetRound
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
    <div className="flex flex-col items-center gap-1.5 p-1.5 bg-background/80 backdrop-blur-sm rounded-lg">
      {/* Multi-select initiative panel — only visible when 2+ tokens are selected */}
      {multiSelectedTokens.length > 1 && (
        <div className="w-full px-1.5 pb-1.5 border-b border-border mb-1">
          <div className="flex items-center gap-1 mb-1.5">
            <Swords className="h-3 w-3 text-primary" />
            <span className="text-xs font-semibold text-primary">Group Initiative</span>
          </div>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {multiSelectedTokens.map(token => {
              if (!token) return null;
              const currentEntry = initiativeOrder.find(e => e.tokenId === token.id);
              return (
                <div key={token.id} className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 border border-border"
                    style={{
                      backgroundImage: token.imageUrl ? `url(${token.imageUrl})` : undefined,
                      backgroundColor: !token.imageUrl ? (token.color || '#888') : undefined,
                      backgroundSize: 'cover',
                    }}
                  />
                  <span className="text-xs text-foreground truncate flex-1 min-w-0">
                    {token.label || token.name}
                    {currentEntry && (
                      <span className="text-muted-foreground ml-1">({currentEntry.initiative})</span>
                    )}
                  </span>
                  <Input
                    type="number"
                    placeholder="d20"
                    value={multiInitValues[token.id] ?? ''}
                    onChange={e => setMultiInitValues(prev => ({ ...prev, [token.id]: e.target.value }))}
                    className="w-12 h-5 text-center text-xs p-0 px-1"
                  />
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

      <Button
        variant="ghost"
        size="icon"
        onClick={previousTurn}
        disabled={currentTurnIndex === 0 && roundNumber === 1}
        className="shrink-0 h-7 w-7"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      <div 
        ref={scrollContainerRef}
        className="flex flex-col items-end gap-1.5 overflow-y-auto flex-1 px-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <TurnCard
          turnNumber={currentTurnIndex + 1}
          roundNumber={roundNumber}
          totalTokens={visibleInitiativeOrder.length}
          isCompact={true}
          size={cardSize}
          onResetRound={resetRound}
        />

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
                isCompact={true}
                size={cardSize}
              />
            </div>
          );
        })}
      </div>

      <Button
        variant="default"
        size="icon"
        onClick={handleNextTurn}
        className="shrink-0 h-7 w-7"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
