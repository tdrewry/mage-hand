/**
 * Project Serialization System
 * 
 * Handles saving and loading complete project states including:
 * - Maps, regions, and tokens
 * - Viewport states and camera positions  
 * - User preferences and settings
 * - Version management for backward compatibility
 */

import { Token } from '../stores/sessionStore';
import { GameMap } from '../stores/mapStore';
import { CanvasRegion } from '../stores/regionStore';
import { TokenGroup } from './groupTransforms';

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  modifiedAt: string;
  version: string;
  author?: string;
  tags?: string[];
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface ProjectSettings {
  gridSnappingEnabled: boolean;
  tokenVisibility: 'all' | 'owned' | 'dm-only';
  labelVisibility: 'show' | 'hide' | 'selected';
  gridColor: string;
  backgroundColor: string;
  defaultGridSize: number;
}

export interface ProjectData {
  metadata: ProjectMetadata;
  tokens: Token[];
  maps: GameMap[];
  regions: CanvasRegion[];
  groups: TokenGroup[];
  viewport: ViewportState;
  settings: ProjectSettings;
}

export interface SerializedProject {
  version: string;
  data: ProjectData;
  compressed?: boolean;
}

// Current serialization version
export const CURRENT_VERSION = '1.0.0';

// Create project metadata
export const createProjectMetadata = (
  name: string, 
  description?: string,
  author?: string
): ProjectMetadata => ({
  id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name,
  description,
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
  version: CURRENT_VERSION,
  author,
  tags: []
});

// Serialize project data to JSON
export const serializeProject = (
  projectData: ProjectData,
  compress: boolean = true
): SerializedProject => {
  const serialized: SerializedProject = {
    version: CURRENT_VERSION,
    data: {
      ...projectData,
      metadata: {
        ...projectData.metadata,
        modifiedAt: new Date().toISOString()
      }
    },
    compressed: compress
  };

  return serialized;
};

// Deserialize project data from JSON with version migration
export const deserializeProject = (serializedData: string | SerializedProject): ProjectData => {
  let parsed: SerializedProject;
  
  if (typeof serializedData === 'string') {
    try {
      parsed = JSON.parse(serializedData);
    } catch (error) {
      throw new Error('Invalid project data: Unable to parse JSON');
    }
  } else {
    parsed = serializedData;
  }

  // Version migration logic
  return migrateProjectVersion(parsed);
};

// Migrate project data between versions
const migrateProjectVersion = (serialized: SerializedProject): ProjectData => {
  const { version, data } = serialized;
  
  switch (version) {
    case '1.0.0':
      return data; // Current version, no migration needed
    
    // Future version migrations would go here
    default:
      console.warn(`Unknown project version: ${version}. Attempting to load anyway.`);
      return data;
  }
};

// Export project to downloadable file
export const exportProjectToFile = (projectData: ProjectData, filename?: string): void => {
  const serialized = serializeProject(projectData);
  const json = JSON.stringify(serialized, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${projectData.metadata.name}-${Date.now()}.d20pro`;
  
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Import project from file
export const importProjectFromFile = (file: File): Promise<ProjectData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') {
          throw new Error('File reading failed');
        }
        
        const projectData = deserializeProject(result);
        resolve(projectData);
      } catch (error) {
        reject(new Error(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('File reading failed'));
    };
    
    reader.readAsText(file);
  });
};

// Save project to local storage with automatic cleanup
export const saveProjectToStorage = (projectData: ProjectData, maxProjects: number = 10): void => {
  try {
    const key = `d20pro-project-${projectData.metadata.id}`;
    const serialized = serializeProject(projectData);
    
    localStorage.setItem(key, JSON.stringify(serialized));
    
    // Update project index
    updateProjectIndex(projectData.metadata, maxProjects);
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('quota')) {
      // Storage full - clean up old projects and try again
      cleanupOldProjects();
      localStorage.setItem(`d20pro-project-${projectData.metadata.id}`, JSON.stringify(serializeProject(projectData)));
    } else {
      throw error;
    }
  }
};

// Load project from local storage
export const loadProjectFromStorage = (projectId: string): ProjectData | null => {
  try {
    const key = `d20pro-project-${projectId}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    return deserializeProject(stored);
  } catch (error) {
    console.error('Failed to load project from storage:', error);
    return null;
  }
};

// Get list of saved projects
export const getSavedProjects = (): ProjectMetadata[] => {
  try {
    const index = localStorage.getItem('d20pro-project-index');
    return index ? JSON.parse(index) : [];
  } catch (error) {
    console.error('Failed to load project index:', error);
    return [];
  }
};

// Update project index for quick listing
const updateProjectIndex = (metadata: ProjectMetadata, maxProjects: number): void => {
  let projects = getSavedProjects();
  
  // Remove existing entry for this project
  projects = projects.filter(p => p.id !== metadata.id);
  
  // Add updated metadata
  projects.unshift(metadata);
  
  // Keep only the most recent projects
  if (projects.length > maxProjects) {
    const toRemove = projects.slice(maxProjects);
    
    // Clean up old project data
    toRemove.forEach(p => {
      localStorage.removeItem(`d20pro-project-${p.id}`);
    });
    
    projects = projects.slice(0, maxProjects);
  }
  
  localStorage.setItem('d20pro-project-index', JSON.stringify(projects));
};

// Clean up old projects when storage is full
const cleanupOldProjects = (): void => {
  const projects = getSavedProjects();
  
  // Remove oldest half of projects
  const toRemove = projects.slice(Math.floor(projects.length / 2));
  
  toRemove.forEach(p => {
    localStorage.removeItem(`d20pro-project-${p.id}`);
  });
  
  // Update index
  const remaining = projects.slice(0, Math.floor(projects.length / 2));
  localStorage.setItem('d20pro-project-index', JSON.stringify(remaining));
};

// Delete a saved project
export const deleteProjectFromStorage = (projectId: string): void => {
  localStorage.removeItem(`d20pro-project-${projectId}`);
  
  // Update index
  const projects = getSavedProjects().filter(p => p.id !== projectId);
  localStorage.setItem('d20pro-project-index', JSON.stringify(projects));
};

// Create project backup
export const createProjectBackup = (projectData: ProjectData): string => {
  const serialized = serializeProject(projectData);
  return JSON.stringify(serialized);
};

// Restore from backup
export const restoreFromBackup = (backupData: string): ProjectData => {
  return deserializeProject(backupData);
};

// Validate project data structure
export const validateProjectData = (data: any): data is ProjectData => {
  return (
    data &&
    typeof data === 'object' &&
    data.metadata &&
    Array.isArray(data.tokens) &&
    Array.isArray(data.maps) &&
    Array.isArray(data.regions) &&
    Array.isArray(data.groups) &&
    data.viewport &&
    data.settings
  );
};
