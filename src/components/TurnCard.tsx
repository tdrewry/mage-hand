import React from 'react';
import { cn } from '@/lib/utils';
import { Swords } from 'lucide-react';

interface TurnCardProps {
  turnNumber: number;
  roundNumber: number;
  totalTokens: number;
  isCompact?: boolean;
}

export const TurnCard: React.FC<TurnCardProps> = ({
  turnNumber,
  roundNumber,
  totalTokens,
  isCompact = false
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-primary bg-primary/10 min-w-[120px]",
        isCompact ? "p-2" : "p-3"
      )}
    >
      <Swords className="h-5 w-5 text-primary" />
      <div className="text-center">
        <div className="text-2xl font-bold text-primary">
          {turnNumber}
        </div>
        <div className="text-xs text-muted-foreground">
          of {totalTokens}
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          Round {roundNumber}
        </div>
      </div>
    </div>
  );
};
