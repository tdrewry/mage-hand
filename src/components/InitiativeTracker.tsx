import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { InitiativeCard } from '@/components/InitiativeCard';
import { TurnCard } from '@/components/TurnCard';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export function InitiativeTracker() {
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

  const { tokens } = useSessionStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  const baseSize = 100;
  const maxSize = 120;
  const minSize = 80;
  
  let cardSize = baseSize;
  if (totalCards > 8) {
    cardSize = Math.max(minSize, baseSize * (8 / totalCards));
  } else if (totalCards < 5) {
    cardSize = Math.min(maxSize, baseSize * 1.2);
  }

  return (
    <div 
      className="fixed bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2 flex items-center gap-2"
      style={{ 
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={previousTurn}
        disabled={currentTurnIndex === 0 && roundNumber === 1}
        className="shrink-0"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div 
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto max-w-[800px]"
      >
        <TurnCard
          turnNumber={currentTurnIndex + 1}
          roundNumber={roundNumber}
          totalTokens={initiativeOrder.length}
          isCompact={false}
          size={cardSize}
          onResetRound={resetRound}
        />

        {initiativeOrder.map((entry, index) => {
          const token = tokens.find(t => t.id === entry.tokenId);
          if (!token) return null;

          return (
            <div
              key={entry.tokenId}
              data-active={index === currentTurnIndex}
            >
              <InitiativeCard
                token={token}
                initiative={entry.initiative}
                isActive={index === currentTurnIndex}
                hasGone={entry.hasGone}
                onClick={() => handleCardClick(entry.tokenId)}
                onRemove={() => {
                  removeFromInitiative(entry.tokenId);
                  toast.success('Removed from initiative');
                }}
                onInitiativeChange={(newInit) => {
                  updateInitiative(entry.tokenId, newInit);
                  toast.success('Initiative updated');
                }}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                isCompact={false}
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
        className="shrink-0"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
