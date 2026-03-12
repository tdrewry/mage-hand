/**
 * Editor-specific types for UI state, tools, and modes.
 */

export type EditorMode = 'campaign' | 'node' | 'map';

export type EditorToolMode = 'select' | 'paint' | 'erase' | 'objective' | 'deployment';

export interface EditorTool {
  mode: EditorToolMode;
  terrainType?: string;
  objectiveType?: 'primary' | 'secondary' | 'bonus';
  brushSize: 1 | 2 | 3;
}

export const DEFAULT_EDITOR_TOOL: EditorTool = {
  mode: 'select',
  brushSize: 1,
};

export type TextFieldId =
  | 'campaign-description'
  | 'node-description'
  | 'node-prologue'
  | 'success-epilogue'
  | 'failure-epilogue'
  | 'objective-description';

export interface TextEntryState {
  isOpen: boolean;
  fieldId: TextFieldId | null;
  fieldLabel: string;
  value: string;
  onSave: (value: string) => void;
}

export const INITIAL_TEXT_ENTRY_STATE: TextEntryState = {
  isOpen: false,
  fieldId: null,
  fieldLabel: '',
  value: '',
  onSave: () => {},
};

export interface MapLayerVisibility {
  terrain: boolean;
  objectives: boolean;
  deploymentZone: boolean;
  grid: boolean;
  coordinates: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: MapLayerVisibility = {
  terrain: true,
  objectives: true,
  deploymentZone: true,
  grid: true,
  coordinates: false,
};

export interface MapHistoryEntry<T extends string = string> {
  terrain: import('./base').BaseTerrainTile<T>[];
  objectives: import('./base').BaseObjective[];
  deploymentZone: import('./base').DeploymentZone;
}
