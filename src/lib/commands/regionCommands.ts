/**
 * Region Commands for Undo/Redo
 */

import { Command } from '../undoRedoManager';
import { useRegionStore, CanvasRegion } from '@/stores/regionStore';

/**
 * Batch command for group rotation — captures before/after state
 * for every region in a group so undo/redo restores all members together.
 */
export class BatchRegionRotationCommand implements Command {
  type = 'BATCH_REGION_ROTATION';
  description = 'Rotate group';
  private entries: Array<{ id: string; before: Partial<CanvasRegion>; after: Partial<CanvasRegion> }>;

  constructor(entries: Array<{ id: string; before: Partial<CanvasRegion>; after: Partial<CanvasRegion> }>) {
    this.entries = entries;
  }

  execute(): void {
    const { updateRegion } = useRegionStore.getState();
    for (const e of this.entries) {
      updateRegion(e.id, e.after);
    }
  }

  undo(): void {
    const { updateRegion } = useRegionStore.getState();
    for (const e of this.entries) {
      updateRegion(e.id, e.before);
    }
  }
}

/**
 * Command for adding a region
 */
export class AddRegionCommand implements Command {
  type = 'ADD_REGION';
  description: string;
  private region: CanvasRegion;

  constructor(region: CanvasRegion) {
    this.region = region;
    this.description = `Add region ${region.id}`;
  }

  execute(): void {
    useRegionStore.getState().addRegion(this.region);
  }

  undo(): void {
    useRegionStore.getState().removeRegion(this.region.id);
  }
}

/**
 * Command for removing a region
 */
export class RemoveRegionCommand implements Command {
  type = 'REMOVE_REGION';
  description: string;
  private region: CanvasRegion;

  constructor(region: CanvasRegion) {
    this.region = region;
    this.description = `Remove region ${region.id}`;
  }

  execute(): void {
    useRegionStore.getState().removeRegion(this.region.id);
  }

  undo(): void {
    useRegionStore.getState().addRegion(this.region);
  }
}

/**
 * Command for updating region properties
 */
export class UpdateRegionCommand implements Command {
  type = 'UPDATE_REGION';
  description: string;
  private regionId: string;
  private previousState: Partial<CanvasRegion>;
  private newState: Partial<CanvasRegion>;

  constructor(
    regionId: string,
    previousState: Partial<CanvasRegion>,
    newState: Partial<CanvasRegion>,
    description?: string
  ) {
    this.regionId = regionId;
    this.previousState = previousState;
    this.newState = newState;
    this.description = description || `Update region ${regionId}`;
  }

  execute(): void {
    useRegionStore.getState().updateRegion(this.regionId, this.newState);
  }

  undo(): void {
    useRegionStore.getState().updateRegion(this.regionId, this.previousState);
  }
}

/**
 * Command for moving a region (position change)
 */
export class MoveRegionCommand implements Command {
  type = 'MOVE_REGION';
  description: string;
  private regionId: string;
  private previousPosition: { x: number; y: number };
  private newPosition: { x: number; y: number };

  constructor(
    regionId: string,
    previousPosition: { x: number; y: number },
    newPosition: { x: number; y: number }
  ) {
    this.regionId = regionId;
    this.previousPosition = previousPosition;
    this.newPosition = newPosition;
    this.description = `Move region ${regionId}`;
  }

  execute(): void {
    useRegionStore.getState().updateRegion(this.regionId, this.newPosition);
  }

  undo(): void {
    useRegionStore.getState().updateRegion(this.regionId, this.previousPosition);
  }
}

/**
 * Command for transforming a region (resize, rotate)
 */
export class TransformRegionCommand implements Command {
  type = 'TRANSFORM_REGION';
  description: string;
  private regionId: string;
  private previousState: Partial<CanvasRegion>;
  private newState: Partial<CanvasRegion>;

  constructor(
    regionId: string,
    previousState: Partial<CanvasRegion>,
    newState: Partial<CanvasRegion>
  ) {
    this.regionId = regionId;
    this.previousState = previousState;
    this.newState = newState;
    this.description = `Transform region ${regionId}`;
  }

  execute(): void {
    useRegionStore.getState().updateRegion(this.regionId, this.newState);
  }

  undo(): void {
    useRegionStore.getState().updateRegion(this.regionId, this.previousState);
  }
}
