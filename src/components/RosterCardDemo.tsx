import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { Users } from 'lucide-react';

export function RosterCardDemo() {
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);
  
  const rosterCard = cards.find((c) => c.type === CardType.ROSTER);

  const handleToggleRoster = () => {
    if (rosterCard) {
      setVisibility(rosterCard.id, !rosterCard.isVisible);
    } else {
      registerCard({
        type: CardType.ROSTER,
        title: 'Roster',
        defaultPosition: { x: window.innerWidth - 320, y: 80 },
        defaultSize: { width: 300, height: 500 },
        minSize: { width: 250, height: 300 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        onClick={handleToggleRoster}
        variant="default"
        size="sm"
      >
        <Users className="h-4 w-4 mr-2" />
        {rosterCard?.isVisible ? 'Hide' : 'Show'} Roster
      </Button>
    </div>
  );
}
