import React from 'react';
import { InitiativeTrackerCardContent } from './cards/InitiativeTrackerCard';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useUiStateStore } from '@/stores/uiStateStore';
import { Z_INDEX } from '@/lib/zIndex';

interface InitiativePanelProps {
  selectedTokenIds?: string[];
}

export const InitiativePanel: React.FC<InitiativePanelProps> = ({ selectedTokenIds = [] }) => {
  const { isInCombat } = useInitiativeStore();
  const { isRightSidebarOpen, isFocusMode } = useUiStateStore();

  // Only show when in combat
  if (!isInCombat) return null;

  const rightOffset = isRightSidebarOpen && !isFocusMode ? '336px' : '16px';

  return (
    <div 
      className="fixed top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-md border border-border rounded-2xl shadow-lg max-h-[80vh] overflow-hidden transition-all duration-300 ease-in-out"
      style={{ zIndex: Z_INDEX.FIXED_UI.SIDE_PANELS, right: rightOffset }}
    >
      <InitiativeTrackerCardContent selectedTokenIds={selectedTokenIds} />
    </div>
  );
};
