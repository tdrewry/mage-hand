import React, { useRef } from 'react';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { useUiStateStore } from '@/stores/uiStateStore';
import { Z_INDEX } from '@/lib/zIndex';
import { InitiativeCard } from './InitiativeCard';
import { canSeeToken, hasPermission } from '@/lib/rolePermissions';
import { ephemeralBus } from '@/lib/net';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Swords } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

// Horizontal Initiative Panel for bottom-center over the map
export const InitiativePanel: React.FC = () => {
  const {
    isInCombat,
    currentTurnIndex,
    roundNumber,
    initiativeOrder,
    nextTurn,
    previousTurn,
    removeFromInitiative,
    reorderInitiative,
    updateInitiative,
    layoutFormat
  } = useInitiativeStore();

  const { tokens, players, currentPlayerId } = useSessionStore();
  const { roles } = useRoleStore();
  const { isLeftSidebarOpen, isRightSidebarOpen, isFocusMode } = useUiStateStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Only show when in combat
  if (!isInCombat) return null;

  const rightOffset = isRightSidebarOpen && !isFocusMode ? '340px' : '16px';
  const leftOffset = isLeftSidebarOpen && !isFocusMode ? '320px' : '0px';
  const calculateCenter = () => {
    if (layoutFormat === 'vertical') return undefined; // Handled by rightOffset
    const leftNum = parseInt(leftOffset);
    const rightNum = isRightSidebarOpen && !isFocusMode ? 320 : 0;
    
    // Total width is 100vw. Center point is (100vw - leftNum - rightNum) / 2 + leftNum
    return `calc(${leftNum}px + (100vw - ${leftNum}px - ${rightNum}px) / 2)`;
  };

  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const isDM = currentPlayer ? hasPermission(currentPlayer, roles, 'canSeeAllFog') : false;

  const visibleInitiativeOrder = initiativeOrder.filter(entry => {
    const token = tokens.find(t => t.id === entry.tokenId);
    if (!token) return false;
    if (isDM) return true;
    if (currentPlayer) {
      return canSeeToken(token, currentPlayer, roles);
    }
    return true;
  });

  const getIsHidden = (tokenId: string): boolean => {
    if (!isDM) return false;
    const token = tokens.find(t => t.id === tokenId);
    return token?.isHidden === true;
  };

  const handleNextTurn = () => {
    nextTurn();
    setTimeout(() => {
      const activeCard = scrollContainerRef.current?.querySelector('[data-active="true"]');
      activeCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    try { ephemeralBus.emit('initiative.drag.preview', { entryIndex: index, targetIndex: index }); } catch {}
  };

  const handleDragOver = (e: React.DragEvent, hoverIndex?: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoverIndex !== undefined) {
      try { ephemeralBus.emit('initiative.hover', { entryIndex: hoverIndex }); } catch {}
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(draggedIndex) && draggedIndex !== dropIndex) {
      reorderInitiative(draggedIndex, dropIndex);
      toast.success('Initiative order updated');
    }
    try { ephemeralBus.emit('initiative.hover', { entryIndex: null }); } catch {}
  };

  const handleCardClick = (tokenId: string) => {
    window.dispatchEvent(new CustomEvent('centerOnToken', { detail: { tokenId } }));
  };

  return (
    <div 
      className={cn(
        "fixed transition-all duration-300 ease-in-out pointer-events-none",
        layoutFormat === 'vertical' ? "top-1/2 -translate-y-1/2 flex flex-col gap-3" : "top-14 mt-2 left-1/2 -translate-x-1/2 flex flex-col items-center"
      )}
      style={{ 
        zIndex: Z_INDEX.FIXED_UI.FLOATING_MENUS,
        right: layoutFormat === 'vertical' ? rightOffset : undefined,
        left: layoutFormat !== 'vertical' ? calculateCenter() : undefined,
      }}
    >
      <div className={cn(
        "flex bg-[#161a1d] shadow-2xl border border-white/5 pointer-events-auto transition-all animate-in fade-in",
        layoutFormat === 'vertical' ? "flex-col rounded-2xl p-3 gap-3 w-[320px] max-h-[80vh] slide-in-from-right-5" : "items-center slide-in-from-top-5",
        layoutFormat === 'horizontal' ? "rounded-3xl p-3 px-4 gap-4" : "",
        layoutFormat === 'mini' ? "rounded-full p-1.5 px-3 gap-2" : ""
      )}>
        {layoutFormat === 'vertical' && (
          <div className="flex items-center justify-between px-1 pb-2 border-b border-white/10 shrink-0">
             <span className="text-xl font-bold text-[#e2a899] font-serif tracking-wide">Round {roundNumber}</span>
             <div className="flex items-center gap-2">
               <Button variant="ghost" size="icon" onClick={previousTurn} disabled={currentTurnIndex === 0 && roundNumber === 1} className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/10">
                 <ChevronUp className="h-4 w-4" />
               </Button>
               <Button variant="ghost" size="icon" onClick={handleNextTurn} className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/10 text-[#38bdf8]">
                 <ChevronDown className="h-4 w-4" />
               </Button>
             </div>
          </div>
        )}

        {layoutFormat === 'mini' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={previousTurn}
            disabled={currentTurnIndex === 0 && roundNumber === 1}
            className="shrink-0 h-8 w-8 rounded-full hover:bg-white/10 text-muted-foreground hover:text-[#38bdf8]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {layoutFormat === 'horizontal' && (
          <div className="flex flex-col items-center justify-center shrink-0 pr-4 border-r border-white/10 h-full">
            <span className="text-xl font-bold text-[#e2a899] font-serif tracking-wide mb-2">Round {roundNumber}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={previousTurn} disabled={currentTurnIndex === 0 && roundNumber === 1} className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 hover:text-[#38bdf8]">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextTurn} className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-[#38bdf8]">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        <div 
          className={cn(
            "flex overflow-auto scrollbar-hide flex-1",
            layoutFormat === 'vertical' ? "flex-col gap-2 px-1" : "items-center overflow-x-auto",
            layoutFormat === 'horizontal' ? "gap-2 max-w-[75vw] px-2" : "",
            layoutFormat === 'mini' ? "gap-1.5 max-w-[50vw] px-1" : ""
          )}
          ref={scrollContainerRef}
        >
          {visibleInitiativeOrder.map((entry, index) => {
             const token = tokens.find(t => t.id === entry.tokenId);
             if (!token) return null;
             const actualIndex = initiativeOrder.findIndex(e => e.tokenId === entry.tokenId);
             return (
               <div key={entry.tokenId} data-active={actualIndex === currentTurnIndex}>
                 <InitiativeCard
                   token={token}
                   initiative={entry.initiative}
                   isActive={actualIndex === currentTurnIndex}
                   hasGone={entry.hasGone}
                   isHidden={getIsHidden(entry.tokenId)}
                   onClick={() => handleCardClick(entry.tokenId)}
                   onRemove={() => removeFromInitiative(entry.tokenId)}
                   onInitiativeChange={(newInit) => updateInitiative(entry.tokenId, newInit)}
                   onDragStart={(e) => handleDragStart(e, actualIndex)}
                   onDragOver={(e) => handleDragOver(e, actualIndex)}
                   onDrop={(e) => handleDrop(e, actualIndex)}
                   layout={layoutFormat}
                 />
               </div>
             );
          })}
        </div>

        {layoutFormat === 'mini' && (
          <>
            <div className="flex flex-col items-center px-3 border-l border-white/10 shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground/60 leading-none">Round</span>
              <span className="text-sm font-bold text-muted-foreground leading-none mt-1">{roundNumber}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextTurn}
              className="shrink-0 h-8 w-8 rounded-full hover:bg-white/10 text-[#38bdf8]"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
