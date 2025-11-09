import React from 'react';
import { cn } from '@/lib/utils';
import { Swords } from 'lucide-react';

interface TurnCardProps {
  turnNumber: number;
  roundNumber: number;
  totalTokens: number;
  isCompact?: boolean;
  size?: number;
}

export const TurnCard: React.FC<TurnCardProps> = ({
  turnNumber,
  roundNumber,
  totalTokens,
  isCompact = false,
  size
}) => {
  const imageSize = size ? size * 0.5 : (isCompact ? 40 : 64);
  const fontSize = size ? Math.max(12, size * 0.2) : (isCompact ? 16 : 24);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-primary bg-primary/10",
        isCompact ? "p-2" : "p-3"
      )}
      style={size ? { 
        minWidth: `${size}px`,
        width: `${size}px`
      } : { minWidth: '120px' }}
    >
      <Swords 
        className="text-primary" 
        size={Math.max(16, imageSize * 0.4)}
      />
      <div className="text-center">
        <div 
          className="font-bold text-primary"
          style={{ fontSize: `${fontSize}px` }}
        >
          {turnNumber}
        </div>
        <div 
          className="text-muted-foreground"
          style={{ fontSize: `${Math.max(10, fontSize * 0.5)}px` }}
        >
          of {totalTokens}
        </div>
        <div 
          className="text-muted-foreground font-medium"
          style={{ fontSize: `${Math.max(10, fontSize * 0.5)}px` }}
        >
          Round {roundNumber}
        </div>
      </div>
    </div>
  );
};
