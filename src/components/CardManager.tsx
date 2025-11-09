import { useEffect } from 'react';
import { BaseCard } from '@/components/cards/BaseCard';
import { RosterCardContent } from '@/components/cards/RosterCard';
import { FogControlCardContent } from '@/components/cards/FogControlCard';
import { LayerStackCardContent } from '@/components/cards/LayerStackCard';
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
          {renderCardContent(card.id, card.type)}
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

// Helper function to render card-specific content
function renderCardContent(cardId: string, type: CardType): React.ReactNode {
  switch (type) {
    case CardType.ROSTER:
      return <RosterCardContent cardId={cardId} />;
    case CardType.FOG:
      return <FogControlCardContent />;
    case CardType.LAYERS:
      return <LayerStackCardContent />;
    case CardType.MAP:
    case CardType.MENU:
    case CardType.TOOLS:
    case CardType.TOKENS:
    case CardType.MAP_CONTROLS:
    case CardType.GROUP_MANAGER:
    case CardType.PROJECT_MANAGER:
    case CardType.REGION_CONTROL:
    case CardType.WATABOU_IMPORT:
    case CardType.BACKGROUND_GRID:
      return <div className="text-muted-foreground text-sm">Content for {type} coming soon...</div>;
    default:
      return <div className="text-muted-foreground text-sm">Unknown card type</div>;
  }
}
