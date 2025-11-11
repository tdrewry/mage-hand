import { useState, useCallback, useEffect } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useRoleStore } from '@/stores/roleStore';
import { canControlToken, canSeeToken } from '@/lib/rolePermissions';
import { toast } from 'sonner';
import type { Token } from '@/stores/sessionStore';

export const useTokenInteraction = () => {
  const { tokens, updateTokenPosition, currentPlayerId, players } = useSessionStore();
  const { roles } = useRoleStore();
  
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [isDraggingToken, setIsDraggingToken] = useState(false);
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragPath, setDragPath] = useState<{ x: number, y: number }[]>([]);
  const [groupedTokens, setGroupedTokens] = useState<{tokenId: string, startX: number, startY: number}[]>([]);

  const getTokenAtPosition = useCallback((worldX: number, worldY: number): Token | null => {
    const baseTokenSize = 40;
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    
    if (!currentPlayer) return null;
    
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i];
      
      // Check if player can see this token
      if (!canSeeToken(token, currentPlayer, roles)) {
        continue;
      }
      
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
  }, [tokens, currentPlayerId, players, roles]);

  const startTokenDrag = useCallback((tokenId: string, worldX: number, worldY: number, isMultiSelect: boolean) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    const currentPlayer = players.find(p => p.id === currentPlayerId);
    if (!currentPlayer) return;

    // Check if player can control this token
    if (!canControlToken(token, currentPlayer, roles)) {
      const role = roles.find(r => r.id === token.roleId);
      const roleName = role ? role.name : 'this';
      toast.error(`You don't have permission to move ${roleName} tokens`);
      return;
    }

    setIsDraggingToken(true);
    setDraggedTokenId(tokenId);
    setDragOffset({ x: worldX - token.x, y: worldY - token.y });
    setDragStartPos({ x: token.x, y: token.y });
    setDragPath([{ x: token.x, y: token.y }]);

    // Handle multi-selection
    if (isMultiSelect && selectedTokenIds.includes(tokenId)) {
      // Filter grouped tokens to only those the player can control
      const grouped = selectedTokenIds
        .map(id => {
          const t = tokens.find(tk => tk.id === id);
          if (!t) return null;
          
          // Check permission for each token in the group
          if (!canControlToken(t, currentPlayer, roles)) {
            return null;
          }
          
          return { tokenId: id, startX: t.x, startY: t.y };
        })
        .filter(Boolean) as {tokenId: string, startX: number, startY: number}[];
      
      if (grouped.length < selectedTokenIds.length) {
        toast.warning('Some selected tokens cannot be moved due to permissions');
      }
      
      setGroupedTokens(grouped);
    } else {
      if (!isMultiSelect) {
        setSelectedTokenIds([tokenId]);
      }
      setGroupedTokens([]);
    }
  }, [tokens, selectedTokenIds, currentPlayerId, players, roles]);

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
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    const currentPlayer = players.find(p => p.id === currentPlayerId);
    if (!currentPlayer) return;

    // Check if player can see this token
    if (!canSeeToken(token, currentPlayer, roles)) {
      return;
    }

    if (isMultiSelect) {
      setSelectedTokenIds(prev => 
        prev.includes(tokenId) 
          ? prev.filter(id => id !== tokenId)
          : [...prev, tokenId]
      );
    } else {
      setSelectedTokenIds([tokenId]);
    }
  }, [tokens, currentPlayerId, players, roles]);

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
