import React from 'react';
import { InitiativeTrackerCardContent } from './cards/InitiativeTrackerCard';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { Z_INDEX } from '@/lib/zIndex';

export const InitiativePanel: React.FC = () => {
  const { isInCombat } = useInitiativeStore();

  // Only show when in combat
  if (!isInCombat) return null;

  return (
    <div 
      className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur border border-border rounded-2xl shadow-lg max-w-[90vw]"
      style={{ zIndex: Z_INDEX.FIXED_UI.SIDE_PANELS }}
    >
      <InitiativeTrackerCardContent />
    </div>
  );
};
