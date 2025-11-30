/**
 * Fog Commands for Undo/Redo
 */

import { Command } from '../undoRedoManager';
import { useFogStore } from '@/stores/fogStore';

/**
 * Command for fog reveal/manipulation
 */
export class FogRevealCommand implements Command {
  type = 'FOG_REVEAL';
  description = 'Reveal fog area';
  private previousState: string;
  private newState: string;

  constructor(previousState: string, newState: string) {
    this.previousState = previousState;
    this.newState = newState;
  }

  execute(): void {
    useFogStore.getState().setSerializedExploredAreas(this.newState);
  }

  undo(): void {
    useFogStore.getState().setSerializedExploredAreas(this.previousState);
  }
}

/**
 * Command for clearing all fog
 */
export class ClearFogCommand implements Command {
  type = 'CLEAR_FOG';
  description = 'Clear all fog';
  private previousState: string;

  constructor(previousState: string) {
    this.previousState = previousState;
  }

  execute(): void {
    useFogStore.getState().clearExploredAreas();
  }

  undo(): void {
    useFogStore.getState().setSerializedExploredAreas(this.previousState);
  }
}
