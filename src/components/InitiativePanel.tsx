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
      className="fixed right-4 top-1/2 -translate-y-1/2 bg-background/60 backdrop-blur-md border border-border rounded-2xl shadow-lg max-h-[80vh] overflow-hidden"
      style={{ zIndex: Z_INDEX.FIXED_UI.SIDE_PANELS }}
    >
      <InitiativeTrackerCardContent />
    </div>
  );
};
