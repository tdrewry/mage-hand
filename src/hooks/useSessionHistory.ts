import { useState, useEffect } from 'react';
import {
  ProjectHistory,
  ProjectVersion,
  loadProjectHistory,
  saveProjectVersion,
  deleteProjectVersion,
  clearProjectHistory,
  getProjectVersion,
  compareVersions,
  VersionDifference,
  getHistoryStorageSize,
} from '@/lib/sessionHistory';
import { ProjectData } from '@/lib/projectSerializer';

export function useSessionHistory(projectId?: string) {
  const [history, setHistory] = useState<ProjectHistory | null>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = (id: string) => {
    setLoading(true);
    try {
      const projectHistory = loadProjectHistory(id);
      setHistory(projectHistory);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadHistory(projectId);
    }
  }, [projectId]);

  const saveVersion = (projectData: ProjectData, changeDescription?: string) => {
    try {
      saveProjectVersion(projectData, changeDescription);
      if (projectId) {
        loadHistory(projectId);
      }
    } catch (error) {
      console.error('Failed to save version:', error);
      throw error;
    }
  };

  const deleteVersion = (versionId: string) => {
    if (!projectId) return;
    
    try {
      deleteProjectVersion(projectId, versionId);
      loadHistory(projectId);
    } catch (error) {
      console.error('Failed to delete version:', error);
      throw error;
    }
  };

  const clearHistory = () => {
    if (!projectId) return;
    
    try {
      clearProjectHistory(projectId);
      setHistory(null);
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  };

  const getVersion = (versionId: string): ProjectVersion | null => {
    if (!projectId) return null;
    return getProjectVersion(projectId, versionId);
  };

  const compare = (
    versionId1: string,
    versionId2: string
  ): VersionDifference[] => {
    if (!projectId) return [];
    
    const v1 = getVersion(versionId1);
    const v2 = getVersion(versionId2);
    
    if (!v1 || !v2) return [];
    
    return compareVersions(v1, v2);
  };

  const getStorageSize = (): number => {
    if (!projectId) return 0;
    return getHistoryStorageSize(projectId);
  };

  return {
    history,
    loading,
    saveVersion,
    deleteVersion,
    clearHistory,
    getVersion,
    compare,
    getStorageSize,
    refreshHistory: () => projectId && loadHistory(projectId),
  };
}
