import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { InitiativeCard } from '@/components/InitiativeCard';
import { TurnCard } from '@/components/TurnCard';
import { InitiativeEntryModal } from '@/components/InitiativeEntryModal';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus
} from 'lucide-react';
import { toast } from 'sonner';

interface RosterCardContentProps {
  cardId: string;
}

export function RosterCardContent({ cardId }: RosterCardContentProps) {
  return {
    minimizedContent: renderMinimizedCombatView(cardId),
    fullContent: renderFullView(cardId)
  };
}

function renderMinimizedCombatView(cardId: string) {
  const {
    isInCombat,
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
  const card = useCardStore((state) => state.getCard(cardId));
  const updateCardPosition = useCardStore((state) => state.updateCardPosition);
  const updateCardSize = useCardStore((state) => state.updateCardSize);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-dock to top-middle when minimized in combat
  useEffect(() => {
    if (card && card.isMinimized && isInCombat) {
      const dockedPosition = {
        x: window.innerWidth / 2 - 400, // Center horizontally (assuming 800px width)
        y: 80 // Below main menu
      };
      const dockedSize = {
        width: 800,
        height: 120
      };
      
      updateCardPosition(cardId, dockedPosition);
      updateCardSize(cardId, dockedSize);
    }
  }, [card?.isMinimized, isInCombat, cardId, card, updateCardPosition, updateCardSize]);

  const handleAddToInitiative = (tokenId: string, initiative: number) => {
    useInitiativeStore.getState().addToInitiative(tokenId, initiative);
    toast.success('Added to initiative');
  };

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
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      reorderInitiative(draggedIndex, dropIndex);
      toast.success('Initiative order updated');
    }
    setDraggedIndex(null);
  };

  if (!isInCombat) return null;
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
    <div className="flex items-center gap-2 p-2">
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
        className="flex gap-2 flex-1 overflow-x-auto"
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
                onClick={() => {
                  const event = new CustomEvent('centerOnToken', {
                    detail: { tokenId: entry.tokenId }
                  });
                  window.dispatchEvent(event);
                }}
                onRemove={() => {
                  removeFromInitiative(entry.tokenId);
                  toast.success('Removed from initiative');
                }}
                onInitiativeChange={(newInit) => {
                  updateInitiative(entry.tokenId, newInit);
                  toast.success('Initiative updated');
                }}
                onDragStart={(e) => {
                  setDraggedIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedIndex !== null && draggedIndex !== index) {
                    reorderInitiative(draggedIndex, index);
                    toast.success('Initiative order updated');
                  }
                  setDraggedIndex(null);
                }}
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
        onClick={() => {
          nextTurn();
          setTimeout(() => {
            const activeCard = scrollContainerRef.current?.querySelector('[data-active="true"]');
            activeCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }, 100);
        }}
        className="shrink-0"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      <InitiativeEntryModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        tokens={tokens}
        onAddToInitiative={(tokenId, initiative) => {
          useInitiativeStore.getState().addToInitiative(tokenId, initiative);
          toast.success('Added to initiative');
        }}
      />
    </div>
  );
}

function renderFullView(cardId: string) {

  const {
    isInCombat,
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
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const availableTokens = tokens;

  const handleAddToInitiative = (tokenId: string, initiative: number) => {
    useInitiativeStore.getState().addToInitiative(tokenId, initiative);
    toast.success('Added to initiative');
  };

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
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      reorderInitiative(draggedIndex, dropIndex);
      toast.success('Initiative order updated');
    }
    setDraggedIndex(null);
  };

  // Combat mode: vertical layout
  if (isInCombat) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Turn {currentTurnIndex + 1} - Round {roundNumber}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={previousTurn}
              disabled={currentTurnIndex === 0 && roundNumber === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleNextTurn}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex flex-wrap gap-2 max-h-[500px] overflow-y-auto"
        >
          {initiativeOrder.map((entry, index) => {
            const token = tokens.find(t => t.id === entry.tokenId);
            if (!token) return null;

            return (
              <div key={entry.tokenId}>
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
                  size={100}
                />
              </div>
            );
          })}
        </div>

        <InitiativeEntryModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
          tokens={availableTokens}
          onAddToInitiative={handleAddToInitiative}
        />
      </div>
    );
  }

  // Setup mode: traditional layout
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Initiative</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddModal(true)}
          disabled={availableTokens.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {initiativeOrder.length > 0 ? (
        <>
          <div 
            ref={scrollContainerRef}
            className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto"
          >
            {initiativeOrder.map((entry, index) => {
              const token = tokens.find(t => t.id === entry.tokenId);
              if (!token) return null;

              return (
                <div key={entry.tokenId}>
                  <InitiativeCard
                    token={token}
                    initiative={entry.initiative}
                    isActive={false}
                    hasGone={false}
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
                    size={100}
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          <p className="text-sm mb-3">No tokens in initiative</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tokens
          </Button>
        </div>
      )}

      <InitiativeEntryModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        tokens={availableTokens}
        onAddToInitiative={handleAddToInitiative}
      />
    </div>
  );
}
