import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { InitiativeCard } from './InitiativeCard';
import { TurnCard } from './TurnCard';
import { InitiativeEntryModal } from './InitiativeEntryModal';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { 
  Swords, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  RotateCcw,
  Minimize2,
  Maximize2,
  Lock,
  LockOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const InitiativeTracker: React.FC = () => {
  const {
    isInCombat,
    currentTurnIndex,
    roundNumber,
    initiativeOrder,
    isTrackerVisible,
    restrictMovement,
    startCombat,
    endCombat,
    nextTurn,
    previousTurn,
    removeFromInitiative,
    reorderInitiative,
    updateInitiative,
    setTrackerVisible,
    setRestrictMovement,
    resetRound
  } = useInitiativeStore();

  const { tokens } = useSessionStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter tokens that are on the map
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
    // Scroll to active card
    setTimeout(() => {
      const activeCard = scrollContainerRef.current?.querySelector('[data-active="true"]');
      activeCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
  };

  const handleCardClick = (tokenId: string) => {
    // Dispatch event to center map on token
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

  const currentEntry = initiativeOrder[currentTurnIndex];
  const currentToken = currentEntry ? tokens.find(t => t.id === currentEntry.tokenId) : null;

  if (!isTrackerVisible) {
    return null;
  }

  // Combat mode: streamlined horizontal layout
  if (isInCombat) {
    // Calculate card size based on number of tokens
    const totalCards = initiativeOrder.length + 1; // +1 for turn card
    const baseSize = isMinimized ? 80 : 120;
    const maxSize = isMinimized ? 100 : 140;
    const minSize = isMinimized ? 60 : 80;
    
    // Scale cards to fit available space
    let cardSize = baseSize;
    if (totalCards > 8) {
      cardSize = Math.max(minSize, baseSize * (8 / totalCards));
    } else if (totalCards < 5) {
      cardSize = Math.min(maxSize, baseSize * 1.2);
    }

    return (
      <>
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-[90vw]">
          <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-lg shadow-2xl">
            <div className="flex items-center gap-2 p-2">
              {/* Previous Turn Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={previousTurn}
                disabled={currentTurnIndex === 0 && roundNumber === 1}
                className="shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {/* Scaled Token/Turn Cards */}
              <div 
                ref={scrollContainerRef}
                className="flex gap-2 flex-1 justify-center"
              >
                {/* Turn Card */}
                <TurnCard
                  turnNumber={currentTurnIndex + 1}
                  roundNumber={roundNumber}
                  totalTokens={initiativeOrder.length}
                  isCompact={isMinimized}
                  size={cardSize}
                />

                {/* Token Cards */}
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
                        isCompact={isMinimized}
                        size={cardSize}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Next Turn Button */}
              <Button
                variant="default"
                size="icon"
                onClick={handleNextTurn}
                className="shrink-0"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              {/* Controls - only show when expanded */}
              {!isMinimized && (
                <>
                  <div className="h-8 w-px bg-border mx-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRestrictMovement(!restrictMovement)}
                    title={restrictMovement ? "Only active token can move" : "All tokens can move"}
                    className="shrink-0"
                  >
                    {restrictMovement ? (
                      <Lock className="h-4 w-4 mr-2" />
                    ) : (
                      <LockOpen className="h-4 w-4 mr-2" />
                    )}
                    {restrictMovement ? 'Locked' : 'Free'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetRound}
                    className="shrink-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleEndCombat}
                    className="shrink-0"
                  >
                    End
                  </Button>
                </>
              )}

              {/* Minimize/Maximize Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
                className="shrink-0"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <InitiativeEntryModal
          open={showAddModal}
          onOpenChange={setShowAddModal}
          tokens={availableTokens}
          onAddToInitiative={handleAddToInitiative}
        />
      </>
    );
  }

  // Setup mode: traditional layout with header and controls
  return (
    <>
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-[90vw]">
        <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-3">
              <Swords className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-foreground">Initiative Tracker</h3>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddModal(true)}
                disabled={availableTokens.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tokens
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleStartCombat}
                disabled={initiativeOrder.length === 0}
              >
                <Swords className="h-4 w-4 mr-2" />
                Start Combat
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <>
              {/* Initiative Cards */}
              {initiativeOrder.length > 0 ? (
                <div 
                  ref={scrollContainerRef}
                  className="flex gap-3 p-4 flex-wrap justify-center"
                >
                  {initiativeOrder.map((entry, index) => {
                    const token = tokens.find(t => t.id === entry.tokenId);
                    if (!token) return null;

                    return (
                      <div
                        key={entry.tokenId}
                      >
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
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <p>No tokens in initiative</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowAddModal(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tokens
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <InitiativeEntryModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        tokens={availableTokens}
        onAddToInitiative={handleAddToInitiative}
      />
    </>
  );
};
