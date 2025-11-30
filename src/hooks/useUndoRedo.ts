/**
 * Hook for Undo/Redo functionality
 * 
 * Provides keyboard shortcuts and undo/redo actions
 */

import { useEffect } from 'react';
import { useUndoRedoStore } from '@/stores/undoRedoStore';
import { toast } from 'sonner';

export const useUndoRedo = (enabled = true) => {
  const { undo, redo, canUndo, canRedo, undoDescription, redoDescription } = useUndoRedoStore();

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
          toast.success(`Undo: ${undoDescription || 'Last action'}`);
        } else {
          toast.info('Nothing to undo');
        }
      }
      
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      // Also Ctrl+Y or Cmd+Y
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        if (canRedo) {
          redo();
          toast.success(`Redo: ${redoDescription || 'Last undone action'}`);
        } else {
          toast.info('Nothing to redo');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, canUndo, canRedo, undo, redo, undoDescription, redoDescription]);

  return {
    undo: () => {
      if (canUndo) {
        undo();
        toast.success(`Undo: ${undoDescription || 'Last action'}`);
      }
    },
    redo: () => {
      if (canRedo) {
        redo();
        toast.success(`Redo: ${redoDescription || 'Last undone action'}`);
      }
    },
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
  };
};
