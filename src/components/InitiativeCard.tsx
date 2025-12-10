import React, { useState } from 'react';
import { Token } from '@/stores/sessionStore';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { X, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenContextMenu } from './TokenContextMenu';

interface InitiativeCardProps {
  token: Token;
  initiative: number;
  isActive: boolean;
  hasGone?: boolean;
  isHidden?: boolean;
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
  isHidden,
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

  // Scale down to 75% of original sizes
  const scaleFactor = 0.75;
  const imageSize = size ? size * 0.5 * scaleFactor : (isCompact ? 36 : 48);
  const fontSize = size ? Math.max(10, size * 0.12) : (isCompact ? 10 : 12);
  const initFontSize = size ? Math.max(10, size * 0.14) : (isCompact ? 12 : 14);
  
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
          isCompact ? "gap-0.5 p-1.5 pb-3" : "gap-1 p-2 pb-4",
          isActive && "border-primary bg-primary/10 shadow-lg shadow-primary/20 ring-2 ring-primary/50",
          !isActive && hasGone && "opacity-60 border-border bg-muted/50",
          !isActive && !hasGone && "border-border bg-card hover:border-primary/50",
          isHidden && "opacity-50 border-dashed"
        )}
        style={size ? { 
          minWidth: `${size * scaleFactor}px`,
          width: `${size * scaleFactor}px`
        } : { minWidth: '90px' }}
      >
        {/* Remove Button */}
        {!isCompact && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}

        {/* Hidden Indicator */}
        {isHidden && (
          <div className="absolute top-1 left-1">
            <EyeOff className="h-3 w-3 text-muted-foreground" />
          </div>
        )}

        {/* Token Name - Now on top */}
        <div 
          className="font-medium text-center text-foreground truncate max-w-full px-1 leading-tight"
          style={{ fontSize: `${fontSize}px` }}
        >
          {token.label || token.name}
        </div>

        {/* Token Image or Color */}
        <div 
          className="relative rounded-lg overflow-hidden border-2 border-border"
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

        {/* Initiative Number - Below image, overlapping bottom edge */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 bg-background border-2 border-primary rounded-full px-2 py-0.5 min-w-[24px] text-center"
          style={{ 
            bottom: '-8px',
            fontSize: `${initFontSize}px`
          }}
        >
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
              className="w-10 h-5 text-center text-sm font-bold p-0 border-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (!isCompact) setIsEditingInitiative(true);
              }}
              className="font-bold text-primary cursor-pointer hover:text-primary/80"
            >
              {initiative}
            </span>
          )}
        </div>

        {/* Active Indicator */}
        {isActive && (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
        )}
      </div>
    </TokenContextMenu>
  );
};
