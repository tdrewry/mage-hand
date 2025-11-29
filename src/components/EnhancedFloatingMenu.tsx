import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Users, 
} from 'lucide-react';

import { FloatingMenu } from './FloatingMenu';
import { GroupManagerModal } from './GroupManagerModal';
import { useCardStore } from '@/stores/cardStore';
import { CardType } from '@/types/cardTypes';
import { Toolbar, ToolbarButton } from '@/components/toolbar';

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
      <div className="fixed top-4 right-4">
        <Toolbar position="top" className="flex-row gap-2">
          <ToolbarButton
            icon={FolderOpen}
            label="Project Manager"
            onClick={handleToggleProjectManager}
            variant="ghost"
            size="sm"
          />
          
          <ToolbarButton
            icon={Users}
            label="Group Manager"
            onClick={() => setGroupModalOpen(true)}
            variant="ghost"
            size="sm"
          />
        </Toolbar>
      </div>

      {/* Enhanced modals */}
      <GroupManagerModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
      />
    </>
  );
};