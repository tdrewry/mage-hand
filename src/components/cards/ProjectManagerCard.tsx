/**
 * Project Manager Card
 * 
 * Provides save/load functionality using the enhanced project serialization system
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { toast } from 'sonner';
import { 
  Save, 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  Clock, 
  User,
  AlertTriangle,
  RefreshCw,
  Package,
} from 'lucide-react';

import {
  createProjectMetadata,
  exportProjectToFile,
  importProjectFromFile,
  saveProjectToStorage,
  loadProjectFromStorage,
  getSavedProjects,
  deleteProjectFromStorage,
  ProjectData,
  ProjectMetadata
} from '../../lib/projectSerializer';
import { cn, processInChunks } from '../../lib/utils';

import { useSessionStore } from '../../stores/sessionStore';
import { useMapStore } from '../../stores/mapStore';
import { useRegionStore } from '../../stores/regionStore';
import { useGroupStore } from '../../stores/groupStore';
import { useInitiativeStore } from '../../stores/initiativeStore';
import { useRoleStore } from '../../stores/roleStore';
import { useVisionProfileStore } from '../../stores/visionProfileStore';
import { useFogStore } from '../../stores/fogStore';
import { useLightStore } from '../../stores/lightStore';
import { useCardStore } from '../../stores/cardStore';
import { useDungeonStore } from '../../stores/dungeonStore';
import { useMapObjectStore } from '../../stores/mapObjectStore';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useSessionTemplates } from '../../hooks/useSessionTemplates';
import { useSessionHistory } from '../../hooks/useSessionHistory';
import { createTemplateFromSession, applyTemplate, SessionTemplate } from '../../lib/sessionTemplates';
import { SessionHistoryModal } from '../SessionHistoryModal';
import { DurableObjectRegistry, exportArchiveToFile, parseArchiveFile, DurableObjectArchive } from '../../lib/durableObjects';
import '../../lib/durableObjectRegistry'; // Side-effect: registers all DOs
import { DurableObjectImportModal } from '../modals/DurableObjectImportModal';

interface ProjectManagerCardContentProps {
  viewport: { x: number; y: number; zoom: number };
}

export const ProjectManagerCardContent: React.FC<ProjectManagerCardContentProps> = ({
  viewport
}) => {
  const [activeTab, setActiveTab] = useState('save');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [savedProjects, setSavedProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [cancelRequested, setCancelRequested] = useState(false);
  const [previousState, setPreviousState] = useState<ProjectData | null>(null);
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [pendingLoadData, setPendingLoadData] = useState<ProjectData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const doFileInputRef = useRef<HTMLInputElement>(null);

  // Durable Object import state
  const [doArchive, setDoArchive] = useState<DurableObjectArchive | null>(null);
  const [showDoImport, setShowDoImport] = useState(false);
  // Auto-save hook
  const autoSave = useAutoSave();
  const [timeSinceLastSave, setTimeSinceLastSave] = useState('Never');

  // Templates
  const templatesHook = useSessionTemplates();
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<SessionTemplate | null>(null);

  // History
  const [selectedProjectForHistory, setSelectedProjectForHistory] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const historyHook = useSessionHistory(selectedProjectForHistory || undefined);

  // Store hooks - for reading
  const sessionStore = useSessionStore();
  const mapStore = useMapStore();
  const regionStore = useRegionStore();
  const groupStore = useGroupStore();
  const initiativeStore = useInitiativeStore();
  const roleStore = useRoleStore();
  const visionProfileStore = useVisionProfileStore();
  const fogStore = useFogStore();
  const lightStore = useLightStore();
  const cardStore = useCardStore();
  const dungeonStore = useDungeonStore();
  const mapObjectStore = useMapObjectStore();

  // Load saved projects when component mounts
  useEffect(() => {
    const projects = getSavedProjects();
    setSavedProjects(projects);
  }, []);

  // Update time since last save every 10 seconds
  useEffect(() => {
    const updateTime = () => {
      setTimeSinceLastSave(autoSave.getTimeSinceLastSave());
    };
    
    updateTime();
    const interval = setInterval(updateTime, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, [autoSave.lastSaveTime, autoSave]);

  const handleLoadAutoSave = () => {
    const autoSaveData = autoSave.loadAutoSave();
    if (!autoSaveData) {
      toast.error('No auto-save found');
      return;
    }
    
    setPendingLoadData(autoSaveData);
    setShowLoadConfirm(true);
  };

  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      const template = createTemplateFromSession(
        templateName,
        templateDescription,
        {
          maps: mapStore.maps,
          regions: regionStore.regions,
          roles: roleStore.roles,
          visionProfiles: visionProfileStore.profiles,
          fogSettings: {
            ...(fogStore.fogSettingsPerMap['default-map'] || {}),
            serializedExploredAreas: '',
            fogVersion: fogStore.fogVersion,
            realtimeVisionDuringDrag: fogStore.realtimeVisionDuringDrag,
            realtimeVisionThrottleMs: fogStore.realtimeVisionThrottleMs,
            fogSettingsPerMap: fogStore.fogSettingsPerMap,
          },
          gridSize: 50,
        }
      );

      templatesHook.refreshTemplates();
      setTemplateName('');
      setTemplateDescription('');
      toast.success(`Template "${template.name}" saved successfully`);
      setActiveTab('templates');
    } catch (error) {
      toast.error(`Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLoadTemplate = (template: SessionTemplate) => {
    setPendingTemplate(template);
    setShowTemplateConfirm(true);
  };

  const confirmTemplateLoad = () => {
    if (!pendingTemplate) return;

    const templateName = pendingTemplate.name;
    
    try {
      applyTemplate(pendingTemplate, {
        mapStore,
        regionStore,
        roleStore,
        visionProfileStore,
        fogStore,
      });

      setPendingTemplate(null);
      setShowTemplateConfirm(false);
      toast.success(`Template "${templateName}" applied successfully`);
    } catch (error) {
      toast.error(`Failed to apply template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const cancelTemplateLoad = () => {
    setPendingTemplate(null);
    setShowTemplateConfirm(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return;
    }

    try {
      templatesHook.deleteTemplate(templateId);
      toast.success('Template deleted successfully');
    } catch (error) {
      toast.error(`Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleShowHistory = (projectId: string) => {
    setSelectedProjectForHistory(projectId);
    setShowHistoryModal(true);
  };

  const handleRestoreVersion = (versionId: string) => {
    const version = historyHook.getVersion(versionId);
    if (!version) {
      toast.error('Version not found');
      return;
    }

    // Set pending load data and show confirmation
    setPendingLoadData(version.projectData);
    setShowLoadConfirm(true);
    setShowHistoryModal(false);
  };

  const handleDeleteVersion = (versionId: string) => {
    try {
      historyHook.deleteVersion(versionId);
      toast.success('Version deleted successfully');
    } catch (error) {
      toast.error(`Failed to delete version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createCurrentProjectData = (): ProjectData => ({
    metadata: createProjectMetadata(
      projectName || `Project ${Date.now()}`,
      projectDescription,
      authorName
    ),
    tokens: sessionStore.tokens,
    players: sessionStore.players,
    maps: mapStore.maps,
    regions: regionStore.regions,
    groups: groupStore.groups,
    viewport,
    settings: {
      gridSnappingEnabled: false,
      tokenVisibility: sessionStore.tokenVisibility,
      labelVisibility: sessionStore.labelVisibility,
      gridColor: '#333333',
      backgroundColor: '#1a1a1a',
      defaultGridSize: 50
    },
    // Capture all store states
    initiative: {
      isInCombat: initiativeStore.isInCombat,
      currentTurnIndex: initiativeStore.currentTurnIndex,
      roundNumber: initiativeStore.roundNumber,
      initiativeOrder: initiativeStore.initiativeOrder,
      restrictMovement: initiativeStore.restrictMovement,
    },
    roles: roleStore.roles,
    visionProfiles: visionProfileStore.profiles,
    fogData: {
      ...(fogStore.fogSettingsPerMap['default-map'] || {}),
      serializedExploredAreas: fogStore.serializedExploredAreas,
      serializedExploredAreasPerMap: fogStore.serializedExploredAreasPerMap,
      fogVersion: fogStore.fogVersion,
      realtimeVisionDuringDrag: fogStore.realtimeVisionDuringDrag,
      realtimeVisionThrottleMs: fogStore.realtimeVisionThrottleMs,
      fogSettingsPerMap: fogStore.fogSettingsPerMap,
    },
    lights: lightStore.lights,
    cardStates: cardStore.cards,
    dungeonData: {
      doors: dungeonStore.doors,
      // annotations are now MapObjects — serialized with mapObjects
      importedWallSegments: dungeonStore.importedWallSegments,
      watabouStyle: dungeonStore.watabouStyle,
      wallEdgeStyle: dungeonStore.wallEdgeStyle,
      wallThickness: dungeonStore.wallThickness,
      textureScale: dungeonStore.textureScale,
      lightDirection: dungeonStore.lightDirection,
      shadowDistance: dungeonStore.shadowDistance,
    },
    mapObjects: mapObjectStore.mapObjects,
  });

  const handleSaveToStorage = async () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setLoading(true);
    try {
      const projectData = createCurrentProjectData();
      saveProjectToStorage(projectData);
      
      toast.success('Project saved successfully');
      
      // Refresh saved projects list
      const projects = getSavedProjects();
      setSavedProjects(projects);
      
      // Reset form
      setProjectName('');
      setProjectDescription('');
    } catch (error) {
      toast.error(`Failed to save project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportToFile = async () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    // Pause auto-save and lock movement during export
    const wasAutoSaveEnabled = autoSave.settings.enabled;
    if (wasAutoSaveEnabled) {
      autoSave.toggleAutoSave();
    }
    initiativeStore.setRestrictMovement(true);

    try {
      const projectData = createCurrentProjectData();
      await exportProjectToFile(projectData, `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.mhsession`);
      toast.success('Project exported successfully (with textures)');
    } catch (error) {
      toast.error(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Re-enable auto-save and unlock movement
      initiativeStore.setRestrictMovement(false);
      if (wasAutoSaveEnabled) {
        setTimeout(() => {
          autoSave.toggleAutoSave();
        }, 100);
      }
    }
  };

  const applyProjectData = async (projectData: ProjectData) => {
    // Temporarily disable auto-save and lock movement during import to prevent cascade
    const wasAutoSaveEnabled = autoSave.settings.enabled;
    if (wasAutoSaveEnabled) {
      autoSave.toggleAutoSave();
    }
    initiativeStore.setRestrictMovement(true);

    try {
      // Step 1: Clear existing tokens
      setLoadingProgress('Clearing existing tokens...');
      const existingTokens = [...sessionStore.tokens];
      await processInChunks(
        existingTokens,
        10,
        (token) => sessionStore.removeToken(token.id),
        (processed, total) => setLoadingProgress(`Clearing tokens (${processed}/${total})...`)
      );
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 2: Add new tokens
      const tokens = projectData.tokens || [];
      await processInChunks(
        tokens,
        10,
        (token) => sessionStore.addToken(token),
        (processed, total) => setLoadingProgress(`Loading tokens (${processed}/${total})...`)
      );
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 3: Add/update players
      const players = projectData.players || [];
      await processInChunks(
        players,
        15,
        (player) => sessionStore.addPlayer(player),
        (processed, total) => setLoadingProgress(`Loading players (${processed}/${total})...`)
      );
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 4: Apply session settings
      setLoadingProgress('Applying session settings...');
      sessionStore.setTokenVisibility(projectData.settings.tokenVisibility);
      sessionStore.setLabelVisibility(projectData.settings.labelVisibility);
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 5: Clear existing maps
      setLoadingProgress('Clearing existing maps...');
      const existingMaps = [...mapStore.maps];
      await processInChunks(
        existingMaps,
        5,
        (map) => mapStore.removeMap(map.id),
        (processed, total) => setLoadingProgress(`Clearing maps (${processed}/${total})...`)
      );
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 6: Add new maps
      const maps = projectData.maps || [];
      await processInChunks(
        maps,
        5,
        (map) => {
          const { regions, ...mapData } = map;
          mapStore.addMap({ ...mapData, regions: [] });
        },
        (processed, total) => setLoadingProgress(`Loading maps (${processed}/${total})...`)
      );
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 7: Clear and add regions
      setLoadingProgress('Clearing regions...');
      regionStore.clearRegions();
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      const regions = projectData.regions || [];
      await processInChunks(
        regions,
        5,
        (region) => regionStore.addRegion(region),
        (processed, total) => setLoadingProgress(`Loading regions (${processed}/${total})...`)
      );
      if (cancelRequested) throw new Error('Import cancelled by user');
    
      // Step 8: Clear and add groups
      setLoadingProgress('Clearing groups...');
      groupStore.clearAllGroups();
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      const groups = projectData.groups || [];
      await processInChunks(
        groups,
        8,
        (group: any) => {
          // Support both old tokenIds format and new members format
          const members = group.members || (group.tokenIds || []).map((id: string) => ({ id, type: 'token' }));
          groupStore.restoreGroup({
            id: group.id,
            name: group.name,
            members,
            pivot: group.pivot ?? { x: 0, y: 0 },
            bounds: group.bounds ?? { x: 0, y: 0, width: 0, height: 0 },
            locked: group.locked ?? false,
            visible: group.visible ?? true,
          });
        },
        (processed, total) => setLoadingProgress(`Loading groups (${processed}/${total})...`)
      );
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 9: Apply initiative data
      setLoadingProgress('Loading initiative...');
      if (projectData.initiative) {
        initiativeStore.endCombat();
        if (projectData.initiative.isInCombat) {
          const entries = projectData.initiative.initiativeOrder || [];
          await processInChunks(
            entries,
            15,
            (entry) => initiativeStore.addToInitiative(entry.tokenId, entry.initiative),
            (processed, total) => setLoadingProgress(`Loading initiative (${processed}/${total})...`)
          );
          initiativeStore.startCombat();
          // Set to correct turn
          for (let i = 0; i < projectData.initiative.currentTurnIndex; i++) {
            initiativeStore.nextTurn();
          }
        }
        initiativeStore.setRestrictMovement(projectData.initiative.restrictMovement);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 10: Apply roles
      if (projectData.roles) {
        setLoadingProgress('Clearing roles...');
        const existingRoles = [...roleStore.roles];
        await processInChunks(
          existingRoles,
          20,
          (role) => roleStore.removeRole(role.id),
          (processed, total) => setLoadingProgress(`Clearing roles (${processed}/${total})...`)
        );
        if (cancelRequested) throw new Error('Import cancelled by user');
        
        await processInChunks(
          projectData.roles,
          20,
          (role) => roleStore.addRole(role),
          (processed, total) => setLoadingProgress(`Loading roles (${processed}/${total})...`)
        );
      }
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 11: Apply vision profiles
      if (projectData.visionProfiles) {
        setLoadingProgress('Clearing vision profiles...');
        const existingProfiles = [...visionProfileStore.profiles];
        await processInChunks(
          existingProfiles,
          10,
          (profile) => visionProfileStore.removeProfile(profile.id),
          (processed, total) => setLoadingProgress(`Clearing vision profiles (${processed}/${total})...`)
        );
        if (cancelRequested) throw new Error('Import cancelled by user');
        
        await processInChunks(
          projectData.visionProfiles,
          10,
          (profile) => visionProfileStore.addProfile(profile),
          (processed, total) => setLoadingProgress(`Loading vision profiles (${processed}/${total})...`)
        );
      }
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 12: Apply fog data
      setLoadingProgress('Loading fog of war...');
      if (projectData.fogData) {
        const fogData = projectData.fogData as any;
        // Import per-map fog settings if present
        if (fogData.fogSettingsPerMap) {
          useFogStore.setState({ fogSettingsPerMap: fogData.fogSettingsPerMap });
        } else {
          // Legacy: import flat fields into default-map
          const { DEFAULT_MAP_FOG_SETTINGS } = await import('@/stores/defaultFogEffectSettings');
          useFogStore.getState().setMapFogSettings('default-map', {
            enabled: fogData.enabled ?? DEFAULT_MAP_FOG_SETTINGS.enabled,
            revealAll: fogData.revealAll ?? DEFAULT_MAP_FOG_SETTINGS.revealAll,
            visionRange: fogData.visionRange ?? DEFAULT_MAP_FOG_SETTINGS.visionRange,
            fogOpacity: fogData.fogOpacity ?? DEFAULT_MAP_FOG_SETTINGS.fogOpacity,
            exploredOpacity: fogData.exploredOpacity ?? DEFAULT_MAP_FOG_SETTINGS.exploredOpacity,
            showExploredAreas: fogData.showExploredAreas ?? DEFAULT_MAP_FOG_SETTINGS.showExploredAreas,
          });
        }
        if (fogData.serializedExploredAreas) {
          fogStore.setSerializedExploredAreas(fogData.serializedExploredAreas);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 13: Apply lights
      setLoadingProgress('Clearing lights...');
      if (projectData.lights) {
        lightStore.clearAllLights();
        await processInChunks(
          projectData.lights,
          10,
          (light) => lightStore.addLight(light),
          (processed, total) => setLoadingProgress(`Loading lights (${processed}/${total})...`)
        );
      }
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 14: Apply card states
      setLoadingProgress('Loading UI layout...');
      if (projectData.cardStates) {
        const existingCards = [...cardStore.cards];
        existingCards.forEach(card => cardStore.unregisterCard(card.id));
        projectData.cardStates.forEach(card => {
          const config = {
            type: card.type,
            title: '',
            defaultPosition: card.position,
            defaultSize: card.size,
            defaultMinimized: card.isMinimized,
            defaultVisible: card.isVisible,
            hideHeader: card.hideHeader,
            fullCardDraggable: card.fullCardDraggable,
          };
          cardStore.registerCard(config);
        });
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 15: Apply dungeon data
      setLoadingProgress('Loading dungeon features...');
      if (projectData.dungeonData) {
        dungeonStore.clearAll();
        if (projectData.dungeonData.doors) {
          dungeonStore.setDoors(projectData.dungeonData.doors);
        }
        // annotations are now MapObjects — no need to restore from dungeonData
        if (projectData.dungeonData.watabouStyle) {
          dungeonStore.setWatabouStyle(projectData.dungeonData.watabouStyle);
        }
        if (projectData.dungeonData.wallEdgeStyle) {
          dungeonStore.setWallEdgeStyle(projectData.dungeonData.wallEdgeStyle);
        }
        if (projectData.dungeonData.wallThickness !== undefined) {
          dungeonStore.setWallThickness(projectData.dungeonData.wallThickness);
        }
        if (projectData.dungeonData.textureScale !== undefined) {
          dungeonStore.setTextureScale(projectData.dungeonData.textureScale);
        }
        if (projectData.dungeonData.lightDirection !== undefined) {
          dungeonStore.setLightDirection(projectData.dungeonData.lightDirection);
        }
        if (projectData.dungeonData.shadowDistance !== undefined) {
          dungeonStore.setShadowDistance(projectData.dungeonData.shadowDistance);
        }
        if (projectData.dungeonData.importedWallSegments) {
          dungeonStore.setImportedWallSegments(projectData.dungeonData.importedWallSegments);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      // Step 16: Apply map objects — always clear first so stale objects don't survive
      setLoadingProgress('Clearing map objects...');
      mapObjectStore.clearMapObjects();
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      if (projectData.mapObjects && projectData.mapObjects.length > 0) {
        await processInChunks(
          projectData.mapObjects,
          10,
          (obj) => mapObjectStore.addMapObject(obj),
          (processed, total) => setLoadingProgress(`Loading map objects (${processed}/${total})...`)
        );
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelRequested) throw new Error('Import cancelled by user');
      
      setLoadingProgress('Import complete!');
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      if (error instanceof Error && error.message === 'Import cancelled by user') {
        // Restore previous state if available
        if (previousState) {
          setLoadingProgress('Restoring previous state...');
          await applyProjectDataWithoutCancel(previousState);
        }
        throw error;
      }
      throw error;
    } finally {
      // Unlock movement and re-enable auto-save if it was enabled before
      initiativeStore.setRestrictMovement(false);
      if (wasAutoSaveEnabled) {
        setTimeout(() => {
          autoSave.toggleAutoSave();
        }, 100);
      }
    }
  };

  // Simplified full restore used by the cancel/rollback path — mirrors applyProjectData
  // but without cancellation checks. Must stay in sync with applyProjectData steps.
  const applyProjectDataWithoutCancel = async (projectData: ProjectData) => {
    // Tokens
    const existingTokens = [...sessionStore.tokens];
    existingTokens.forEach(token => sessionStore.removeToken(token.id));
    (projectData.tokens || []).forEach(token => sessionStore.addToken(token));
    (projectData.players || []).forEach(player => sessionStore.addPlayer(player));
    sessionStore.setTokenVisibility(projectData.settings.tokenVisibility);
    sessionStore.setLabelVisibility(projectData.settings.labelVisibility);

    // Maps
    const existingMaps = [...mapStore.maps];
    existingMaps.forEach(map => mapStore.removeMap(map.id));
    (projectData.maps || []).forEach(map => {
      const { regions, ...mapData } = map;
      mapStore.addMap({ ...mapData, regions: [] });
    });

    // Regions
    regionStore.clearRegions();
    (projectData.regions || []).forEach(region => regionStore.addRegion(region));

    // Groups
    groupStore.clearAllGroups();
    (projectData.groups || []).forEach((group: any) => {
      const members = group.members || (group.tokenIds || []).map((id: string) => ({ id, type: 'token' }));
      groupStore.restoreGroup({
        id: group.id, name: group.name, members,
        pivot: group.pivot ?? { x: 0, y: 0 },
        bounds: group.bounds ?? { x: 0, y: 0, width: 0, height: 0 },
        locked: group.locked ?? false, visible: group.visible ?? true,
      });
    });

    // Lights
    if (projectData.lights) {
      lightStore.clearAllLights();
      (projectData.lights).forEach(light => lightStore.addLight(light));
    }

    // Fog
    if (projectData.fogData) {
      const fogData = projectData.fogData as any;
      if (fogData?.fogSettingsPerMap) {
        fogStore.resetFog();
        useFogStore.setState({ fogSettingsPerMap: fogData.fogSettingsPerMap });
      } else if (fogData) {
        fogStore.getMapFogSettings('default-map'); // ensure init
        fogStore.setMapFogSettings('default-map', {
          enabled: fogData.enabled,
          revealAll: fogData.revealAll,
          visionRange: fogData.visionRange,
          fogOpacity: fogData.fogOpacity,
          exploredOpacity: fogData.exploredOpacity,
          showExploredAreas: fogData.showExploredAreas,
        });
      }
      if (fogData?.serializedExploredAreas) {
        fogStore.setSerializedExploredAreas(fogData.serializedExploredAreas);
      }
    }

    // Dungeon features
    if (projectData.dungeonData) {
      dungeonStore.clearAll();
      if (projectData.dungeonData.doors) dungeonStore.setDoors(projectData.dungeonData.doors);
      // annotations are now MapObjects — no need to restore from dungeonData
      if (projectData.dungeonData.importedWallSegments) dungeonStore.setImportedWallSegments(projectData.dungeonData.importedWallSegments);
      if (projectData.dungeonData.watabouStyle) dungeonStore.setWatabouStyle(projectData.dungeonData.watabouStyle);
      if (projectData.dungeonData.wallEdgeStyle) dungeonStore.setWallEdgeStyle(projectData.dungeonData.wallEdgeStyle);
      if (projectData.dungeonData.wallThickness !== undefined) dungeonStore.setWallThickness(projectData.dungeonData.wallThickness);
      if (projectData.dungeonData.textureScale !== undefined) dungeonStore.setTextureScale(projectData.dungeonData.textureScale);
    }

    // Map objects — always clear to avoid stale objects
    mapObjectStore.clearMapObjects();
    (projectData.mapObjects || []).forEach(obj => mapObjectStore.addMapObject(obj));
  };

  const handleLoadFromStorage = async (projectId: string) => {
    const loadingToast = toast.loading('Loading project...');
    
    try {
      const loadedData = loadProjectFromStorage(projectId);
      
      toast.dismiss(loadingToast);
      
      if (!loadedData) {
        toast.error('Project not found');
        return;
      }
      
      // Show confirmation dialog with project preview
      setPendingLoadData(loadedData);
      setShowLoadConfirm(true);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(`Failed to load project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const confirmLoad = async () => {
    if (!pendingLoadData) return;
    
    try {
      setShowLoadConfirm(false);
      
      // Save current state for cancel/restore
      const currentState = createCurrentProjectData();
      setPreviousState(currentState);
      setCancelRequested(false);
      
      // Set loading state FIRST
      setLoading(true);
      setLoadingProgress('Preparing to load project...');
      
      // Force a render by waiting for next event loop tick
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // NOW start the import process
      await applyProjectData(pendingLoadData);
      
      toast.success('Project loaded successfully');
      
      // Refresh the saved projects list
      const projects = getSavedProjects();
      setSavedProjects(projects);
      
    } catch (error) {
      if (error instanceof Error && error.message === 'Import cancelled by user') {
        toast.info('Import cancelled');
      } else {
        toast.error(`Failed to load project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
      setLoadingProgress('');
      setPreviousState(null);
      setPendingLoadData(null);
      setCancelRequested(false);
    }
  };

  const handleCancelImport = () => {
    setCancelRequested(true);
    setLoadingProgress('Cancelling import...');
  };

  const cancelLoad = () => {
    setPendingLoadData(null);
    setShowLoadConfirm(false);
  };

  const handleImportFromFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Importing project file...');

    try {
      const projectData = await importProjectFromFile(file);
      
      toast.dismiss(loadingToast);
      
      // Show confirmation dialog before applying
      setPendingLoadData(projectData);
      setShowLoadConfirm(true);
      
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteProject = (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      deleteProjectFromStorage(projectId);
      toast.success('Project deleted successfully');
      
      const projects = getSavedProjects();
      setSavedProjects(projects);
    } catch (error) {
      toast.error(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-200px)] p-2 relative">
      {/* Loading Dialog */}
      <Dialog open={loading} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md" 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Loading Project</DialogTitle>
            <DialogDescription>
              Please wait while we load your project data
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            <div className="text-center px-6">
              <p className="text-base font-medium">{loadingProgress}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Do not close this window
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelImport}
              disabled={cancelRequested}
              className="mt-2"
            >
              {cancelRequested ? 'Cancelling...' : 'Cancel Import'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="save" className="flex items-center gap-2 text-xs">
            <Save className="w-3 h-3" />
            Save
          </TabsTrigger>
          <TabsTrigger value="load" className="flex items-center gap-2 text-xs">
            <Upload className="w-3 h-3" />
            Load
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2 text-xs">
            <FileText className="w-3 h-3" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2 text-xs">
            <Download className="w-3 h-3" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="save" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Save Current Project</CardTitle>
              <CardDescription className="text-xs">
                Save your current session to local storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-xs">Project Name *</Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Campaign"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author-name" className="text-xs">Author</Label>
                  <Input
                    id="author-name"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Dungeon Master"
                    className="text-xs"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="project-description" className="text-xs">Description</Label>
                <Textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="A brief description..."
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <h4 className="font-medium mb-2 text-xs">Current Session:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Tokens: {sessionStore.tokens.length}</div>
                  <div>Maps: {mapStore.maps.length}</div>
                  <div>Regions: {regionStore.regions.length}</div>
                  <div>Groups: {groupStore.groups.length}</div>
                </div>
              </div>

              <Button 
                onClick={handleSaveToStorage} 
                disabled={loading || !projectName.trim()}
                className="w-full text-xs"
                size="sm"
              >
                {loading ? 'Saving...' : 'Save to Local Storage'}
              </Button>
            </CardContent>
          </Card>

          {/* Auto-Save Card */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Auto-Save
              </CardTitle>
              <CardDescription className="text-xs">
                Automatically save your session at regular intervals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-save-toggle" className="text-xs font-medium">
                    Enable Auto-Save
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically backs up your work
                  </p>
                </div>
                <Switch
                  id="auto-save-toggle"
                  checked={autoSave.settings.enabled}
                  onCheckedChange={autoSave.toggleAutoSave}
                />
              </div>

              {autoSave.settings.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="auto-save-interval" className="text-xs">
                      Save Interval
                    </Label>
                    <Select
                      value={autoSave.settings.intervalMinutes.toString()}
                      onValueChange={(value) => autoSave.setInterval(parseInt(value))}
                    >
                      <SelectTrigger id="auto-save-interval" className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="text-xs">1 minute</SelectItem>
                        <SelectItem value="2" className="text-xs">2 minutes</SelectItem>
                        <SelectItem value="5" className="text-xs">5 minutes</SelectItem>
                        <SelectItem value="10" className="text-xs">10 minutes</SelectItem>
                        <SelectItem value="15" className="text-xs">15 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last auto-saved:</span>
                      <span className="font-medium">{timeSinceLastSave}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={autoSave.forceAutoSave}
                    className="w-full text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Save Now
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="load" className="mt-4">
          {/* Auto-Save Recovery */}
          {autoSave.hasAutoSave && (
            <Card className="mb-4 border-primary/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Auto-Save Available
                </CardTitle>
                <CardDescription className="text-xs">
                  Recover your last auto-saved session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Last saved:</span>
                    <span className="font-medium">{timeSinceLastSave}</span>
                  </div>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleLoadAutoSave}
                  className="w-full text-xs"
                >
                  <Upload className="w-3 h-3 mr-2" />
                  Load Auto-Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to clear the auto-save? This cannot be undone.')) {
                      autoSave.clearAutoSave();
                      toast.success('Auto-save cleared');
                    }
                  }}
                  className="w-full text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Clear Auto-Save
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved Projects</CardTitle>
              <CardDescription className="text-xs">
                Load a previously saved project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] w-full">
                {savedProjects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-xs">No saved projects found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedProjects.map((project) => (
                      <Card key={project.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{project.name}</h4>
                            {project.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {project.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {project.author && (
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {project.author}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(project.modifiedAt)}
                              </div>
                            </div>

                            {project.tags && project.tags.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {project.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowHistory(project.id)}
                              className="text-xs"
                              title="View version history"
                            >
                              <Clock className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLoadFromStorage(project.id)}
                              disabled={loading}
                              className="text-xs"
                            >
                              Load
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProject(project.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="space-y-4">
            {/* Save as Template */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Save as Template</CardTitle>
                <CardDescription className="text-xs">
                  Create a reusable template from your current session structure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name" className="text-xs">Template Name *</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="My Custom Template"
                    className="text-xs"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-description" className="text-xs">Description</Label>
                  <Textarea
                    id="template-description"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Describe what this template is for..."
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <Button 
                  onClick={handleSaveAsTemplate}
                  disabled={!templateName.trim()}
                  className="w-full text-xs"
                  size="sm"
                >
                  <Save className="w-3 h-3 mr-2" />
                  Save as Template
                </Button>
              </CardContent>
            </Card>

            {/* Built-in Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Built-in Templates</CardTitle>
                <CardDescription className="text-xs">
                  Pre-configured templates for common scenarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px] w-full">
                  <div className="space-y-2">
                    {templatesHook.builtInTemplates.map((template) => (
                      <Card key={template.id} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{template.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadTemplate(template)}
                            className="text-xs ml-2"
                          >
                            Use Template
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Custom Templates */}
            {templatesHook.customTemplates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Custom Templates</CardTitle>
                  <CardDescription className="text-xs">
                    Your saved custom templates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px] w-full">
                    <div className="space-y-2">
                      {templatesHook.customTemplates.map((template) => (
                        <Card key={template.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm">{template.name}</h4>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {template.description}
                                </p>
                              )}
                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDate(template.createdAt)}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLoadTemplate(template)}
                                className="text-xs"
                              >
                                Use
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export Project</CardTitle>
                <CardDescription className="text-xs">
                  Export to file for backup or sharing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="export-name" className="text-xs">Project Name *</Label>
                  <Input
                    id="export-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Campaign"
                    className="text-xs"
                  />
                </div>
                
                <Button 
                  onClick={handleExportToFile}
                  disabled={!projectName.trim()}
                  className="w-full text-xs"
                  size="sm"
                >
                  <Download className="w-3 h-3 mr-2" />
                  Export to File (.mhsession)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import Project</CardTitle>
                <CardDescription className="text-xs">
                  Import from a .mhsession file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleImportFromFile}
                  disabled={loading}
                  className="w-full text-xs"
                  variant="outline"
                  size="sm"
                >
                  <Upload className="w-3 h-3 mr-2" />
                  Select File to Import
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mhsession,.json"
                  onChange={handleFileSelected}
                  style={{ display: 'none' }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Load Confirmation Dialog */}
      <AlertDialog open={showLoadConfirm} onOpenChange={setShowLoadConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Load Project?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Loading this project will replace your current session. This action cannot be undone.
                {pendingLoadData && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="font-medium text-foreground mb-2">
                      {pendingLoadData.metadata.name}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Tokens: {pendingLoadData.tokens.length}</div>
                      <div>Maps: {pendingLoadData.maps.length}</div>
                      <div>Regions: {pendingLoadData.regions.length}</div>
                      <div>Groups: {pendingLoadData.groups.length}</div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLoad}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLoad}>
              Load Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Confirmation Dialog */}
      <AlertDialog open={showTemplateConfirm} onOpenChange={setShowTemplateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Apply Template?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Applying this template will replace your current role and vision profile configurations. Maps, tokens, and regions will be preserved.
                {pendingTemplate && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="font-medium text-foreground mb-2">
                      {pendingTemplate.name}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {pendingTemplate.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Roles: {pendingTemplate.roles.length}</div>
                      <div>Vision Profiles: {pendingTemplate.visionProfiles.length}</div>
                      <div>Maps: {pendingTemplate.maps.length}</div>
                      <div>Regions: {pendingTemplate.regions.length}</div>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelTemplateLoad}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTemplateLoad}>
              Apply Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Session History Modal */}
      <SessionHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        versions={historyHook.history?.versions || []}
        onRestore={handleRestoreVersion}
        onDelete={handleDeleteVersion}
        onCompare={historyHook.compare}
      />
    </div>
  );
};
