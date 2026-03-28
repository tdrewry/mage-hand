import { BaseCard } from '@/components/cards/BaseCard';
import { RosterCardContent } from '@/components/cards/RosterCard';
import { FogControlCardContent } from '@/components/cards/FogControlCard';
import { TokenPanelCardContent } from '@/components/cards/TokenPanelCard';
import { MapControlsCardContent } from '@/components/cards/MapControlsCard';
import { MapManagerCardContent } from '@/components/cards/MapManagerCard';
import { WatabouImportCardContent } from '@/components/cards/WatabouImportCard';
import { ProjectManagerCardContent } from '@/components/cards/ProjectManagerCard';
import { InitiativeTrackerCardContent } from '@/components/cards/InitiativeTrackerCard';
import { StylesCardContent } from '@/components/cards/StylesCard';
import { RegionControlsCardContent } from '@/components/cards/RegionControlsCard';
import { VisionProfileManagerCardContent } from '@/components/cards/VisionProfileManagerCard';
import { MapObjectPanelCardContent } from '@/components/cards/MapObjectPanelCard';
import RoleManagerCard from '@/components/cards/RoleManagerCard';
import { HistoryCard } from '@/components/cards/HistoryCard';
import { CreatureLibraryCardContent } from '@/components/cards/CreatureLibraryCard';
import { MonsterStatBlockCardContent } from '@/components/cards/MonsterStatBlockCard';
import { LibraryEditorCardContent } from '@/components/cards/LibraryEditorCard';
import { CharacterSheetCardContent } from '@/components/cards/CharacterSheetCard';
import { DiceCardContent } from '@/components/cards/DiceCard';
import { ActionCardContent } from '@/components/cards/ActionCard';
import { NetworkDemoCardContent } from '@/components/cards/NetworkDemoCard';
import { EffectsCatalog } from '@/components/rules/MapTemplatesCatalog';
import { ChatCardContent } from '@/components/cards/ChatCard';
import { ArtApprovalCardContent } from '@/components/cards/ArtApprovalCard';
import { SoundSettingsCardContent } from '@/components/cards/SoundSettingsCard';
import { HandoutCatalogCardContent } from '@/components/cards/HandoutCatalogCard';
import { HandoutViewerCardContent } from '@/components/cards/HandoutViewerCard';
import { CampaignEditorCardContent } from '@/components/cards/CampaignEditorCard';
import { TokenGroupManagerCardContent } from '@/components/cards/TokenGroupManagerCard';
import { ActionDeclareCardContent } from '@/components/cards/ActionDeclareCard';
import { CompendiumCardContent } from '@/components/cards/CompendiumCard';
import { EnvironmentCardContent } from '@/components/cards/EnvironmentCard';
import { PlayCardContent } from '@/components/cards/PlayCard';
import { CampaignCardContent } from '@/components/cards/CampaignCard';
import { RulesCardContent } from '@/components/cards/RulesCard';
import React, { Suspense, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCardStore } from '@/stores/cardStore';
import { useSessionStore, type LabelPosition } from '@/stores/sessionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { CardType, CardState, DM_ONLY_CARD_TYPES } from '@/types/cardTypes';

const LazyMapTreeCardContent = React.lazy(() =>
  import('@/components/cards/MapTreeCard').then(m => ({ default: m.MapTreeCardContent }))
);

interface CardManagerProps {
  children?: React.ReactNode;
  sessionId?: string;
  toolsCardProps?: any; // Keep for backward compatibility but not used
  activeRegionId?: string | null;
  onToggleSnapping?: (id: string) => void;
  onToggleGridVisibility?: (id: string) => void;
}

export function CardManager({ 
  children, 
  sessionId, 
  activeRegionId,
  onToggleSnapping = () => {},
  onToggleGridVisibility = () => {}
}: CardManagerProps) {
  const cards = useCardStore((state) => state.cards);
  const loadLayout = useCardStore((state) => state.loadLayout);
  const { addToken, players, currentPlayerId } = useSessionStore();
  const { renderingMode } = useDungeonStore();

  // Determine if current user is DM for card gating
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isDM = currentPlayer?.roleIds?.includes('dm') || false;

  // Force a re-render after initial mount so portals can find the sidebar DOM nodes
  const [isMounted, setIsMounted] = useState(false);

  // Load saved layout on mount
  useEffect(() => {
    loadLayout();
    // Allow the DOM to render the sidebars first before we attempt to query their portals
    requestAnimationFrame(() => setIsMounted(true));
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
      labelPosition: 'below' as LabelPosition,
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
      {isMounted && cards.filter(card => isDM || !DM_ONLY_CARD_TYPES.has(card.type)).map((card) => {
        const content = renderCardContent(
          card,
          handleAddToken, 
          sessionId,
          activeRegionId,
          onToggleSnapping,
          onToggleGridVisibility
        );
        
        const cardComponent = (
          <BaseCard
            key={card.id}
            id={card.id}
            title={getCardTitle(card.type)}
            isResizable={true}
            isClosable={true}
            hideHeader={card.hideHeader}
            fullCardDraggable={card.fullCardDraggable}
            scrollable={getCardScrollable(card.type)}
          >
            {content}
          </BaseCard>
        );

        if (card.dockPosition === 'left') {
          const leftNode = document.getElementById('left-sidebar-content');
          if (leftNode) return createPortal(cardComponent, leftNode);
        }
        
        if (card.dockPosition === 'right') {
          const rightNode = document.getElementById('right-sidebar-content');
          if (rightNode) return createPortal(cardComponent, rightNode);
        }

        return cardComponent;
      })}
    </>
  );
}

// Helper function to get card titles
function getCardTitle(type: CardType): string {
  const titles: Partial<Record<CardType, string>> = {
    [CardType.ROSTER]: 'Roster',
    [CardType.FOG]: 'Fog Control',
    [CardType.TOKENS]: 'Token Panel',
    [CardType.MAP_CONTROLS]: 'Map Controls',
    [CardType.MAP_MANAGER]: 'Map Manager',
    [CardType.GROUP_MANAGER]: 'Group Manager',
    [CardType.PROJECT_MANAGER]: 'Project Manager',
    [CardType.REGION_CONTROL]: 'Region Control',
    [CardType.WATABOU_IMPORT]: 'Import',
    [CardType.INITIATIVE_TRACKER]: 'Initiative Tracker',
    [CardType.STYLES]: 'Map',
    [CardType.VISION_PROFILE_MANAGER]: 'Vision Profile Manager',
    [CardType.ROLE_MANAGER]: 'Role Manager',
    [CardType.HISTORY]: 'History',
    [CardType.MAP_OBJECTS]: 'Map Objects',
    [CardType.CHARACTER_SHEET]: 'Character Sheet',
    [CardType.MONSTER_STAT_BLOCK]: 'Monster Stat Block',
    [CardType.CREATURE_LIBRARY]: 'Library',
    [CardType.MAP_TREE]: 'Map Tree',
    [CardType.DICE_BOX]: 'Dice Box',
    [CardType.ACTION_CARD]: 'Action',
    [CardType.ACTION_DECLARE_CARD]: 'Declare Action',
    [CardType.NETWORK_DEMO]: 'Network Demo',
    [CardType.EFFECTS]: 'Effects',
    [CardType.CHAT]: 'Chat',
    [CardType.ART_APPROVAL]: 'Art Approval',
    [CardType.SOUND_SETTINGS]: 'Sound Settings',
    [CardType.HANDOUT_CATALOG]: 'Handouts',
    [CardType.HANDOUT_VIEWER]: 'Handout',
    [CardType.CAMPAIGN_EDITOR]: 'Campaign Editor',
    [CardType.TOKEN_GROUP_MANAGER]: 'Token Groups',
    [CardType.LIBRARY_EDITOR]: 'Library Editor',
    [CardType.COMPENDIUM]: 'Compendium',
    [CardType.ENVIRONMENT]: 'Environment',
    [CardType.PLAY]: 'Play',
    [CardType.CAMPAIGN]: 'Campaign',
    [CardType.RULES]: 'Rules',
  };
  return titles[type] || type;
}

// Helper to determine if a card type should let BaseCard handle scrolling, or if it manages its own.
function getCardScrollable(type: CardType): boolean {
  const nonScrollableTypes = new Set<CardType>([
    CardType.ENVIRONMENT,
    CardType.MAP_MANAGER,
    CardType.MAP_TREE,
    CardType.STYLES,
    CardType.FOG,
    CardType.VISION_PROFILE_MANAGER,
    CardType.MAP_OBJECTS,
    CardType.CAMPAIGN_EDITOR,
    CardType.PLAY,
    CardType.CAMPAIGN,
  ]);
  
  return !nonScrollableTypes.has(type);
}

// Helper function to render card-specific content
function renderCardContent(
  card: CardState, 
  addToken: (imageUrl: string, x?: number, y?: number, gridWidth?: number, gridHeight?: number, color?: string) => void,
  sessionId?: string,
  activeRegionId?: string | null,
  onToggleSnapping?: (id: string) => void,
  onToggleGridVisibility?: (id: string) => void
): React.ReactNode {
  const { id: cardId, type, metadata } = card;
  
  switch (type) {
    case CardType.ROSTER:
      return <RosterCardContent cardId={cardId} />;
    case CardType.FOG:
      return <FogControlCardContent
        targetMapId={metadata?.targetMapId as string}
        targetLabel={metadata?.targetLabel as string}
        isStructureMode={metadata?.isStructureMode as boolean}
        structureId={metadata?.structureId as string}
      />;
    case CardType.TOKENS:
      return <TokenPanelCardContent onAddToken={addToken} />;
    case CardType.MAP_CONTROLS:
      return <MapControlsCardContent fabricCanvas={null} />; // TODO: Pass actual fabricCanvas
    case CardType.MAP_MANAGER:
      return <MapManagerCardContent />;
    case CardType.WATABOU_IMPORT:
      return <WatabouImportCardContent />;
    case CardType.PROJECT_MANAGER:
      return (
        <ProjectManagerCardContent
          viewport={{ x: 0, y: 0, zoom: 1 }}
        />
      );
    case CardType.INITIATIVE_TRACKER:
      return <InitiativeTrackerCardContent />;
    case CardType.STYLES:
      return <StylesCardContent />;
    case CardType.REGION_CONTROL:
      return (
        <RegionControlsCardContent 
          regionId={activeRegionId || null}
          onToggleSnapping={onToggleSnapping}
          onToggleGridVisibility={onToggleGridVisibility}
        />
      );
    case CardType.VISION_PROFILE_MANAGER:
      return <VisionProfileManagerCardContent />;
    case CardType.ROLE_MANAGER:
      return <RoleManagerCard />;
    case CardType.HISTORY:
      return <HistoryCard />;
    case CardType.MAP_OBJECTS:
      return <MapObjectPanelCardContent />;
    case CardType.CHARACTER_SHEET:
      return <CharacterSheetCardContent tokenId={(metadata?.tokenId as string) || ''} characterId={(metadata?.characterId as string) || ''} />;
    case CardType.MONSTER_STAT_BLOCK:
      return <MonsterStatBlockCardContent monsterId={(metadata?.monsterId as string) || ''} />;
    case CardType.CREATURE_LIBRARY:
      return <CreatureLibraryCardContent cardId={cardId} />;
    case CardType.MAP_TREE:
      return (
        <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Loading…</div>}>
          <LazyMapTreeCardContent />
        </Suspense>
      );
    case CardType.DICE_BOX:
      return <DiceCardContent />;
    case CardType.GROUP_MANAGER:
      return <div className="text-muted-foreground text-sm">Content for {type} coming soon...</div>;
    case CardType.ACTION_CARD:
      return <ActionCardContent />;
    case CardType.ACTION_DECLARE_CARD:
      return <ActionDeclareCardContent draftId={cardId} actorId="" category="" />;
    case CardType.NETWORK_DEMO:
      return <NetworkDemoCardContent />;
    case CardType.EFFECTS:
      return <EffectsCatalog />;
    case CardType.CHAT:
      return <ChatCardContent />;
    case CardType.ART_APPROVAL:
      return <ArtApprovalCardContent />;
    case CardType.SOUND_SETTINGS:
      return <SoundSettingsCardContent />;
    case CardType.HANDOUT_CATALOG:
      return <HandoutCatalogCardContent />;
    case CardType.HANDOUT_VIEWER:
      return <HandoutViewerCardContent handoutId={(metadata?.handoutId as string) || ''} />;
    case CardType.CAMPAIGN_EDITOR:
      return <CampaignEditorCardContent />;
    case CardType.TOKEN_GROUP_MANAGER:
      return <TokenGroupManagerCardContent />;
    case CardType.LIBRARY_EDITOR:
      return <LibraryEditorCardContent
        entityId={(metadata?.entityId as string) || ''}
        entityType={(metadata?.entityType as 'character' | 'monster') || 'monster'}
      />;
    case CardType.COMPENDIUM:
      return <CompendiumCardContent cardId={cardId} onAddToken={addToken} />;
    case CardType.ENVIRONMENT:
      return <EnvironmentCardContent cardId={cardId} />;
    case CardType.PLAY:
      return <PlayCardContent cardId={cardId} />;
    case CardType.CAMPAIGN:
      return <CampaignCardContent cardId={cardId} />;
    case CardType.RULES:
      return <RulesCardContent cardId={cardId} />;
    default:
      return <div className="text-muted-foreground text-sm">Unknown card type</div>;
  }
}
