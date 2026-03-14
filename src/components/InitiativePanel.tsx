import React, { useRef, useState } from 'react';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { useUiStateStore } from '@/stores/uiStateStore';
import { Z_INDEX } from '@/lib/zIndex';
import { InitiativeCard } from './InitiativeCard';
import { canSeeToken, hasPermission } from '@/lib/rolePermissions';
import { ephemeralBus } from '@/lib/net';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Swords, Dices } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

// Horizontal/Vertical Initiative Panel for the map
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
    addToInitiative,
    layoutFormat
  } = useInitiativeStore();

  const { tokens, players, currentPlayerId, selectedTokenIds } = useSessionStore();
  const { roles } = useRoleStore();
  const { isLeftSidebarOpen, isRightSidebarOpen, isFocusMode } = useUiStateStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [multiInitValues, setMultiInitValues] = useState<Record<string, string>>({});

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

  const multiSelectedTokens = selectedTokenIds.length > 1
    ? selectedTokenIds.map(id => tokens.find(t => t.id === id)).filter(Boolean)
    : [];

  const rollD20 = () => Math.floor(Math.random() * 20) + 1;

  const handleRollAll = () => {
    multiSelectedTokens.forEach(token => {
      if (!token) return;
      const roll = rollD20();
      setMultiInitValues(prev => ({ ...prev, [token.id]: String(roll) }));
    });
  };

  const handleCommitAll = () => {
    let count = 0;
    multiSelectedTokens.forEach(token => {
      if (!token) return;
      const raw = multiInitValues[token.id];
      const value = raw !== undefined ? parseInt(raw) : rollD20();
      if (!isNaN(value)) {
        addToInitiative(token.id, value);
        count++;
      }
    });
    setMultiInitValues({});
    if (count > 0) toast.success(`Added ${count} token${count !== 1 ? 's' : ''} to initiative`);
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
        "flex shadow-2xl pointer-events-auto transition-all animate-in fade-in border border-[#333333] bg-[#1a1a1a]/80 backdrop-blur-md",
        layoutFormat === 'vertical' ? "flex-col rounded-2xl p-3 gap-3 w-[320px] max-h-[80vh] slide-in-from-right-5" : "items-center slide-in-from-top-5",
        layoutFormat === 'horizontal' ? "rounded-3xl p-3 px-4 gap-4" : "",
        layoutFormat === 'mini' ? "rounded-full p-1.5 px-3 gap-2" : ""
      )}>
        {/* MULTI-SELECT GROUP INITIATIVE */}
        {layoutFormat === 'vertical' && multiSelectedTokens.length > 1 && (
          <div className="flex flex-col gap-2 pb-3 border-b border-[#333333]">
            <div className="flex items-center gap-2 mb-1">
              <Swords className="h-4 w-4 text-[#e2a899]" />
              <span className="text-lg font-bold text-[#e2a899] font-serif tracking-wide">Group Initiative</span>
            </div>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-hide">
              {multiSelectedTokens.map(token => {
                if (!token) return null;
                return (
                  <div key={token.id} className="flex items-center gap-2 bg-[#2D2D2D]/50 p-1.5 rounded-lg border border-[#333333]">
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-[#1A1A1A]"
                      style={{
                        backgroundImage: token.imageUrl ? `url(${token.imageUrl})` : undefined,
                        backgroundColor: !token.imageUrl ? (token.color || '#888') : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <span className="text-sm font-semibold text-muted-foreground flex-1 min-w-0 truncate">
                      {token.label || token.name?.slice(0, 10)}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#e85d75]" />
                      <Input
                        type="number"
                        placeholder="d20"
                        value={multiInitValues[token.id] ?? ''}
                        onChange={e => setMultiInitValues(prev => ({ ...prev, [token.id]: e.target.value }))}
                        className="w-10 h-6 text-center text-xs font-bold p-0 bg-transparent border-none text-[#38bdf8] focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-1.5">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs border-[#333333] hover:border-[#38bdf8]/50"
                onClick={handleRollAll}
              >
                <Dices className="h-3 w-3 mr-1" />
                Roll All
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-xs bg-[#38bdf8] hover:bg-[#0284c7] text-[#1A1A1A] font-bold"
                onClick={handleCommitAll}
              >
                Add to Init
              </Button>
            </div>
          </div>
        )}

        {layoutFormat === 'vertical' && (
          <div className="flex items-center justify-between px-1 pb-2 border-b border-[#333333] shrink-0">
             <span className="text-xl font-bold text-[#e2a899] font-serif tracking-wide">Round {roundNumber}</span>
             <div className="flex items-center gap-2">
               <Button variant="ghost" size="icon" onClick={previousTurn} disabled={currentTurnIndex === 0 && roundNumber === 1} className="h-7 w-7 rounded-full bg-[#2D2D2D]/50 hover:bg-[#333333]">
                 <ChevronUp className="h-4 w-4" />
               </Button>
               <Button variant="ghost" size="icon" onClick={handleNextTurn} className="h-7 w-7 rounded-full bg-[#2D2D2D]/50 hover:bg-[#333333] text-[#38bdf8]">
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
            className="shrink-0 h-8 w-8 rounded-full hover:bg-[#333333] text-muted-foreground hover:text-[#38bdf8]"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {layoutFormat === 'horizontal' && (
          <div className="flex flex-col items-center justify-center shrink-0 pr-4 border-r border-[#333333] h-full">
            <span className="text-xl font-bold text-[#e2a899] font-serif tracking-wide mb-2">Round {roundNumber}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={previousTurn} disabled={currentTurnIndex === 0 && roundNumber === 1} className="h-8 w-8 rounded-full bg-[#2D2D2D]/50 hover:bg-[#333333] hover:text-[#38bdf8]">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextTurn} className="h-8 w-8 rounded-full bg-[#2D2D2D]/50 hover:bg-[#333333] text-[#38bdf8]">
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
                   isSelected={selectedTokenIds.includes(entry.tokenId)}
                 />
               </div>
             );
          })}
        </div>

        {layoutFormat === 'mini' && (
          <>
            <div className="flex flex-col items-center px-3 border-l border-[#333333] shrink-0">
              <span className="text-[10px] font-semibold text-muted-foreground/60 leading-none">Round</span>
              <span className="text-sm font-bold text-muted-foreground leading-none mt-1">{roundNumber}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextTurn}
              className="shrink-0 h-8 w-8 rounded-full hover:bg-[#333333] text-[#38bdf8]"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
