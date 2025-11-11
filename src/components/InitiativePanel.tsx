import React from 'react';
import { InitiativeTrackerCardContent } from './cards/InitiativeTrackerCard';
import { useInitiativeStore } from '@/stores/initiativeStore';

export const InitiativePanel: React.FC = () => {
  const { isInCombat } = useInitiativeStore();

  // Only show when in combat
  if (!isInCombat) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[998] bg-background/95 backdrop-blur border border-border rounded-2xl shadow-lg max-w-[90vw]">
      <InitiativeTrackerCardContent />
    </div>
  );
};
