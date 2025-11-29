import React, { useState, useEffect } from 'react';
import { Plus, Palette, Eye, Map, Settings } from 'lucide-react';
import { VisibilityModal } from './modals/VisibilityModal';
import { Canvas as FabricCanvas } from 'fabric';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/toolbar';

interface FloatingMenuProps {
  fabricCanvas: FabricCanvas | null;
  gridColor: string;
  gridOpacity: number;
  onGridColorChange: (color: string) => void;
  onGridOpacityChange: (opacity: number) => void;
  onAddToken: (imageUrl: string, x?: number, y?: number, gridWidth?: number, gridHeight?: number, color?: string) => void;
  onColorChange?: (tokenId: string, color: string) => void;
  onUpdateCanvas?: () => void;
}

export const FloatingMenu = ({
  fabricCanvas,
  gridColor,
  gridOpacity,
  onGridColorChange,
  onGridOpacityChange,
  onAddToken,
  onColorChange,
  onUpdateCanvas,
}: FloatingMenuProps) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);

  useEffect(() => {
    const card = cards.find(c => c.type === CardType.BACKGROUND_GRID);
    if (!card) {
      registerCard({
        type: CardType.BACKGROUND_GRID,
        title: 'Background & Grid',
        defaultPosition: { x: window.innerWidth / 2 - 200, y: 100 },
        defaultSize: { width: 400, height: 500 },
        minSize: { width: 350, height: 450 },
        isResizable: true,
        isClosable: true,
      });
    }
  }, [registerCard, cards]);
  
  const tokenCard = cards.find((c) => c.type === CardType.TOKENS);
  const mapControlsCard = cards.find((c) => c.type === CardType.MAP_CONTROLS);
  const backgroundGridCard = cards.find((c) => c.type === CardType.BACKGROUND_GRID);

  const handleToggleTokenCard = () => {
    if (tokenCard) {
      setVisibility(tokenCard.id, !tokenCard.isVisible);
    } else {
      registerCard({
        type: CardType.TOKENS,
        title: 'Token Panel',
        defaultPosition: { x: window.innerWidth - 420, y: 80 },
        defaultSize: { width: 400, height: 500 },
        minSize: { width: 300, height: 400 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

  const handleToggleMapControlsCard = () => {
    if (mapControlsCard) {
      setVisibility(mapControlsCard.id, !mapControlsCard.isVisible);
    } else {
      registerCard({
        type: CardType.MAP_CONTROLS,
        title: 'Map Controls',
        defaultPosition: { x: window.innerWidth / 2 - 200, y: 100 },
        defaultSize: { width: 400, height: 450 },
        minSize: { width: 350, height: 400 },
        isResizable: true,
        isClosable: true,
      });
    }
  };

  const menuItems = [
    {
      id: 'tokens',
      icon: Plus,
      label: 'Tokens',
    },
    {
      id: 'background',
      icon: Palette,
      label: 'Background',
    },
    {
      id: 'visibility',
      icon: Eye,
      label: 'Visibility',
    },
    {
      id: 'maps',
      icon: Map,
      label: 'Maps',
    },
  ];

  return (
    <>
      <div className="fixed left-4 top-20">
        <Toolbar position="left" className="flex-col gap-1">
          {menuItems.map((item) => {
            const isActive = 
              (item.id === 'tokens' && tokenCard?.isVisible) ||
              (item.id === 'maps' && mapControlsCard?.isVisible) ||
              (item.id === 'background' && backgroundGridCard?.isVisible);
            
            return (
              <ToolbarButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                onClick={() => {
                  if (item.id === 'tokens') {
                    handleToggleTokenCard();
                  } else if (item.id === 'maps') {
                    handleToggleMapControlsCard();
                  } else if (item.id === 'background') {
                    if (backgroundGridCard) {
                      setVisibility(backgroundGridCard.id, !backgroundGridCard.isVisible);
                    }
                  } else {
                    setActiveModal(item.id);
                  }
                }}
                isActive={isActive}
                variant="ghost"
                size="md"
                className={
                  item.id === 'tokens' ? 'text-green-500 hover:text-green-600' :
                  item.id === 'background' ? 'text-purple-500 hover:text-purple-600' :
                  item.id === 'visibility' ? 'text-orange-500 hover:text-orange-600' :
                  item.id === 'maps' ? 'text-teal-500 hover:text-teal-600' :
                  ''
                }
              />
            );
          })}
        </Toolbar>
      </div>

      {/* Modals */}
      <VisibilityModal
        open={activeModal === 'visibility'}
        onOpenChange={(open) => setActiveModal(open ? 'visibility' : null)}
      />
    </>
  );
};