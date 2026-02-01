/**
 * Undo/Redo Store
 * 
 * Manages undo/redo state and provides React integration
 */

import { create } from 'zustand';
import { undoRedoManager, type Command } from '@/lib/undoRedoManager';

interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription?: string;
  redoDescription?: string;
  undoHistory: Command[];
  redoHistory: Command[];
  
  // Actions
  /**
   * Performs an undo operation.
   */
  undo: () => void;

  /**
   * Performs a redo operation.
   */
  redo: () => void;

  /**
   * Clears the undo and redo history.
   */
  clear: () => void;

  /**
   * Updates the store state from the undo/redo manager.
   */
  updateState: () => void;

  /**
   * Undoes all commands up to the specified index in the history.
   * @param index The index to undo to.
   */
  undoToIndex: (index: number) => void;

  /**
   * Redoes all commands up to the specified index in the history.
   * @param index The index to redo to.
   */
  redoToIndex: (index: number) => void;
}

export const useUndoRedoStore = create<UndoRedoState>((set) => ({
  canUndo: false,
  canRedo: false,
  undoDescription: undefined,
  redoDescription: undefined,
  undoHistory: [],
  redoHistory: [],

  undo: () => {
    undoRedoManager.undo();
    set({
      canUndo: undoRedoManager.canUndo(),
      canRedo: undoRedoManager.canRedo(),
      undoDescription: undoRedoManager.getUndoDescription(),
      redoDescription: undoRedoManager.getRedoDescription(),
      undoHistory: undoRedoManager.getUndoHistory(),
      redoHistory: undoRedoManager.getRedoHistory(),
    });
  },

  redo: () => {
    undoRedoManager.redo();
    set({
      canUndo: undoRedoManager.canUndo(),
      canRedo: undoRedoManager.canRedo(),
      undoDescription: undoRedoManager.getUndoDescription(),
      redoDescription: undoRedoManager.getRedoDescription(),
      undoHistory: undoRedoManager.getUndoHistory(),
      redoHistory: undoRedoManager.getRedoHistory(),
    });
  },

  clear: () => {
    undoRedoManager.clear();
    set({
      canUndo: false,
      canRedo: false,
      undoDescription: undefined,
      redoDescription: undefined,
      undoHistory: [],
      redoHistory: [],
    });
  },

  updateState: () => {
    set({
      canUndo: undoRedoManager.canUndo(),
      canRedo: undoRedoManager.canRedo(),
      undoDescription: undoRedoManager.getUndoDescription(),
      redoDescription: undoRedoManager.getRedoDescription(),
      undoHistory: undoRedoManager.getUndoHistory(),
      redoHistory: undoRedoManager.getRedoHistory(),
    });
  },

  undoToIndex: (index: number) => {
    undoRedoManager.undoToIndex(index);
    set({
      canUndo: undoRedoManager.canUndo(),
      canRedo: undoRedoManager.canRedo(),
      undoDescription: undoRedoManager.getUndoDescription(),
      redoDescription: undoRedoManager.getRedoDescription(),
      undoHistory: undoRedoManager.getUndoHistory(),
      redoHistory: undoRedoManager.getRedoHistory(),
    });
  },

  redoToIndex: (index: number) => {
    undoRedoManager.redoToIndex(index);
    set({
      canUndo: undoRedoManager.canUndo(),
      canRedo: undoRedoManager.canRedo(),
      undoDescription: undoRedoManager.getUndoDescription(),
      redoDescription: undoRedoManager.getRedoDescription(),
      undoHistory: undoRedoManager.getUndoHistory(),
      redoHistory: undoRedoManager.getRedoHistory(),
    });
  },
}));

// Subscribe to manager changes
undoRedoManager.subscribe(() => {
  useUndoRedoStore.getState().updateState();
});
