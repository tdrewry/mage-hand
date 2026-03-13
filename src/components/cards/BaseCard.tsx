import { useEffect, useRef, useState } from 'react';
import { Minus, X, Maximize2, Minimize2, PanelLeft, PanelRight, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCardStore } from '@/stores/cardStore';
import { CardPosition, CardSize } from '@/types/cardTypes';
import { cn } from '@/lib/utils';

interface BaseCardProps {
  id: string;
  title: string;
  children: React.ReactNode;
  isResizable?: boolean;
  isClosable?: boolean;
  minSize?: CardSize;
  maxSize?: CardSize;
  className?: string;
  hideHeader?: boolean;
  fullCardDraggable?: boolean;
}

export function BaseCard({
  id,
  title,
  children,
  isResizable = true,
  isClosable = true,
  minSize = { width: 200, height: 200 },
  maxSize,
  className,
  hideHeader = false,
  fullCardDraggable = false,
}: BaseCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const card = useCardStore((state) => state.getCard(id));
  const updateCardPosition = useCardStore((state) => state.updateCardPosition);
  const updateCardSize = useCardStore((state) => state.updateCardSize);
  const toggleMinimize = useCardStore((state) => state.toggleMinimize);
  const unregisterCard = useCardStore((state) => state.unregisterCard);
  const bringToFront = useCardStore((state) => state.bringToFront);
  const dockCard = useCardStore((state) => state.dockCard);
  const saveLayout = useCardStore((state) => state.saveLayout);

  // Handle mouse move for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && card) {
        const { position, size } = card;
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - size.width));
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 40));
        
        updateCardPosition(id, { x: newX, y: newY });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = Math.max(minSize.width, resizeStart.width + deltaX);
        let newHeight = Math.max(minSize.height, resizeStart.height + deltaY);
        
        if (maxSize) {
          newWidth = Math.min(maxSize.width, newWidth);
          newHeight = Math.min(maxSize.height, newHeight);
        }
        
        updateCardSize(id, { width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        saveLayout();
      }
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset, resizeStart, id, card, minSize, maxSize, updateCardPosition, updateCardSize, saveLayout]);

  if (!card || !card.isVisible) return null;

  const { position, size, isMinimized, zIndex } = card;

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    // Don't drag when clicking interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, [draggable="true"]')) return;
    
    bringToFront(id);
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - card.position.x,
      y: e.clientY - card.position.y,
    });
  };

  // Handle resize start
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isResizable || !card) return;
    e.stopPropagation();
    
    bringToFront(id);
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: card.size.width,
      height: card.size.height,
    });
  };

  const handleMinimize = () => {
    toggleMinimize(id);
    saveLayout();
  };

  const handleClose = () => {
    if (isClosable) {
      unregisterCard(id);
      saveLayout();
    }
  };

  const handleDockLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    dockCard(id, 'left');
    saveLayout();
  };

  const handleDockRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    dockCard(id, 'right');
    saveLayout();
  };

  const handlePopOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    dockCard(id, 'floating');
    saveLayout();
  };

  const handleCardClick = () => {
    bringToFront(id);
  };

  const isFloating = card.dockPosition === 'floating';

  // If docked, we render a static block (no drag/drop absolute positioning).
  if (!isFloating) {
    return (
      <div className={cn("relative w-full mb-4", className)}>
        <Card className="flex flex-col shadow-sm border-border bg-card/95 backdrop-blur">
          {!hideHeader && (
            <CardHeader
              className="flex flex-row items-center justify-between space-y-0 p-3 border-b border-border bg-card/50"
            >
              <h3 className="text-sm font-semibold text-card-foreground truncate">{title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePopOut} title="Pop Out to Map">
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleMinimize}>
                  {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                </Button>
                {isClosable && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardHeader>
          )}
          {!isMinimized && (
            <CardContent className={cn("flex-1 overflow-auto p-4", hideHeader && "scrollbar-hide")}>
              {children}
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  // Otherwise, render full floating card
  return (
    <div
      ref={cardRef}
      className={cn(
        'fixed transition-shadow',
        isDragging && 'cursor-move',
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? 'auto' : `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
        zIndex,
      }}
      onClick={handleCardClick}
    >
      <Card 
        className="h-full flex flex-col shadow-lg border-border"
        onMouseDown={fullCardDraggable ? handleMouseDown : undefined}
      >
        {!hideHeader && (
          <CardHeader
            ref={headerRef}
            className="flex flex-row items-center justify-between space-y-0 p-3 cursor-move border-b border-border bg-card"
            onMouseDown={!fullCardDraggable ? handleMouseDown : undefined}
          >
            <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDockLeft} title="Dock Left">
                <PanelLeft className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDockRight} title="Dock Right">
                <PanelRight className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleMinimize}
              >
                {isMinimized ? (
                  <Maximize2 className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
              </Button>
              {isClosable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleClose}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
        )}

        {!isMinimized && (
          <>
            <CardContent className={cn(
              "flex-1 overflow-auto p-4",
              hideHeader && "scrollbar-hide"
            )}>
              {children}
            </CardContent>

            {isResizable && (
              <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                onMouseDown={handleResizeMouseDown}
              >
                <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-border" />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
