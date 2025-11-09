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
  Swords, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

interface RosterCardContentProps {
  cardId: string;
}

export function RosterCardContent({ cardId }: RosterCardContentProps) {
  const {
    isInCombat,
    currentTurnIndex,
    roundNumber,
    initiativeOrder,
    startCombat,
    endCombat,
    nextTurn,
    previousTurn,
    removeFromInitiative,
    reorderInitiative,
    updateInitiative,
    resetRound
  } = useInitiativeStore();

  const { tokens } = useSessionStore();
  const card = useCardStore((state) => state.getCard(cardId));
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isMinimized = card?.isMinimized || false;
  const availableTokens = tokens;

  const handleAddToInitiative = (tokenId: string, initiative: number) => {
    useInitiativeStore.getState().addToInitiative(tokenId, initiative);
    toast.success('Added to initiative');
  };

  const handleStartCombat = () => {
    if (initiativeOrder.length === 0) {
      toast.error('Add tokens to initiative first');
      return;
    }
    startCombat();
    toast.success('Combat started!');
  };

  const handleEndCombat = () => {
    endCombat();
    toast.success('Combat ended');
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

  // Combat mode: horizontal layout
  if (isInCombat) {
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
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

        <Button
          variant="outline"
          size="sm"
          onClick={handleEndCombat}
          className="w-full"
        >
          End Combat
        </Button>

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
          <Swords className="h-4 w-4 text-primary" />
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

          <Button
            variant="default"
            onClick={handleStartCombat}
            className="w-full"
          >
            Start Combat
          </Button>
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
