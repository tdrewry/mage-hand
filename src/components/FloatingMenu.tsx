import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Palette, Eye, Map, Settings } from 'lucide-react';
import { VisibilityModal } from './modals/VisibilityModal';
import { Canvas as FabricCanvas } from 'fabric';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { Z_INDEX } from '@/lib/zIndex';

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
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      id: 'background',
      icon: Palette,
      label: 'Background',
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'visibility',
      icon: Eye,
      label: 'Visibility',
      color: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      id: 'maps',
      icon: Map,
      label: 'Maps',
      color: 'bg-teal-500 hover:bg-teal-600',
    },
  ];

  return (
    <>
      {/* Floating Menu - Upper Left Corner */}
      <div 
        className="fixed left-4 top-20 flex flex-col gap-3"
        style={{ zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS }}
      >
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = 
            (item.id === 'tokens' && tokenCard?.isVisible) ||
            (item.id === 'maps' && mapControlsCard?.isVisible) ||
            (item.id === 'background' && backgroundGridCard?.isVisible);
          
          return (
            <Button
              key={item.id}
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
              className={`w-12 h-12 rounded-full ${isActive ? 'ring-2 ring-white' : ''} ${item.color} text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl`}
              title={item.label}
            >
              <IconComponent className="h-5 w-5" />
            </Button>
          );
        })}
      </div>

      {/* Modals */}
      <VisibilityModal
        open={activeModal === 'visibility'}
        onOpenChange={(open) => setActiveModal(open ? 'visibility' : null)}
      />
    </>
  );
};