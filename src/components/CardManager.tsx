import { useEffect } from 'react';
import { BaseCard } from '@/components/cards/BaseCard';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';

interface CardManagerProps {
  children?: React.ReactNode;
}

export function CardManager({ children }: CardManagerProps) {
  const cards = useCardStore((state) => state.cards);
  const loadLayout = useCardStore((state) => state.loadLayout);

  // Load saved layout on mount
  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  return (
    <>
      {children}
      
      {/* Render all registered cards */}
      {cards.map((card) => (
        <BaseCard
          key={card.id}
          id={card.id}
          title={getCardTitle(card.type)}
          isResizable={true}
          isClosable={card.type !== CardType.MAP && card.type !== CardType.MENU}
        >
          {/* Card content will be provided by specific card components */}
          <div>Card content for {card.type}</div>
        </BaseCard>
      ))}
    </>
  );
}

// Helper function to get card titles
function getCardTitle(type: CardType): string {
  const titles: Record<CardType, string> = {
    [CardType.MAP]: 'Map View',
    [CardType.MENU]: 'Menu',
    [CardType.ROSTER]: 'Roster',
    [CardType.TOOLS]: 'Tools',
    [CardType.FOG]: 'Fog Control',
    [CardType.LAYERS]: 'Layer Stack',
    [CardType.TOKENS]: 'Token Panel',
    [CardType.MAP_CONTROLS]: 'Map Controls',
    [CardType.GROUP_MANAGER]: 'Group Manager',
    [CardType.PROJECT_MANAGER]: 'Project Manager',
    [CardType.REGION_CONTROL]: 'Region Control',
    [CardType.WATABOU_IMPORT]: 'Watabou Import',
    [CardType.BACKGROUND_GRID]: 'Background Grid',
  };
  
  return titles[type] || type;
}
