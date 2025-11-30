/**
 * Undo/Redo Store
 * 
 * Manages undo/redo state and provides React integration
 */

import { create } from 'zustand';
import { undoRedoManager } from '@/lib/undoRedoManager';

interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription?: string;
  redoDescription?: string;
  
  // Actions
  undo: () => void;
  redo: () => void;
  clear: () => void;
  updateState: () => void;
}

export const useUndoRedoStore = create<UndoRedoState>((set) => ({
  canUndo: false,
  canRedo: false,
  undoDescription: undefined,
  redoDescription: undefined,

  undo: () => {
    undoRedoManager.undo();
    set({
      canUndo: undoRedoManager.canUndo(),
      canRedo: undoRedoManager.canRedo(),
      undoDescription: undoRedoManager.getUndoDescription(),
      redoDescription: undoRedoManager.getRedoDescription(),
    });
  },

  redo: () => {
    undoRedoManager.redo();
    set({
      canUndo: undoRedoManager.canUndo(),
      canRedo: undoRedoManager.canRedo(),
      undoDescription: undoRedoManager.getUndoDescription(),
      redoDescription: undoRedoManager.getRedoDescription(),
    });
  },

  clear: () => {
    undoRedoManager.clear();
    set({
      canUndo: false,
      canRedo: false,
      undoDescription: undefined,
      redoDescription: undefined,
    });
  },

  updateState: () => {
    set({
      canUndo: undoRedoManager.canUndo(),
      canRedo: undoRedoManager.canRedo(),
      undoDescription: undoRedoManager.getUndoDescription(),
      redoDescription: undoRedoManager.getRedoDescription(),
    });
  },
}));

// Subscribe to manager changes
undoRedoManager.subscribe(() => {
  useUndoRedoStore.getState().updateState();
});
