import React from 'react';
import { Lock } from 'lucide-react';
import { useSessionStore } from '@/stores/sessionStore';
import { Badge } from './ui/badge';
import { Z_INDEX } from '@/lib/zIndex';

export const MovementLockIndicator: React.FC = () => {
  const movementLocked = useSessionStore((state) => state.movementLocked);

  if (!movementLocked) return null;

  return (
    <div 
      className="fixed top-4 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: Z_INDEX.CRITICAL.BLOCKER_OVERLAY }}
    >
      <Badge 
        variant="destructive" 
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <Lock className="h-4 w-4" />
        <span>Movement Locked</span>
      </Badge>
    </div>
  );
};
