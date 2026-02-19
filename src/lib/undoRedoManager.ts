/**
 * Command-based Undo/Redo Manager
 * 
 * Implements the Command pattern for undoable actions.
 * Each action type (region, token, fog) has corresponding commands
 * that can execute and undo themselves.
 */

export interface Command {
  execute: () => void;
  undo: () => void;
  type: string; // For debugging/logging
  description?: string; // Human-readable description
  timestamp?: number; // When the command was executed
}

export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize = 50; // Limit history to prevent memory issues
  
  private listeners: Array<() => void> = [];

  /**
   * Execute a command and add it to undo history
   */
  execute(command: Command): void {
    // Add timestamp
    command.timestamp = Date.now();
    
    command.execute();
    this.undoStack.push(command);
    
    // Clear redo stack when new action is performed
    this.redoStack = [];
    
    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    
    this.notifyListeners();
  }

  /**
   * Push a command onto the undo stack WITHOUT executing it.
   * Use when the action has already been applied to the store
   * (e.g., live updates during drag/rotation) and you only need
   * undo/redo capability going forward.
   */
  push(command: Command): void {
    command.timestamp = Date.now();
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    this.notifyListeners();
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    
    command.undo();
    this.redoStack.push(command);
    
    this.notifyListeners();
    return true;
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    
    command.execute();
    this.undoStack.push(command);
    
    this.notifyListeners();
    return true;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the last command description for UI display
   */
  getUndoDescription(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.description;
  }

  /**
   * Get the next redo command description for UI display
   */
  getRedoDescription(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.description;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  /**
   * Subscribe to history changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  /**
   * Get the complete undo history for display
   */
  getUndoHistory(): Command[] {
    return [...this.undoStack];
  }

  /**
   * Get the complete redo history for display
   */
  getRedoHistory(): Command[] {
    return [...this.redoStack];
  }

  /**
   * Undo multiple commands to reach a specific point in history
   * @param targetIndex - Index in undo stack to revert to (0 = oldest, length-1 = newest)
   */
  undoToIndex(targetIndex: number): boolean {
    if (targetIndex < 0 || targetIndex >= this.undoStack.length) {
      return false;
    }

    // Undo from current position back to target
    const currentIndex = this.undoStack.length - 1;
    const stepsToUndo = currentIndex - targetIndex;

    for (let i = 0; i < stepsToUndo; i++) {
      const command = this.undoStack.pop();
      if (!command) break;
      
      command.undo();
      this.redoStack.push(command);
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Redo multiple commands to reach a specific point in future history
   * @param targetIndex - Index in redo stack to advance to
   */
  redoToIndex(targetIndex: number): boolean {
    if (targetIndex < 0 || targetIndex >= this.redoStack.length) {
      return false;
    }

    // Redo from current position forward to target
    const stepsToRedo = this.redoStack.length - targetIndex;

    for (let i = 0; i < stepsToRedo; i++) {
      const command = this.redoStack.pop();
      if (!command) break;
      
      command.execute();
      this.undoStack.push(command);
    }

    this.notifyListeners();
    return true;
  }
}

// Global singleton instance
export const undoRedoManager = new UndoRedoManager();
