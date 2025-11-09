/**
 * Fog Serialization - Persistent storage for explored areas
 * Uses paper.js exportJSON/importJSON for robust serialization
 */

import paper from 'paper';

export interface SerializedFogData {
  exploredPathData: string;  // paper.js JSON export
  version: number;
  timestamp: number;
}

const CURRENT_FOG_VERSION = 1;

/**
 * Serialize explored area to JSON string
 */
export function serializeFogGeometry(explored: paper.CompoundPath | null): string {
  if (!explored || explored.isEmpty()) {
    return '';
  }
  
  try {
    // Export paper.js path to JSON
    const pathData = explored.exportJSON({ precision: 2 });
    
    const serialized: SerializedFogData = {
      exploredPathData: pathData,
      version: CURRENT_FOG_VERSION,
      timestamp: Date.now()
    };
    
    return JSON.stringify(serialized);
  } catch (error) {
    console.error('Failed to serialize fog geometry:', error);
    return '';
  }
}

/**
 * Deserialize fog geometry from JSON string
 * Returns null if deserialization fails or data is invalid
 */
export function deserializeFogGeometry(
  data: string,
  scope: paper.PaperScope
): paper.CompoundPath | null {
  if (!data || data.trim() === '') {
    return null;
  }
  
  try {
    const parsed: SerializedFogData = JSON.parse(data);
    
    // Check version compatibility
    if (parsed.version !== CURRENT_FOG_VERSION) {
      console.warn(`Fog data version mismatch. Expected ${CURRENT_FOG_VERSION}, got ${parsed.version}. Clearing fog.`);
      return null;
    }
    
    // Activate scope for import
    scope.activate();
    
    // Import the path data
    const imported = scope.project.importJSON(parsed.exploredPathData);
    
    if (imported instanceof scope.CompoundPath) {
      return imported;
    } else if (imported instanceof scope.Path) {
      // Convert single path to compound path
      return new scope.CompoundPath({
        children: [imported]
      });
    } else {
      console.warn('Imported fog data is not a path');
      return null;
    }
  } catch (error) {
    console.error('Failed to deserialize fog geometry:', error);
    return null;
  }
}

/**
 * Validate serialized fog data
 */
export function validateFogData(data: string): boolean {
  if (!data || data.trim() === '') {
    return false;
  }
  
  try {
    const parsed = JSON.parse(data);
    return (
      typeof parsed === 'object' &&
      'exploredPathData' in parsed &&
      'version' in parsed &&
      typeof parsed.version === 'number'
    );
  } catch {
    return false;
  }
}

/**
 * Get serialized data size in KB
 */
export function getFogDataSize(data: string): number {
  if (!data) return 0;
  return new Blob([data]).size / 1024;
}

/**
 * Clear fog data (returns empty string)
 */
export function clearFogData(): string {
  return '';
}
