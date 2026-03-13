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
  layout?: 'vertical' | 'horizontal' | 'mini';
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
  size,
  layout = 'vertical'
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

  // New layout designs
  if (layout === 'mini') {
    return (
      <TokenContextMenu tokenId={token.id}>
        <div
          draggable
          onClick={onClick}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={cn(
            "flex items-center gap-2 p-1 pr-3 h-10 min-w-10 rounded-xl transition-all border cursor-pointer",
            isActive 
              ? "bg-[#1a252f] border-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.3)] ring-1 ring-[#38bdf8]" 
              : hasGone
                ? "bg-transparent border-transparent opacity-60"
                : "bg-[#1a1e23] border-[#2a2f35] hover:border-[#38bdf8]/50"
          )}
        >
          {/* Avatar Circle */}
          <div 
            className={cn(
              "w-8 h-8 rounded-full overflow-hidden shrink-0 border",
              isActive ? "border-[#38bdf8]" : "border-transparent"
            )}
            style={{
              backgroundImage: token.imageUrl ? `url(${token.imageUrl})` : undefined,
              backgroundColor: !token.imageUrl ? (token.color || '#888') : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {isHidden && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <EyeOff className="h-3 w-3 text-white/70" />
              </div>
            )}
          </div>
          <span className={cn(
            "text-sm font-semibold whitespace-nowrap",
            isActive ? "text-[#38bdf8]" : "text-muted-foreground"
          )}>
            {token.label || token.name?.slice(0, 10)}
          </span>
        </div>
      </TokenContextMenu>
    );
  }

  if (layout === 'horizontal') {
    return (
      <TokenContextMenu tokenId={token.id}>
        <div
          draggable
          onClick={onClick}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={cn(
            "relative flex flex-col items-center p-2 rounded-2xl border transition-all cursor-pointer w-[90px] h-[130px]",
            isActive 
              ? "bg-[#161f28] border-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.2)]" 
              : "bg-[#1a1e23] border-[#2a2f35] hover:border-[#38bdf8]/50 outline-none"
          )}
        >
          {/* Top Row: Score & Status Dot */}
          <div className="w-full flex justify-end items-center mb-1">
             <div className="flex flex-col items-center gap-1 relative z-10">
               <div className={cn(
                 "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border",
                 isActive ? "border-[#38bdf8] text-[#38bdf8]" : "border-[#4ade80]/50 text-[#4ade80]"
               )}>
                 {initiative}
               </div>
               <div className={cn(
                 "w-1.5 h-1.5 rounded-full absolute -bottom-1 -right-0.5",
                 isActive ? "bg-[#4ade80] shadow-[0_0_5px_#4ade80]" : "bg-muted-foreground/40"
               )} />
             </div>
          </div>

          {/* Avatar Circle */}
          <div 
            className={cn(
              "w-14 h-14 rounded-full overflow-hidden mb-2 z-10 border-2",
              isActive ? "border-[#38bdf8] scale-105" : "border-transparent"
            )}
            style={{
              backgroundImage: token.imageUrl ? `url(${token.imageUrl})` : undefined,
              backgroundColor: !token.imageUrl ? (token.color || '#888') : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {isHidden && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <EyeOff className="h-4 w-4 text-white/70" />
              </div>
            )}
          </div>

          {/* Name */}
          <div className={cn(
            "text-base font-semibold truncate w-full text-center z-10",
            isActive ? "text-[#38bdf8]" : "text-muted-foreground"
          )}>
            {token.label || token.name?.slice(0, 10)}
          </div>
          
          {/* Active Highlight Glow Bottom */}
          {isActive && (
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#38bdf8]/20 to-transparent rounded-b-2xl pointer-events-none" />
          )}

          {/* Remove Button */}
          {!isCompact && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground z-20 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </TokenContextMenu>
    );
  }

  // Vertical layout (default) aligned with the mockup
  return (
    <TokenContextMenu tokenId={token.id}>
      <div
        draggable
        onClick={onClick}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          "group relative flex items-center gap-3 p-2 px-3 rounded-2xl border transition-all cursor-pointer w-full max-w-[300px]",
          isActive 
            ? "bg-[#161f28] border-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.15)] ring-1 ring-[#38bdf8]" 
            : "bg-[#1a1e23] border-[#2a2f35] hover:border-[#38bdf8]/50"
        )}
      >
        {/* Avatar Circle */}
        <div 
          className={cn(
            "w-10 h-10 rounded-full overflow-hidden shrink-0 border-2",
            isActive ? "border-[#38bdf8]" : "border-transparent"
          )}
          style={{
            backgroundImage: token.imageUrl ? `url(${token.imageUrl})` : undefined,
            backgroundColor: !token.imageUrl ? (token.color || '#888') : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {isHidden && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <EyeOff className="h-4 w-4 text-white/70" />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={cn(
            "text-base font-bold truncate",
            isActive ? "text-[#38bdf8]" : "text-muted-foreground"
          )}>
            {token.label || token.name}
          </span>
        </div>

        {/* Status indicator & Score */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-center gap-0.5">
             <div className="flex text-muted-foreground/50">
                {/* Stand-in for tiny icons in mockup */}
             </div>
             <div className={cn(
               "w-2 h-2 rounded-full",
               isActive ? "bg-[#4ade80] shadow-[0_0_5px_#4ade80]" : "bg-muted-foreground/30"
             )} />
          </div>
          
          <div className={cn(
            "w-9 h-9 flex items-center justify-center rounded-full text-lg font-bold border-2 transition-colors",
            isActive ? "border-[#4ade80] text-[#4ade80]" : "border-muted-foreground/20 text-[#4ade80]/70"
          )}>
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
                className="w-10 h-6 text-center text-sm font-bold p-0 border-0 bg-transparent text-[#4ade80]"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isCompact) setIsEditingInitiative(true);
                }}
              >
                {initiative}
              </span>
            )}
          </div>
        </div>

        {/* Remove Button */}
        {!isCompact && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground z-20 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </TokenContextMenu>
  );
};
