import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { 
  FolderOpen, 
  Users, 
  Settings, 
  Grid3X3, 
  Eye, 
  MapPin,
  Save,
  Upload
} from 'lucide-react';

import { FloatingMenu } from './FloatingMenu';
import { GroupManagerModal } from './GroupManagerModal';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { Z_INDEX } from '@/lib/zIndex';

interface EnhancedFloatingMenuProps {
  fabricCanvas: any;
  gridType: 'square' | 'hex' | 'none';
  gridSize: number;
  gridVisible: boolean;
  gridColor: string;
  gridOpacity: number;
  onAddToken: () => void;
  onGridTypeChange: (type: 'square' | 'hex' | 'none') => void;
  onGridSizeChange: (size: number) => void;
  onGridVisibilityChange: (visible: boolean) => void;
  onGridColorChange: (color: string) => void;
  onGridOpacityChange: (opacity: number) => void;
  onBackgroundColorChange: (color: string) => void;
  viewport: { x: number; y: number; zoom: number };
}

export const EnhancedFloatingMenu: React.FC<EnhancedFloatingMenuProps> = ({
  viewport,
  ...floatingMenuProps
}) => {
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  
  const registerCard = useCardStore((state) => state.registerCard);
  const cards = useCardStore((state) => state.cards);
  const setVisibility = useCardStore((state) => state.setVisibility);

  useEffect(() => {
    const card = cards.find(c => c.type === CardType.PROJECT_MANAGER);
    if (!card) {
      registerCard({
        type: CardType.PROJECT_MANAGER,
        title: 'Project Manager',
        defaultPosition: { x: window.innerWidth / 2 - 300, y: 100 },
        defaultSize: { width: 600, height: 600 },
        minSize: { width: 500, height: 500 },
        isResizable: true,
        isClosable: true,
      });
    }
  }, [registerCard, cards]);

  const handleToggleProjectManager = () => {
    const card = cards.find(c => c.type === CardType.PROJECT_MANAGER);
    if (card) {
      setVisibility(card.id, !card.isVisible);
    }
  };

  return (
    <>
      {/* Original floating menu */}
      <FloatingMenu {...floatingMenuProps} />
      
      {/* Enhanced features menu */}
      <div 
        className="fixed top-4 right-4 flex flex-col gap-2"
        style={{ zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleProjectManager}
          className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
          title="Project Manager"
        >
          <FolderOpen className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setGroupModalOpen(true)}
          className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
          title="Group Manager"
        >
          <Users className="w-4 h-4" />
        </Button>
      </div>

      {/* Enhanced modals */}
      <GroupManagerModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
      />
    </>
  );
};