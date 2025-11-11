import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { InitiativeCard } from '@/components/InitiativeCard';
import { InitiativeEntryModal } from '@/components/InitiativeEntryModal';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface RosterCardContentProps {
  cardId: string;
}

export function RosterCardContent({ cardId }: RosterCardContentProps) {
  const {
    initiativeOrder,
    removeFromInitiative,
    reorderInitiative,
    updateInitiative,
  } = useInitiativeStore();

  const { tokens } = useSessionStore();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const availableTokens = tokens;

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Initiative Roster</span>
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
        onAddToInitiative={(tokenId, initiative) => {
          useInitiativeStore.getState().addToInitiative(tokenId, initiative);
          toast.success('Added to initiative');
        }}
      />
    </div>
  );
}
