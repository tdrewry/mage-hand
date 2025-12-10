import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { InitiativeCard } from '@/components/InitiativeCard';
import { TurnCard } from '@/components/TurnCard';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { canSeeToken, hasPermission } from '@/lib/rolePermissions';

export function InitiativeTrackerCardContent() {
  const {
    currentTurnIndex,
    roundNumber,
    initiativeOrder,
    nextTurn,
    previousTurn,
    removeFromInitiative,
    reorderInitiative,
    updateInitiative,
    resetRound
  } = useInitiativeStore();

  const { tokens, players, currentPlayerId } = useSessionStore();
  const { roles } = useRoleStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(draggedIndex) && draggedIndex !== dropIndex) {
      reorderInitiative(draggedIndex, dropIndex);
      toast.success('Initiative order updated');
    }
  };

  const totalCards = initiativeOrder.length + 1;
  const baseSize = 60; // Reduced from 80
  const maxSize = 75;  // Reduced from 100
  const minSize = 45;  // Reduced from 60
  
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
    
    // DM can see all tokens
    if (isDM) return true;
    
    // For players, check if they can see the token
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

  return (
    <div className="flex items-end gap-1.5 p-1.5">
      <Button
        variant="ghost"
        size="icon"
        onClick={previousTurn}
        disabled={currentTurnIndex === 0 && roundNumber === 1}
        className="shrink-0 h-7 w-7 self-center"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div 
        ref={scrollContainerRef}
        className="flex items-end gap-1.5 overflow-x-auto flex-1 pb-2"
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
                onDragOver={handleDragOver}
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
        className="shrink-0 h-7 w-7 self-center"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
