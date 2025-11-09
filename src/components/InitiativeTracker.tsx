import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { InitiativeCard } from './InitiativeCard';
import { InitiativeEntryModal } from './InitiativeEntryModal';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { 
  Swords, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  RotateCcw,
  Trash2,
  Minimize2,
  Maximize2
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
    startCombat,
    endCombat,
    nextTurn,
    previousTurn,
    removeFromInitiative,
    reorderInitiative,
    updateInitiative,
    setTrackerVisible,
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

  return (
    <>
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-[90vw]">
        <div className="bg-card/95 backdrop-blur-sm border-2 border-border rounded-lg shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-3">
              <Swords className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-bold text-foreground">Initiative Tracker</h3>
                {isInCombat && (
                  <p className="text-xs text-muted-foreground">
                    Round {roundNumber} • {currentToken?.label || currentToken?.name || 'No active token'}'s turn
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isInCombat ? (
                <>
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
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetRound}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Round
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleEndCombat}
                  >
                    End Combat
                  </Button>
                </>
              )}
              
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
                  className="flex gap-3 p-4 overflow-x-auto"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {initiativeOrder.map((entry, index) => {
                    const token = tokens.find(t => t.id === entry.tokenId);
                    if (!token) return null;

                    return (
                      <div
                        key={entry.tokenId}
                        data-active={isInCombat && index === currentTurnIndex}
                      >
                        <InitiativeCard
                          token={token}
                          initiative={entry.initiative}
                          isActive={isInCombat && index === currentTurnIndex}
                          hasGone={entry.hasGone}
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

              {/* Turn Controls */}
              {isInCombat && initiativeOrder.length > 0 && (
                <div className="flex items-center justify-center gap-4 px-4 pb-4">
                  <Button
                    variant="outline"
                    onClick={previousTurn}
                    disabled={currentTurnIndex === 0 && roundNumber === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  
                  <div className="px-6 py-2 bg-primary/10 border border-primary rounded-lg">
                    <span className="text-sm font-medium text-primary">
                      Turn {currentTurnIndex + 1} of {initiativeOrder.length}
                    </span>
                  </div>

                  <Button
                    variant="default"
                    onClick={handleNextTurn}
                  >
                    End Turn
                    <ChevronRight className="h-4 w-4 ml-2" />
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
