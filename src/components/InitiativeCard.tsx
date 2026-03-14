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
  variant?: 'docked' | 'widget';
  isSelected?: boolean;
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
  layout = 'vertical',
  variant = 'widget',
  isSelected = false
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
              ? "bg-[#2D2D2D] border-[#38bdf8] shadow-[0_0_10px_rgba(56,189,248,0.3)] ring-1 ring-[#38bdf8]" 
              : hasGone
                ? "bg-transparent border-transparent opacity-60"
                : "bg-[#1A1A1A] border-[#333333] hover:border-[#38bdf8]/50",
            isSelected && !isActive ? "ring-2 ring-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.4)]" : ""
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
              ? "bg-[#2D2D2D] border-[#38bdf8] shadow-[0_0_15px_rgba(56,189,248,0.2)]" 
              : "bg-[#1A1A1A] border-[#333333] hover:border-[#38bdf8]/50 outline-none",
            isSelected && !isActive ? "ring-2 ring-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.4)]" : ""
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
  // Initiative Orb Dynamic Colors based on label styling
  let orbBgColor = isActive ? '#182329' : '#13181C';
  let orbTextColor = isActive ? '#ffffff' : '#f3f4f6';
  let orbBorderColor = isActive ? '#38bdf8' : '#3A4A52';
  let orbGlow = isActive ? 'rgba(56,189,248,0.5)' : 'transparent';

  if (token.labelBackgroundColor) {
    if (token.labelBackgroundColor.startsWith('rgba') || token.labelBackgroundColor.startsWith('rgb')) {
      const match = token.labelBackgroundColor.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        
        // Solid background (no transparency)
        orbBgColor = `rgb(${r}, ${g}, ${b})`;
        
        // Brighter border color
        const brightR = Math.min(255, r + 70);
        const brightG = Math.min(255, g + 70);
        const brightB = Math.min(255, b + 70);
        orbBorderColor = `rgb(${brightR}, ${brightG}, ${brightB})`;
        
        if (isActive) {
          orbGlow = `rgba(${brightR}, ${brightG}, ${brightB}, 0.6)`;
        } else {
          orbGlow = 'transparent';
        }
      } else {
        orbBgColor = token.labelBackgroundColor.replace(/[\d.]+(?=\))/, '1');
        orbBorderColor = orbBgColor;
      }
    } else {
       orbBgColor = token.labelBackgroundColor;
       orbBorderColor = orbBgColor;
    }
    
    if (token.labelColor) {
      orbTextColor = token.labelColor;
    }
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
          "group relative flex items-center w-[285px] ml-4 mb-0",
          isSelected && !isActive ? "ring-2 ring-[#38bdf8] rounded-lg shadow-[0_0_8px_rgba(56,189,248,0.4)]" : ""
        )}
      >
        {/* Active Left Border Highlight (floating outside on the track line) */}
        {isActive && (
          <div className="absolute -left-4 top-[10%] bottom-[10%] w-[3px] rounded-full bg-[#38bdf8] shadow-[0_0_10px_#38bdf8] z-20" />
        )}

        {/* The Card Frame */}
        <div className={cn(
          "relative flex items-center justify-between p-2 pl-3 rounded-lg border transition-all cursor-pointer w-full min-h-[76px]",
          isActive 
            ? "bg-[#182329] border-[#38bdf8]/60 shadow-[0_8px_16px_rgba(0,0,0,0.8),0_0_12px_rgba(56,189,248,0.3)] ring-1 ring-[#38bdf8]/40" 
            : "bg-[#13181C] border-[#2A3439] shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:border-[#38bdf8]/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.5),0_0_8px_rgba(56,189,248,0.15)]"
        )}>
          
          {/* Inner clipped area for background art to protect border radius */}
          <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none z-0">
            {/* Background Image with fade to right */}
            {token.imageUrl && (
              <div 
                className="absolute inset-y-0 left-0 w-[45%] transition-opacity"
                style={{
                  backgroundImage: `url(${token.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center 15%',
                  backgroundRepeat: 'no-repeat',
                  maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
                  WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
                  opacity: isActive ? 1 : 0.8
                }}
              />
            )}
            {isHidden && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <EyeOff className="h-4 w-4 text-white/70" />
              </div>
            )}
          </div>

          {/* Current Turn Badge - Overlapping frame perfectly */}
          {isActive && (
            <div className="absolute -bottom-[1px] -left-[1px] z-20 bg-[#38bdf8]/20 text-[#38bdf8] text-[9.5px] font-bold px-2.5 py-[3px] rounded-tr-md rounded-bl-lg uppercase tracking-wider backdrop-blur-md shadow-sm border-t border-r border-[#38bdf8]/50">
              Current Turn
            </div>
          )}

          {/* Content Container right-aligned (leaves room for init circle) */}
          <div className="relative flex-1 flex flex-col items-end justify-center min-w-0 z-10 pr-6 mt-0.5">
            <span className={cn(
              "text-[16px] font-bold font-sans truncate text-right tracking-wide leading-tight",
              isActive ? "text-white" : "text-gray-100"
            )}>
              {/* Force uppercase directly in string, not CSS, to match mockup */}
              {(token.label || token.name || "").toUpperCase()}
            </span>
            
            {/* Subtitle / Creature Type */}
            <span className="text-[10px] text-gray-400 font-medium tracking-wide mt-[1px]">
               {(() => {
                 try {
                   if (token.statBlockJson) {
                     const parsed = JSON.parse(token.statBlockJson);
                     if (typeof parsed.type === 'string') return parsed.type.toLowerCase();
                     if (parsed.type?.type) return parsed.type.type.toLowerCase();
                   }
                 } catch (e) { /* ignore */ }
                 return (token.name && token.name !== token.label) ? token.name.toLowerCase() : 'creature';
               })()}
            </span>

            {/* Details Box */}
            <div className="flex items-center gap-1 mt-1 opacity-80">
              <span className="text-[8px] font-bold bg-destructive/30 text-[#ff8080] border border-destructive/50 px-1 rounded-[3px] leading-tight py-[1px]">HP</span>
              <span className="text-[8px] font-bold bg-muted/30 text-gray-300 border border-muted/50 px-1 rounded-[3px] leading-tight py-[1px]">HO</span>
              <div className="w-[14px] h-[14px] rounded-[3px] bg-muted/20 border border-muted/40 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              </div>
              <div className="w-[14px] h-[14px] rounded-[3px] bg-green-900/30 border border-green-500/30 flex items-center justify-center text-[8px] text-green-400">
                +
              </div>
            </div>
          </div>
        </div>

        {/* Initiative Score Circle - Floating on the right edge */}
        <div 
          className="absolute -right-[17px] top-1/2 -translate-y-1/2 w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-full text-[14px] font-bold border-[1.5px] transition-colors z-30"
          style={{
            backgroundColor: orbBgColor,
            color: orbTextColor,
            borderColor: orbBorderColor,
            boxShadow: isActive ? `0 0 12px ${orbGlow}, 0 4px 6px rgba(0,0,0,0.4)` : '0 4px 6px rgba(0,0,0,0.4)'
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
              className="w-10 h-6 text-center text-sm font-bold p-0 border-0 bg-transparent"
              style={{ color: orbTextColor }}
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

        {/* Remove Button */}
        {!isCompact && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-3 h-5 w-5 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground z-40 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg border border-destructive/50"
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
