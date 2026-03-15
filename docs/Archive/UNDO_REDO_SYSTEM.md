# Undo/Redo System Documentation

## Overview

The application now features a comprehensive undo/redo system using the Command pattern. This allows users to undo and redo:
- Region drawing and transformations
- Token placement and movement
- Fog of war manipulation

## Architecture

### Command Pattern
Each undoable action is implemented as a Command that has:
- `execute()`: Performs the action
- `undo()`: Reverses the action
- `type`: Identifies the command type
- `description`: Human-readable description for UI

### Core Components

1. **UndoRedoManager** (`src/lib/undoRedoManager.ts`)
   - Singleton manager that maintains undo/redo stacks
   - Maximum 50 actions in history
   - Notifies subscribers of state changes

2. **Command Implementations** (`src/lib/commands/`)
   - `regionCommands.ts`: Add, remove, move, transform regions
   - `tokenCommands.ts`: Add, remove, move, update tokens
   - `fogCommands.ts`: Reveal and clear fog

3. **Zustand Store** (`src/stores/undoRedoStore.ts`)
   - React integration for undo/redo state
   - Provides `canUndo`, `canRedo` states
   - Exposes `undo()` and `redo()` actions

4. **React Hooks**
   - `useUndoRedo`: Enables keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
   - `useUndoableActions`: Provides wrapper functions for undoable operations

## Usage

### Keyboard Shortcuts

- **Ctrl+Z** (or Cmd+Z on Mac): Undo last action
- **Ctrl+Shift+Z** (or Cmd+Shift+Z): Redo last undone action
- **Ctrl+Y** (or Cmd+Y): Alternative redo shortcut

### UI Buttons

Undo/Redo buttons appear in the vertical toolbar in both Edit and Play modes:
- Buttons are disabled when no actions are available
- Hover shows tooltip with action description
- Clicking executes undo/redo with toast notification

### Programmatic Usage

#### Direct Command Execution

```typescript
import { undoRedoManager } from '@/lib/undoRedoManager';
import { AddTokenCommand } from '@/lib/commands';

// Create and execute a command
const command = new AddTokenCommand(newToken);
undoRedoManager.execute(command);
```

#### Using Undoable Actions Hook

```typescript
import { useUndoableActions } from '@/hooks/useUndoableActions';

const MyComponent = () => {
  const { addTokenUndoable, moveTokenUndoable } = useUndoableActions();
  
  // Add a token (undoable)
  addTokenUndoable(newToken);
  
  // Move a token (undoable)
  moveTokenUndoable(tokenId, { x: 100, y: 200 });
};
```

## Supported Actions

### Region Actions
- **Add Region**: Creating new regions
- **Remove Region**: Deleting regions
- **Move Region**: Changing region position
- **Transform Region**: Resize, rotate, or modify shape
- **Update Region**: Changing properties (color, grid, etc.)

### Token Actions
- **Add Token**: Placing new tokens
- **Remove Token**: Deleting tokens
- **Move Token**: Changing token position
- **Update Token**: Modifying token properties

### Fog Actions
- **Reveal Fog**: Uncovering areas through token vision
- **Clear Fog**: Resetting all fog of war

## Implementation Notes

### When to Use Commands

Use the command pattern for user-initiated actions that should be undoable:
- ✅ Drag and drop operations
- ✅ Drawing tools
- ✅ Property edits through UI
- ✅ Batch operations

Don't use for:
- ❌ Multiplayer sync events (these come from other users)
- ❌ Automatic updates (e.g., fog recalculation)
- ❌ Temporary preview states during dragging

### Batching Multiple Actions

For operations that involve multiple changes, create a composite command:

```typescript
class BatchUpdateCommand implements Command {
  private commands: Command[];
  
  constructor(commands: Command[]) {
    this.commands = commands;
  }
  
  execute() {
    this.commands.forEach(cmd => cmd.execute());
  }
  
  undo() {
    // Undo in reverse order
    [...this.commands].reverse().forEach(cmd => cmd.undo());
  }
}
```

### Performance Considerations

- History is limited to 50 actions to prevent memory issues
- Commands store minimal state (just what's needed to undo/redo)
- Drag operations should only create one undo entry (on drag end, not during drag)

## Testing

Test undo/redo functionality by:
1. Performing an action (e.g., place a token)
2. Press Ctrl+Z - action should be undone
3. Press Ctrl+Shift+Z - action should be redone
4. Verify toast notifications appear
5. Check toolbar buttons enable/disable correctly

## Future Enhancements

Potential improvements:
- Undo/redo for initiative order changes
- Undo/redo for map changes
- Undo/redo for light placement
- Persistent history across sessions
- Undo/redo menu with action list
- Selective undo (undo specific action from history)
