import React from 'react';
import { Lock } from 'lucide-react';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { Badge } from './ui/badge';
import { Z_INDEX } from '@/lib/zIndex';

export const MovementLockIndicator: React.FC = () => {
  const movementLocked = useInitiativeStore((state) => state.restrictMovement);
  const setMovementLocked = useInitiativeStore((state) => state.setRestrictMovement);

  if (!movementLocked) return null;

  return (
    <div 
      className="fixed left-1/2 -translate-x-1/2 pointer-events-auto"
      style={{ zIndex: Z_INDEX.CRITICAL.BLOCKER_OVERLAY, top: '68px' }}
    >
      <Badge 
        variant="destructive" 
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setMovementLocked(false)}
        title="Click to unlock movement"
      >
        <Lock className="h-4 w-4" />
        <span>Movement Locked — click to unlock</span>
      </Badge>
    </div>
  );
};

