import { useState, useCallback, useEffect } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useRoleStore } from '@/stores/roleStore';
import { useMapObjectStore } from '@/stores/mapObjectStore';
import { useRegionStore } from '@/stores/regionStore';
import { useDungeonStore } from '@/stores/dungeonStore';
import { canControlToken, canSeeToken } from '@/lib/rolePermissions';
import { checkMovementCollision, getBlockingObjects } from '@/lib/movementCollision';
import { toast } from 'sonner';
import type { Token } from '@/stores/sessionStore';

/**
 * Custom hook for handling token interactions such as selection, dragging, and movement.
 * Manages local interaction state and updates the global session store.
 * @returns An object containing token interaction state and methods.
 */
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
      const radiusX = tokenWidth / 2;
      const radiusY = tokenHeight / 2;
      
      // Point-in-ellipse test: (x/a)² + (y/b)² <= 1
      const normalizedX = (worldX - token.x) / radiusX;
      const normalizedY = (worldY - token.y) / radiusY;
      
      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
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

    // Check if movement is globally locked (but allow in Edit mode)
    const movementLocked = useInitiativeStore.getState().restrictMovement;
    if (movementLocked) {
      // Import dungeonStore to check rendering mode
      const { useDungeonStore } = require('@/stores/dungeonStore');
      const renderingMode = useDungeonStore.getState().renderingMode;
      
      // Only block movement in Play mode
      if (renderingMode === 'play') {
        toast.error('Token movement is locked');
        return;
      }
    }

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

  // Track if we've shown a block notification recently to avoid spam
  const [lastBlockNotification, setLastBlockNotification] = useState<number>(0);
  
  const updateTokenDrag = useCallback((worldX: number, worldY: number) => {
    if (!isDraggingToken || !draggedTokenId) return;

    const token = tokens.find(t => t.id === draggedTokenId);
    if (!token) return;

    const desiredX = worldX - dragOffset.x;
    const desiredY = worldY - dragOffset.y;

    // Get movement blocking settings from dungeonStore
    const { enforceMovementBlocking, enforceRegionBounds, renderingMode } = useDungeonStore.getState();
    
    // Only enforce collisions in Play mode
    const shouldEnforceCollisions = renderingMode === 'play';
    
    let finalX = desiredX;
    let finalY = desiredY;

    if (shouldEnforceCollisions && (enforceMovementBlocking || enforceRegionBounds)) {
      // Calculate token radius for collision
      const baseTokenSize = 40;
      const tokenRadius = ((token.gridWidth || 1) * baseTokenSize) / 2;

      // Get blocking objects
      const mapObjects = useMapObjectStore.getState().mapObjects;
      const blockingObjects = enforceMovementBlocking ? getBlockingObjects(mapObjects) : [];
      
      // Get regions for boundary constraint
      const regions = enforceRegionBounds ? useRegionStore.getState().regions : [];

      // Check for collisions from original drag start position
      const collisionResult = checkMovementCollision(
        dragStartPos,
        { x: desiredX, y: desiredY },
        tokenRadius,
        blockingObjects,
        regions,
        { enforceMovementBlocking, enforceRegionBounds }
      );

      finalX = collisionResult.validPosition.x;
      finalY = collisionResult.validPosition.y;
      
      // Check if movement was blocked (position differs significantly from desired)
      const positionChanged = Math.abs(finalX - desiredX) > 1 || Math.abs(finalY - desiredY) > 1;
      if (collisionResult.blocked && positionChanged) {
        // Force end the drag - token stops at last valid position
        let blockReason = '';
        if (collisionResult.collidedWith) {
          const blockingObj = mapObjects.find(obj => obj.id === collisionResult.collidedWith);
          blockReason = blockingObj?.category === 'door' ? 'Blocked by closed door' : 'Blocked by obstacle';
        } else {
          blockReason = 'Cannot leave region boundary';
        }
        
        // Update token to the valid position before ending drag
        if (groupedTokens.length > 0) {
          const dragDeltaX = finalX - dragStartPos.x;
          const dragDeltaY = finalY - dragStartPos.y;
          groupedTokens.forEach(({ tokenId, startX, startY }) => {
            updateTokenPosition(tokenId, startX + dragDeltaX, startY + dragDeltaY);
          });
        } else {
          updateTokenPosition(draggedTokenId, finalX, finalY);
        }
        
        // Show notification (throttled)
        const now = Date.now();
        if (now - lastBlockNotification > 1500) {
          toast.warning(blockReason, { duration: 1000 });
          setLastBlockNotification(now);
        }
        
        // Force end the drag operation
        setIsDraggingToken(false);
        setDraggedTokenId(null);
        setDragPath([]);
        setGroupedTokens([]);
        return;
      }
    }

    setDragPath(prev => [...prev, { x: finalX, y: finalY }]);

    // Update grouped tokens if any
    if (groupedTokens.length > 0) {
      const dragDeltaX = finalX - dragStartPos.x;
      const dragDeltaY = finalY - dragStartPos.y;

      groupedTokens.forEach(({ tokenId, startX, startY }) => {
        updateTokenPosition(tokenId, startX + dragDeltaX, startY + dragDeltaY);
      });
    } else {
      updateTokenPosition(draggedTokenId, finalX, finalY);
    }
  }, [isDraggingToken, draggedTokenId, dragOffset, dragStartPos, groupedTokens, updateTokenPosition, tokens, lastBlockNotification]);

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
