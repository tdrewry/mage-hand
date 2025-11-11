import { useState, useCallback, useEffect } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import type { Token } from '@/stores/sessionStore';

export const useTokenInteraction = () => {
  const { tokens, updateTokenPosition } = useSessionStore();
  
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [isDraggingToken, setIsDraggingToken] = useState(false);
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragPath, setDragPath] = useState<{ x: number, y: number }[]>([]);
  const [groupedTokens, setGroupedTokens] = useState<{tokenId: string, startX: number, startY: number}[]>([]);

  const getTokenAtPosition = useCallback((worldX: number, worldY: number): Token | null => {
    const baseTokenSize = 40;
    
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];
      const tokenWidth = (token.gridWidth || 1) * baseTokenSize;
      const tokenHeight = (token.gridHeight || 1) * baseTokenSize;
      const maxRadius = Math.max(tokenWidth, tokenHeight) / 2;
      
      const distance = Math.sqrt(
        Math.pow(worldX - token.x, 2) + Math.pow(worldY - token.y, 2)
      );
      
      if (distance <= maxRadius) {
        return token;
      }
    }
    
    return null;
  }, [tokens]);

  const startTokenDrag = useCallback((tokenId: string, worldX: number, worldY: number, isMultiSelect: boolean) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    setIsDraggingToken(true);
    setDraggedTokenId(tokenId);
    setDragOffset({ x: worldX - token.x, y: worldY - token.y });
    setDragStartPos({ x: token.x, y: token.y });
    setDragPath([{ x: token.x, y: token.y }]);

    // Handle multi-selection
    if (isMultiSelect && selectedTokenIds.includes(tokenId)) {
      const grouped = selectedTokenIds.map(id => {
        const t = tokens.find(tk => tk.id === id);
        return t ? { tokenId: id, startX: t.x, startY: t.y } : null;
      }).filter(Boolean) as {tokenId: string, startX: number, startY: number}[];
      setGroupedTokens(grouped);
    } else {
      if (!isMultiSelect) {
        setSelectedTokenIds([tokenId]);
      }
      setGroupedTokens([]);
    }
  }, [tokens, selectedTokenIds]);

  const updateTokenDrag = useCallback((worldX: number, worldY: number) => {
    if (!isDraggingToken || !draggedTokenId) return;

    const newX = worldX - dragOffset.x;
    const newY = worldY - dragOffset.y;

    setDragPath(prev => [...prev, { x: newX, y: newY }]);

    // Update grouped tokens if any
    if (groupedTokens.length > 0) {
      const dragDeltaX = newX - dragStartPos.x;
      const dragDeltaY = newY - dragStartPos.y;

      groupedTokens.forEach(({ tokenId, startX, startY }) => {
        updateTokenPosition(tokenId, startX + dragDeltaX, startY + dragDeltaY);
      });
    } else {
      updateTokenPosition(draggedTokenId, newX, newY);
    }
  }, [isDraggingToken, draggedTokenId, dragOffset, dragStartPos, groupedTokens, updateTokenPosition]);

  const endTokenDrag = useCallback(() => {
    setIsDraggingToken(false);
    setDraggedTokenId(null);
    setDragPath([]);
    setGroupedTokens([]);
  }, []);

  const selectToken = useCallback((tokenId: string, isMultiSelect: boolean) => {
    if (isMultiSelect) {
      setSelectedTokenIds(prev => 
        prev.includes(tokenId) 
          ? prev.filter(id => id !== tokenId)
          : [...prev, tokenId]
      );
    } else {
      setSelectedTokenIds([tokenId]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTokenIds([]);
  }, []);

  // Global mouseup listener to ensure drag state is always reset
  useEffect(() => {
    if (isDraggingToken) {
      const handleGlobalMouseUp = () => {
        endTokenDrag();
      };

      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDraggingToken, endTokenDrag]);

  return {
    selectedTokenIds,
    isDraggingToken,
    draggedTokenId,
    dragPath,
    getTokenAtPosition,
    startTokenDrag,
    updateTokenDrag,
    endTokenDrag,
    selectToken,
    clearSelection
  };
};
