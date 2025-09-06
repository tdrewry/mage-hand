import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Palette, Eye, Map, Settings } from 'lucide-react';
import { TokenPanelModal } from './modals/TokenPanelModal';
import { BackgroundGridModal } from './modals/BackgroundGridModal';
import { VisibilityModal } from './modals/VisibilityModal';
import { MapControlsModal } from './modals/MapControlsModal';
import { Canvas as FabricCanvas } from 'fabric';

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
      <div className="fixed left-4 top-20 z-50 flex flex-col gap-3">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <Button
              key={item.id}
              onClick={() => setActiveModal(item.id)}
              className={`w-12 h-12 rounded-full ${item.color} text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl`}
              title={item.label}
            >
              <IconComponent className="h-5 w-5" />
            </Button>
          );
        })}
      </div>

      {/* Modals */}
      <TokenPanelModal
        open={activeModal === 'tokens'}
        onOpenChange={(open) => setActiveModal(open ? 'tokens' : null)}
        onAddToken={onAddToken}
      />

      <BackgroundGridModal
        open={activeModal === 'background'}
        onOpenChange={(open) => setActiveModal(open ? 'background' : null)}
        fabricCanvas={fabricCanvas}
        gridColor={gridColor}
        gridOpacity={gridOpacity}
        onGridColorChange={onGridColorChange}
        onGridOpacityChange={onGridOpacityChange}
      />

      <VisibilityModal
        open={activeModal === 'visibility'}
        onOpenChange={(open) => setActiveModal(open ? 'visibility' : null)}
      />

      <MapControlsModal
        open={activeModal === 'maps'}
        onOpenChange={(open) => setActiveModal(open ? 'maps' : null)}
        fabricCanvas={fabricCanvas}
      />
    </>
  );
};