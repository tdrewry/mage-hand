import { useEffect } from 'react';
import { BaseCard } from '@/components/cards/BaseCard';
import { RosterCardContent } from '@/components/cards/RosterCard';
import { FogControlCardContent } from '@/components/cards/FogControlCard';
import { LayerStackCardContent } from '@/components/cards/LayerStackCard';
import { TokenPanelCardContent } from '@/components/cards/TokenPanelCard';
import { MapControlsCardContent } from '@/components/cards/MapControlsCard';
import { MapManagerCardContent } from '@/components/cards/MapManagerCard';
import { WatabouImportCardContent } from '@/components/cards/WatabouImportCard';
import { BackgroundGridCardContent } from '@/components/cards/BackgroundGridCard';
import { ProjectManagerCardContent } from '@/components/cards/ProjectManagerCard';
import { InitiativeTrackerCardContent } from '@/components/cards/InitiativeTrackerCard';
import { MenuCardContent } from '@/components/cards/MenuCard';
import { MapCardContent } from '@/components/cards/MapCard';
import { StylesCardContent } from '@/components/cards/StylesCard';
import { RegionControlsCardContent } from '@/components/cards/RegionControlsCard';
import { VisionProfileManagerCardContent } from '@/components/cards/VisionProfileManagerCard';
import RoleManagerCard from '@/components/cards/RoleManagerCard';
import { HistoryCard } from '@/components/cards/HistoryCard';
import { useCardStore } from '@/stores/cardStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { CardType } from '@/types/cardTypes';
import { TransformMode } from '@/components/RegionControlPanel';

interface CardManagerProps {
  children?: React.ReactNode;
  sessionId?: string;
  toolsCardProps?: any; // Keep for backward compatibility but not used
  activeRegionId?: string | null;
  transformMode?: TransformMode;
  onTransformModeChange?: (mode: TransformMode) => void;
  onToggleSnapping?: (id: string) => void;
  onToggleGridVisibility?: (id: string) => void;
}

export function CardManager({ 
  children, 
  sessionId, 
  toolsCardProps,
  activeRegionId,
  transformMode = 'move',
  onTransformModeChange = () => {},
  onToggleSnapping = () => {},
  onToggleGridVisibility = () => {}
}: CardManagerProps) {
  const cards = useCardStore((state) => state.cards);
  const loadLayout = useCardStore((state) => state.loadLayout);
  const { addToken } = useSessionStore();
  const { renderingMode } = useDungeonStore();

  // Load saved layout on mount
  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  // Wrapper function to convert token panel params to Token object
  const handleAddToken = (
    imageUrl: string, 
    x: number = 100, 
    y: number = 100, 
    gridWidth: number = 1, 
    gridHeight: number = 1, 
    color?: string
  ) => {
    const tokenId = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToken = {
      id: tokenId,
      name: `Token ${tokenId.slice(-4)}`,
      imageUrl,
      x,
      y,
      gridWidth,
      gridHeight,
      label: `Token ${tokenId.slice(-4)}`,
      color,
      roleId: 'player', // Default to player role
      isHidden: false,
    };
    addToken(newToken);
  };

  return (
    <>
      {children}
      
      {/* Render all registered cards */}
      {cards.map((card) => {
        const content = renderCardContent(
          card.id, 
          card.type, 
          handleAddToken, 
          sessionId,
          activeRegionId,
          transformMode,
          onTransformModeChange,
          onToggleSnapping,
          onToggleGridVisibility
        );
        return (
          <BaseCard
            key={card.id}
            id={card.id}
            title={getCardTitle(card.type)}
            isResizable={true}
            isClosable={card.type !== CardType.MAP && card.type !== CardType.MENU}
            hideHeader={card.hideHeader}
            fullCardDraggable={card.fullCardDraggable}
          >
            {content}
          </BaseCard>
        );
      })}
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
    [CardType.MAP_MANAGER]: 'Map Manager',
    [CardType.GROUP_MANAGER]: 'Group Manager',
    [CardType.PROJECT_MANAGER]: 'Project Manager',
    [CardType.REGION_CONTROL]: 'Region Control',
    [CardType.WATABOU_IMPORT]: 'Watabou Import',
    [CardType.BACKGROUND_GRID]: 'Background & Grid',
    [CardType.INITIATIVE_TRACKER]: 'Initiative Tracker',
    [CardType.STYLES]: 'Styles',
    [CardType.VISION_PROFILE_MANAGER]: 'Vision Profile Manager',
    [CardType.ROLE_MANAGER]: 'Role Manager',
    [CardType.HISTORY]: 'History',
  };
  
  return titles[type] || type;
}

// Helper function to render card-specific content
function renderCardContent(
  cardId: string, 
  type: CardType, 
  addToken: (imageUrl: string, x?: number, y?: number, gridWidth?: number, gridHeight?: number, color?: string) => void,
  sessionId?: string,
  activeRegionId?: string | null,
  transformMode?: TransformMode,
  onTransformModeChange?: (mode: TransformMode) => void,
  onToggleSnapping?: (id: string) => void,
  onToggleGridVisibility?: (id: string) => void
): React.ReactNode {
  switch (type) {
    case CardType.MENU:
      return <MenuCardContent sessionId={sessionId} />;
    case CardType.TOOLS:
      return null; // TOOLS card removed - replaced by VerticalToolbar
    case CardType.ROSTER:
      return <RosterCardContent cardId={cardId} />;
    case CardType.FOG:
      return <FogControlCardContent />;
    case CardType.LAYERS:
      return <LayerStackCardContent />;
    case CardType.TOKENS:
      return <TokenPanelCardContent onAddToken={addToken} />;
    case CardType.MAP_CONTROLS:
      return <MapControlsCardContent fabricCanvas={null} />; // TODO: Pass actual fabricCanvas
    case CardType.MAP_MANAGER:
      return <MapManagerCardContent />;
    case CardType.WATABOU_IMPORT:
      return <WatabouImportCardContent />;
    case CardType.BACKGROUND_GRID:
      return (
        <BackgroundGridCardContent
          fabricCanvas={null}
          gridColor="#000000"
          gridOpacity={50}
          onGridColorChange={() => {}}
          onGridOpacityChange={() => {}}
        />
      );
    case CardType.PROJECT_MANAGER:
      return (
        <ProjectManagerCardContent
          viewport={{ x: 0, y: 0, zoom: 1 }}
        />
      );
    case CardType.INITIATIVE_TRACKER:
      return <InitiativeTrackerCardContent />;
    case CardType.MAP:
      return <MapCardContent />;
    case CardType.STYLES:
      return <StylesCardContent />;
    case CardType.REGION_CONTROL:
      return (
        <RegionControlsCardContent 
          regionId={activeRegionId || null}
          transformMode={transformMode || 'move'}
          onTransformModeChange={onTransformModeChange || (() => {})}
          onToggleSnapping={onToggleSnapping || (() => {})}
          onToggleGridVisibility={onToggleGridVisibility || (() => {})}
        />
      );
    case CardType.VISION_PROFILE_MANAGER:
      return <VisionProfileManagerCardContent />;
    case CardType.ROLE_MANAGER:
      return <RoleManagerCard />;
    case CardType.HISTORY:
      return <HistoryCard />;
    case CardType.GROUP_MANAGER:
      return <div className="text-muted-foreground text-sm">Content for {type} coming soon...</div>;
    default:
      return <div className="text-muted-foreground text-sm">Unknown card type</div>;
  }
}
