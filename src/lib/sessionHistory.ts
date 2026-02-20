import { ProjectData, ProjectMetadata } from './projectSerializer';

const HISTORY_KEY_PREFIX = 'magehand-history-';
const MAX_VERSIONS_PER_PROJECT = 5;

export interface ProjectVersion {
  versionId: string;
  timestamp: string;
  projectData: ProjectData;
  changeDescription?: string;
}

export interface ProjectHistory {
  projectId: string;
  projectName: string;
  versions: ProjectVersion[];
}

// Get the history storage key for a project
const getHistoryKey = (projectId: string): string => {
  return `${HISTORY_KEY_PREFIX}${projectId}`;
};

// Save a new version to history
export const saveProjectVersion = (
  projectData: ProjectData,
  changeDescription?: string
): void => {
  const projectId = projectData.metadata.id;
  const historyKey = getHistoryKey(projectId);
  
  try {
    // Load existing history
    const existingHistory = loadProjectHistory(projectId);
    
    // Create new version
    const newVersion: ProjectVersion = {
      versionId: `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      projectData: { ...projectData },
      changeDescription,
    };
    
    // Add new version and limit to MAX_VERSIONS
    const updatedVersions = [newVersion, ...existingHistory.versions].slice(
      0,
      MAX_VERSIONS_PER_PROJECT
    );
    
    const updatedHistory: ProjectHistory = {
      projectId,
      projectName: projectData.metadata.name,
      versions: updatedVersions,
    };
    
    // Save to localStorage
    localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Failed to save project version:', error);
    throw new Error('Failed to save project version');
  }
};

// Load project history
export const loadProjectHistory = (projectId: string): ProjectHistory => {
  const historyKey = getHistoryKey(projectId);
  
  try {
    const stored = localStorage.getItem(historyKey);
    if (!stored) {
      return {
        projectId,
        projectName: '',
        versions: [],
      };
    }
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load project history:', error);
    return {
      projectId,
      projectName: '',
      versions: [],
    };
  }
};

// Get a specific version
export const getProjectVersion = (
  projectId: string,
  versionId: string
): ProjectVersion | null => {
  const history = loadProjectHistory(projectId);
  return history.versions.find(v => v.versionId === versionId) || null;
};

// Delete a specific version
export const deleteProjectVersion = (
  projectId: string,
  versionId: string
): void => {
  const historyKey = getHistoryKey(projectId);
  const history = loadProjectHistory(projectId);
  
  const updatedVersions = history.versions.filter(v => v.versionId !== versionId);
  
  const updatedHistory: ProjectHistory = {
    ...history,
    versions: updatedVersions,
  };
  
  try {
    if (updatedVersions.length === 0) {
      localStorage.removeItem(historyKey);
    } else {
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    }
  } catch (error) {
    console.error('Failed to delete project version:', error);
    throw new Error('Failed to delete project version');
  }
};

// Clear all history for a project
export const clearProjectHistory = (projectId: string): void => {
  const historyKey = getHistoryKey(projectId);
  try {
    localStorage.removeItem(historyKey);
  } catch (error) {
    console.error('Failed to clear project history:', error);
    throw new Error('Failed to clear project history');
  }
};

// Get all project histories
export const getAllProjectHistories = (): ProjectHistory[] => {
  const histories: ProjectHistory[] = [];
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(HISTORY_KEY_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          histories.push(JSON.parse(stored));
        }
      }
    }
  } catch (error) {
    console.error('Failed to load project histories:', error);
  }
  
  return histories;
};

// Compare two versions and return differences
export interface VersionDifference {
  field: string;
  oldValue: any;
  newValue: any;
  type: 'added' | 'removed' | 'modified';
}

export const compareVersions = (
  oldVersion: ProjectVersion,
  newVersion: ProjectVersion
): VersionDifference[] => {
  const differences: VersionDifference[] = [];
  
  // Compare tokens
  const oldTokenCount = oldVersion.projectData.tokens.length;
  const newTokenCount = newVersion.projectData.tokens.length;
  if (oldTokenCount !== newTokenCount) {
    differences.push({
      field: 'Tokens',
      oldValue: oldTokenCount,
      newValue: newTokenCount,
      type: oldTokenCount < newTokenCount ? 'added' : 'removed',
    });
  }
  
  // Compare maps
  const oldMapCount = oldVersion.projectData.maps.length;
  const newMapCount = newVersion.projectData.maps.length;
  if (oldMapCount !== newMapCount) {
    differences.push({
      field: 'Maps',
      oldValue: oldMapCount,
      newValue: newMapCount,
      type: oldMapCount < newMapCount ? 'added' : 'removed',
    });
  }
  
  // Compare regions
  const oldRegionCount = oldVersion.projectData.regions.length;
  const newRegionCount = newVersion.projectData.regions.length;
  if (oldRegionCount !== newRegionCount) {
    differences.push({
      field: 'Regions',
      oldValue: oldRegionCount,
      newValue: newRegionCount,
      type: oldRegionCount < newRegionCount ? 'added' : 'removed',
    });
  }
  
  // Compare groups
  const oldGroupCount = oldVersion.projectData.groups.length;
  const newGroupCount = newVersion.projectData.groups.length;
  if (oldGroupCount !== newGroupCount) {
    differences.push({
      field: 'Groups',
      oldValue: oldGroupCount,
      newValue: newGroupCount,
      type: oldGroupCount < newGroupCount ? 'added' : 'removed',
    });
  }
  
  // Compare roles
  if (oldVersion.projectData.roles && newVersion.projectData.roles) {
    const oldRoleCount = oldVersion.projectData.roles.length;
    const newRoleCount = newVersion.projectData.roles.length;
    if (oldRoleCount !== newRoleCount) {
      differences.push({
        field: 'Roles',
        oldValue: oldRoleCount,
        newValue: newRoleCount,
        type: oldRoleCount < newRoleCount ? 'added' : 'removed',
      });
    }
  }
  
  // Compare vision profiles
  if (oldVersion.projectData.visionProfiles && newVersion.projectData.visionProfiles) {
    const oldProfileCount = oldVersion.projectData.visionProfiles.length;
    const newProfileCount = newVersion.projectData.visionProfiles.length;
    if (oldProfileCount !== newProfileCount) {
      differences.push({
        field: 'Vision Profiles',
        oldValue: oldProfileCount,
        newValue: newProfileCount,
        type: oldProfileCount < newProfileCount ? 'added' : 'removed',
      });
    }
  }
  
  // Compare initiative state
  if (oldVersion.projectData.initiative && newVersion.projectData.initiative) {
    if (oldVersion.projectData.initiative.isInCombat !== newVersion.projectData.initiative.isInCombat) {
      differences.push({
        field: 'Combat Status',
        oldValue: oldVersion.projectData.initiative.isInCombat ? 'Active' : 'Inactive',
        newValue: newVersion.projectData.initiative.isInCombat ? 'Active' : 'Inactive',
        type: 'modified',
      });
    }
  }
  
  // Compare fog settings
  if (oldVersion.projectData.fogData && newVersion.projectData.fogData) {
    if (oldVersion.projectData.fogData.enabled !== newVersion.projectData.fogData.enabled) {
      differences.push({
        field: 'Fog of War',
        oldValue: oldVersion.projectData.fogData.enabled ? 'Enabled' : 'Disabled',
        newValue: newVersion.projectData.fogData.enabled ? 'Enabled' : 'Disabled',
        type: 'modified',
      });
    }
  }
  
  return differences;
};

// Calculate storage size for history
export const getHistoryStorageSize = (projectId: string): number => {
  const historyKey = getHistoryKey(projectId);
  const stored = localStorage.getItem(historyKey);
  if (!stored) return 0;
  
  // Calculate size in KB
  return new Blob([stored]).size / 1024;
};

// Get total history storage usage
export const getTotalHistoryStorageSize = (): number => {
  let totalSize = 0;
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(HISTORY_KEY_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          totalSize += new Blob([stored]).size / 1024;
        }
      }
    }
  } catch (error) {
    console.error('Failed to calculate history storage size:', error);
  }
  
  return totalSize;
};

// Get size of a specific version
export const getVersionSize = (projectId: string, versionId: string): number => {
  try {
    const version = getProjectVersion(projectId, versionId);
    if (!version) return 0;
    return new Blob([JSON.stringify(version)]).size / 1024;
  } catch (error) {
    console.error('Failed to get version size:', error);
    return 0;
  }
};

// Remove old versions across all projects (keep only the N most recent per project)
export const trimOldHistoryVersions = (maxVersionsPerProject: number = MAX_VERSIONS_PER_PROJECT): number => {
  let removedCount = 0;
  
  try {
    const histories = getAllProjectHistories();
    
    for (const history of histories) {
      if (history.versions.length > maxVersionsPerProject) {
        const versionsToKeep = history.versions.slice(0, maxVersionsPerProject);
        const trimmedHistory: ProjectHistory = {
          ...history,
          versions: versionsToKeep,
        };
        
        localStorage.setItem(getHistoryKey(history.projectId), JSON.stringify(trimmedHistory));
        removedCount += history.versions.length - maxVersionsPerProject;
      }
    }
  } catch (error) {
    console.error('Failed to trim old history versions:', error);
  }
  
  return removedCount;
};

// Remove versions older than a specific date across all projects
export const clearOldHistoryVersions = (maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number => {
  let removedCount = 0;
  const cutoffDate = Date.now() - maxAgeMs;
  
  try {
    const histories = getAllProjectHistories();
    
    for (const history of histories) {
      const filteredVersions = history.versions.filter(version => {
        const versionDate = new Date(version.timestamp).getTime();
        return versionDate >= cutoffDate;
      });
      
      if (filteredVersions.length !== history.versions.length) {
        removedCount += history.versions.length - filteredVersions.length;
        
        if (filteredVersions.length === 0) {
          localStorage.removeItem(getHistoryKey(history.projectId));
        } else {
          const updatedHistory: ProjectHistory = {
            ...history,
            versions: filteredVersions,
          };
          localStorage.setItem(getHistoryKey(history.projectId), JSON.stringify(updatedHistory));
        }
      }
    }
  } catch (error) {
    console.error('Failed to clear old history versions:', error);
  }
  
  return removedCount;
};

// Clear all history across all projects
export const clearAllHistory = (): number => {
  let removedCount = 0;
  
  try {
    const histories = getAllProjectHistories();
    
    for (const history of histories) {
      localStorage.removeItem(getHistoryKey(history.projectId));
      removedCount += history.versions.length;
    }
  } catch (error) {
    console.error('Failed to clear all history:', error);
  }
  
  return removedCount;
};
