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

  const imageSize = 32;
  const fontSize = 11;
  const initFontSize = 12;
  
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
          "relative flex flex-col rounded-lg border-2 transition-all cursor-pointer active:cursor-grabbing p-1.5",
          isActive && "border-primary bg-primary/10 shadow-lg shadow-primary/20 ring-2 ring-primary/50",
          !isActive && hasGone && "opacity-60 border-border bg-muted/50",
          !isActive && !hasGone && "border-border bg-card hover:border-primary/50",
          isHidden && "opacity-50 border-dashed"
        )}
        style={{ 
          width: isActive ? '85px' : '60px'
        }}
      >
        {/* Remove Button */}
        {!isCompact && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-2.5 w-2.5" />
          </Button>
        )}

        {/* Hidden Indicator */}
        {isHidden && (
          <div className="absolute top-1 left-1">
            <EyeOff className="h-3 w-3 text-muted-foreground" />
          </div>
        )}

        {/* Token Name - Top row */}
        <div 
          className="font-medium text-foreground truncate w-full leading-tight mb-1"
          style={{ fontSize: `${fontSize}px` }}
        >
          {token.label || token.name}
        </div>

        {/* Bottom row: Initiative number + Token Image */}
        <div className="flex items-center gap-1.5">
          {/* Initiative Number */}
          <div 
            className="bg-background border-2 border-primary rounded-full min-w-[24px] h-[24px] flex items-center justify-center"
            style={{ fontSize: `${initFontSize}px` }}
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
                className="w-8 h-5 text-center text-sm font-bold p-0 border-0"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isCompact) setIsEditingInitiative(true);
                }}
                className="font-bold text-primary cursor-pointer hover:text-primary/80 px-1"
              >
                {initiative}
              </span>
            )}
          </div>

          {/* Token Image or Color */}
          <div 
            className="relative rounded-md overflow-hidden border border-border shrink-0"
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
        </div>

        {/* Active Indicator */}
        {isActive && (
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
        )}
      </div>
    </TokenContextMenu>
  );
};
