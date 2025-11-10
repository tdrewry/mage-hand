import React, { useState } from 'react';
import { Token } from '@/stores/sessionStore';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenContextMenu } from './TokenContextMenu';

interface InitiativeCardProps {
  token: Token;
  initiative: number;
  isActive: boolean;
  hasGone?: boolean;
  onClick?: () => void;
  onRemove: () => void;
  onInitiativeChange: (newInitiative: number) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isCompact?: boolean;
  size?: number;
}

export const InitiativeCard: React.FC<InitiativeCardProps> = ({
  token,
  initiative,
  isActive,
  hasGone,
  onClick,
  onRemove,
  onInitiativeChange,
  onDragStart,
  onDragOver,
  onDrop,
  isCompact = false,
  size
}) => {
  const [isEditingInitiative, setIsEditingInitiative] = useState(false);
  const [initiativeValue, setInitiativeValue] = useState(initiative.toString());

  const imageSize = size ? size * 0.5 : (isCompact ? 48 : 64);
  const fontSize = size ? Math.max(12, size * 0.15) : (isCompact ? 18 : 24);
  const handleInitiativeSubmit = () => {
    const value = parseInt(initiativeValue);
    if (!isNaN(value)) {
      onInitiativeChange(value);
    }
    setIsEditingInitiative(false);
  };

  return (
    <TokenContextMenu tokenId={token.id}>
      <div
        draggable
        onClick={onClick}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          "relative flex flex-col items-center rounded-lg border-2 transition-all cursor-pointer active:cursor-grabbing",
          isCompact ? "gap-1 p-2" : "gap-2 p-3",
          isActive && "border-primary bg-primary/10 shadow-lg shadow-primary/20 ring-2 ring-primary/50",
          !isActive && hasGone && "opacity-60 border-border bg-muted/50",
          !isActive && !hasGone && "border-border bg-card hover:border-primary/50"
        )}
        style={size ? { 
          minWidth: `${size}px`,
          width: `${size}px`
        } : { minWidth: '120px' }}
      >
      {/* Remove Button */}
      {!isCompact && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {/* Initiative Number */}
      <div className="flex items-center justify-center w-full">
        {isEditingInitiative && !isCompact ? (
          <Input
            type="number"
            value={initiativeValue}
            onChange={(e) => setInitiativeValue(e.target.value)}
            onBlur={handleInitiativeSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInitiativeSubmit();
              if (e.key === 'Escape') setIsEditingInitiative(false);
            }}
            className="w-16 h-8 text-center text-xl font-bold"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (!isCompact) setIsEditingInitiative(true);
            }}
            className="font-bold text-primary cursor-pointer hover:text-primary/80"
            style={{ fontSize: `${fontSize}px` }}
          >
            {initiative}
          </div>
        )}
      </div>

      {/* Token Image or Color */}
      <div 
        className="rounded-lg overflow-hidden border-2 border-border"
        style={{ 
          width: `${imageSize}px`, 
          height: `${imageSize}px` 
        }}
      >
        {token.imageUrl ? (
          <img
            src={token.imageUrl}
            alt={token.label || token.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: token.color || '#888' }}
          />
        )}
      </div>

      {/* Token Label */}
      {!isCompact && (
        <div 
          className="font-medium text-center text-foreground truncate max-w-full px-1"
          style={{ fontSize: `${Math.max(10, fontSize * 0.6)}px` }}
        >
          {token.label || token.name}
        </div>
      )}

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full animate-pulse" />
      )}
      </div>
    </TokenContextMenu>
  );
};
