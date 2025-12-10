import React from 'react';
import { cn } from '@/lib/utils';
import { Swords, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface TurnCardProps {
  turnNumber: number;
  roundNumber: number;
  totalTokens: number;
  isCompact?: boolean;
  size?: number;
  onResetRound?: () => void;
}

export const TurnCard: React.FC<TurnCardProps> = ({
  turnNumber,
  roundNumber,
  totalTokens,
  isCompact = false,
  size,
  onResetRound
}) => {
  const imageSize = size ? size * 0.5 : (isCompact ? 40 : 64);
  const fontSize = size ? Math.max(12, size * 0.2) : (isCompact ? 16 : 24);
  return (
    <div
      className={cn(
        "relative flex flex-row items-center gap-1.5 rounded-lg border-2 border-primary bg-primary/10",
        isCompact ? "p-2" : "p-3"
      )}
      style={{ 
        width: '85px',
        minWidth: '85px'
      }}
    >
      {onResetRound && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onResetRound}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-card border border-border hover:bg-accent"
          title="Reset Round"
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </Button>
      )}
      <Swords 
        className="text-primary shrink-0" 
        size={18}
      />
      <div className="flex flex-col whitespace-nowrap">
        <div 
          className="font-bold text-primary leading-tight"
          style={{ fontSize: `${fontSize}px` }}
        >
          {turnNumber} of {totalTokens}
        </div>
        <div 
          className="text-muted-foreground font-medium leading-tight"
          style={{ fontSize: `${Math.max(10, fontSize * 0.7)}px` }}
        >
          Round {roundNumber}
        </div>
      </div>
    </div>
  );
};
