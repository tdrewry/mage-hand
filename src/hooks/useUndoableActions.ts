/**
 * Hook for undoable actions
 * 
 * Provides wrapper functions that execute actions through the undo/redo system
 */

import { useCallback } from 'react';
import { undoRedoManager } from '@/lib/undoRedoManager';
import {
  AddRegionCommand,
  RemoveRegionCommand,
  UpdateRegionCommand,
  MoveRegionCommand,
  TransformRegionCommand,
} from '@/lib/commands/regionCommands';
import {
  AddTokenCommand,
  RemoveTokenCommand,
  MoveTokenCommand,
  UpdateTokenCommand,
} from '@/lib/commands/tokenCommands';
import {
  FogRevealCommand,
  ClearFogCommand,
} from '@/lib/commands/fogCommands';
import { useRegionStore, CanvasRegion } from '@/stores/regionStore';
import { useSessionStore, Token } from '@/stores/sessionStore';
import { useFogStore } from '@/stores/fogStore';

export const useUndoableActions = () => {
  const { regions } = useRegionStore();
  const { tokens } = useSessionStore();
  const { serializedExploredAreas } = useFogStore();

  // Region actions
  const addRegionUndoable = useCallback((region: CanvasRegion) => {
    const command = new AddRegionCommand(region);
    undoRedoManager.execute(command);
  }, []);

  const removeRegionUndoable = useCallback((regionId: string) => {
    const region = regions.find(r => r.id === regionId);
    if (!region) return;
    
    const command = new RemoveRegionCommand(region);
    undoRedoManager.execute(command);
  }, [regions]);

  const updateRegionUndoable = useCallback((
    regionId: string,
    updates: Partial<CanvasRegion>,
    description?: string
  ) => {
    const region = regions.find(r => r.id === regionId);
    if (!region) return;

    // Capture previous state
    const previousState: Partial<CanvasRegion> = {};
    (Object.keys(updates) as Array<keyof CanvasRegion>).forEach((key) => {
      (previousState as any)[key] = region[key];
    });

    const command = new UpdateRegionCommand(regionId, previousState, updates, description);
    undoRedoManager.execute(command);
  }, [regions]);

  const moveRegionUndoable = useCallback((
    regionId: string,
    previousPosition: { x: number; y: number },
    newPosition: { x: number; y: number }
  ) => {
    const command = new MoveRegionCommand(regionId, previousPosition, newPosition);
    undoRedoManager.execute(command);
  }, []);

  const transformRegionUndoable = useCallback((
    regionId: string,
    previousState: Partial<CanvasRegion>,
    newState: Partial<CanvasRegion>
  ) => {
    const command = new TransformRegionCommand(regionId, previousState, newState);
    undoRedoManager.execute(command);
  }, []);

  // Token actions
  const addTokenUndoable = useCallback((token: Token) => {
    const command = new AddTokenCommand(token);
    undoRedoManager.execute(command);
  }, []);

  const removeTokenUndoable = useCallback((tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    const command = new RemoveTokenCommand(token);
    undoRedoManager.execute(command);
  }, [tokens]);

  const moveTokenUndoable = useCallback((
    tokenId: string,
    previousPosition: { x: number; y: number },
    newPosition: { x: number; y: number },
    tokenLabel?: string
  ) => {
    const command = new MoveTokenCommand(tokenId, previousPosition, newPosition, tokenLabel);
    undoRedoManager.execute(command);
  }, []);

  const updateTokenUndoable = useCallback((
    tokenId: string,
    updates: Partial<Token>,
    description?: string
  ) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    // Capture previous state
    const previousState: Partial<Token> = {};
    (Object.keys(updates) as Array<keyof Token>).forEach((key) => {
      (previousState as any)[key] = token[key];
    });

    const command = new UpdateTokenCommand(tokenId, previousState, updates, description);
    undoRedoManager.execute(command);
  }, [tokens]);

  // Fog actions
  const revealFogUndoable = useCallback((newFogState: string) => {
    const command = new FogRevealCommand(serializedExploredAreas, newFogState);
    undoRedoManager.execute(command);
  }, [serializedExploredAreas]);

  const clearFogUndoable = useCallback(() => {
    const command = new ClearFogCommand(serializedExploredAreas);
    undoRedoManager.execute(command);
  }, [serializedExploredAreas]);

  return {
    // Region actions
    addRegionUndoable,
    removeRegionUndoable,
    updateRegionUndoable,
    moveRegionUndoable,
    transformRegionUndoable,
    
    // Token actions
    addTokenUndoable,
    removeTokenUndoable,
    moveTokenUndoable,
    updateTokenUndoable,
    
    // Fog actions
    revealFogUndoable,
    clearFogUndoable,
  };
};
