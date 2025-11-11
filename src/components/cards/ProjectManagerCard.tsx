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
import { useAutoSave } from '../../hooks/useAutoSave';

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
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [pendingLoadData, setPendingLoadData] = useState<ProjectData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save hook
  const autoSave = useAutoSave();
  const [timeSinceLastSave, setTimeSinceLastSave] = useState('Never');

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
      enabled: fogStore.enabled,
      revealAll: fogStore.revealAll,
      visionRange: fogStore.visionRange,
      fogOpacity: fogStore.fogOpacity,
      exploredOpacity: fogStore.exploredOpacity,
      showExploredAreas: fogStore.showExploredAreas,
      serializedExploredAreas: fogStore.serializedExploredAreas,
      fogVersion: fogStore.fogVersion,
      useGradients: fogStore.useGradients,
      innerFadeStart: fogStore.innerFadeStart,
      midpointPosition: fogStore.midpointPosition,
      midpointOpacity: fogStore.midpointOpacity,
      outerFadeStart: fogStore.outerFadeStart,
    },
    lights: lightStore.lights,
    cardStates: cardStore.cards,
    dungeonData: {
      doors: dungeonStore.doors,
      annotations: dungeonStore.annotations,
      terrainFeatures: dungeonStore.terrainFeatures,
      watabouStyle: dungeonStore.watabouStyle,
      wallEdgeStyle: dungeonStore.wallEdgeStyle,
      wallThickness: dungeonStore.wallThickness,
      textureScale: dungeonStore.textureScale,
      lightDirection: dungeonStore.lightDirection,
      shadowDistance: dungeonStore.shadowDistance,
    },
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

  const handleExportToFile = () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    try {
      const projectData = createCurrentProjectData();
      exportProjectToFile(projectData, `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}.d20pro`);
      toast.success('Project exported successfully');
    } catch (error) {
      toast.error(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const applyProjectData = (projectData: ProjectData) => {
    // Clear existing tokens and add new ones
    const existingTokens = [...sessionStore.tokens];
    existingTokens.forEach(token => sessionStore.removeToken(token.id));
    (projectData.tokens || []).forEach(token => sessionStore.addToken(token));
    
    // Add/update players (addPlayer replaces if exists)
    (projectData.players || []).forEach(player => sessionStore.addPlayer(player));
    
    // Apply session settings
    sessionStore.setTokenVisibility(projectData.settings.tokenVisibility);
    sessionStore.setLabelVisibility(projectData.settings.labelVisibility);
    
    // Clear and add maps
    const existingMaps = [...mapStore.maps];
    existingMaps.forEach(map => mapStore.removeMap(map.id));
    (projectData.maps || []).forEach(map => {
      // Add map without regions first, then add regions separately
      const { regions, ...mapData } = map;
      mapStore.addMap({ ...mapData, regions: [] });
    });
    
    // Clear and add regions
    regionStore.clearRegions();
    (projectData.regions || []).forEach(region => regionStore.addRegion(region));
    
    // Clear and add groups
    groupStore.clearAllGroups();
    (projectData.groups || []).forEach(group => {
      const { name, tokenIds } = group;
      const newGroup = groupStore.addGroup(name, tokenIds);
      // Update the group with the full saved data
      groupStore.updateGroup(newGroup.id, {
        id: group.id, // Restore original ID
        transform: group.transform,
        pivot: group.pivot,
        bounds: group.bounds,
        locked: group.locked,
        visible: group.visible,
      });
    });
    
    // Apply initiative data
    if (projectData.initiative) {
      initiativeStore.endCombat(); // Clear first
      if (projectData.initiative.isInCombat) {
        projectData.initiative.initiativeOrder.forEach(entry => {
          initiativeStore.addToInitiative(entry.tokenId, entry.initiative);
        });
        initiativeStore.startCombat();
        // Set to correct turn
        for (let i = 0; i < projectData.initiative.currentTurnIndex; i++) {
          initiativeStore.nextTurn();
        }
      }
      initiativeStore.setRestrictMovement(projectData.initiative.restrictMovement);
    }
    
    // Apply roles
    if (projectData.roles) {
      const existingRoles = [...roleStore.roles];
      existingRoles.forEach(role => roleStore.removeRole(role.id));
      projectData.roles.forEach(role => roleStore.addRole(role));
    }
    
    // Apply vision profiles
    if (projectData.visionProfiles) {
      const existingProfiles = [...visionProfileStore.profiles];
      existingProfiles.forEach(profile => visionProfileStore.removeProfile(profile.id));
      projectData.visionProfiles.forEach(profile => visionProfileStore.addProfile(profile));
    }
    
    // Apply fog data
    if (projectData.fogData) {
      fogStore.setEnabled(projectData.fogData.enabled);
      fogStore.setRevealAll(projectData.fogData.revealAll);
      fogStore.setVisionRange(projectData.fogData.visionRange);
      fogStore.setFogOpacity(projectData.fogData.fogOpacity);
      fogStore.setExploredOpacity(projectData.fogData.exploredOpacity);
      fogStore.setShowExploredAreas(projectData.fogData.showExploredAreas);
      fogStore.setSerializedExploredAreas(projectData.fogData.serializedExploredAreas);
      if (projectData.fogData.useGradients !== undefined) {
        fogStore.setUseGradients(projectData.fogData.useGradients);
        fogStore.setInnerFadeStart(projectData.fogData.innerFadeStart);
        fogStore.setMidpointPosition(projectData.fogData.midpointPosition);
        fogStore.setMidpointOpacity(projectData.fogData.midpointOpacity);
        fogStore.setOuterFadeStart(projectData.fogData.outerFadeStart);
      }
    }
    
    // Apply lights
    if (projectData.lights) {
      lightStore.clearAllLights();
      projectData.lights.forEach(light => lightStore.addLight(light));
    }
    
    // Apply card states
    if (projectData.cardStates) {
      // Clear and re-register cards
      const existingCards = [...cardStore.cards];
      existingCards.forEach(card => cardStore.unregisterCard(card.id));
      projectData.cardStates.forEach(card => {
        const config = {
          type: card.type,
          title: '', // Will use default
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
    
    // Apply dungeon data if present
    if (projectData.dungeonData) {
      dungeonStore.clearAll();
      if (projectData.dungeonData.doors) {
        dungeonStore.setDoors(projectData.dungeonData.doors);
      }
      if (projectData.dungeonData.annotations) {
        dungeonStore.setAnnotations(projectData.dungeonData.annotations);
      }
      if (projectData.dungeonData.terrainFeatures) {
        dungeonStore.setTerrainFeatures(projectData.dungeonData.terrainFeatures);
      }
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
    }
    
    toast.success(`Project "${projectData.metadata.name}" loaded successfully`);
  };

  const handleLoadFromStorage = async (projectId: string) => {
    setLoading(true);
    try {
      const projectData = loadProjectFromStorage(projectId);
      
      if (!projectData) {
        toast.error('Project not found');
        setLoading(false);
        return;
      }

      // Show confirmation dialog
      setPendingLoadData(projectData);
      setShowLoadConfirm(true);
      
    } catch (error) {
      toast.error(`Failed to load project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmLoad = () => {
    if (pendingLoadData) {
      applyProjectData(pendingLoadData);
      setPendingLoadData(null);
    }
    setShowLoadConfirm(false);
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

    setLoading(true);
    try {
      const projectData = await importProjectFromFile(file);
      
      // Show confirmation dialog before applying
      setPendingLoadData(projectData);
      setShowLoadConfirm(true);
      
    } catch (error) {
      toast.error(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
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
    <div className="overflow-y-auto max-h-[calc(100vh-200px)] p-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="save" className="flex items-center gap-2 text-xs">
            <Save className="w-3 h-3" />
            Save
          </TabsTrigger>
          <TabsTrigger value="load" className="flex items-center gap-2 text-xs">
            <Upload className="w-3 h-3" />
            Load
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
                  Export to File (.d20pro)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import Project</CardTitle>
                <CardDescription className="text-xs">
                  Import from a .d20pro file
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
                  accept=".d20pro,.json"
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
            <AlertDialogDescription>
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
    </div>
  );
};
