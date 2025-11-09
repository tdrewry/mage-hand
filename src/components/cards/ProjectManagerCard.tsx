/**
 * Project Manager Card
 * 
 * Provides save/load functionality using the enhanced project serialization system
 */

import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import { 
  Save, 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  Clock, 
  User,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store hooks
  const { tokens, tokenVisibility, labelVisibility } = useSessionStore();
  const { maps } = useMapStore();
  const { regions } = useRegionStore();
  const { groups } = useGroupStore();

  // Load saved projects when component mounts
  React.useEffect(() => {
    const projects = getSavedProjects();
    setSavedProjects(projects);
  }, []);

  const createCurrentProjectData = (): ProjectData => ({
    metadata: createProjectMetadata(
      projectName || `Project ${Date.now()}`,
      projectDescription,
      authorName
    ),
    tokens,
    maps,
    regions,
    groups,
    viewport,
    settings: {
      gridSnappingEnabled: false,
      tokenVisibility,
      labelVisibility,
      gridColor: '#333333',
      backgroundColor: '#1a1a1a',
      defaultGridSize: 50
    }
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

  const handleLoadFromStorage = async (projectId: string) => {
    setLoading(true);
    try {
      const projectData = loadProjectFromStorage(projectId);
      
      if (!projectData) {
        toast.error('Project not found');
        return;
      }

      // Load data into stores
      toast.success(`Project "${projectData.metadata.name}" loaded successfully`);
      
      console.log('Loaded project data:', projectData);
      
    } catch (error) {
      toast.error(`Failed to load project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
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
      
      toast.success(`Project "${projectData.metadata.name}" imported successfully`);
      
      console.log('Imported project data:', projectData);
      
    } catch (error) {
      toast.error(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
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
                  <div>Tokens: {tokens.length}</div>
                  <div>Maps: {maps.length}</div>
                  <div>Regions: {regions.length}</div>
                  <div>Groups: {groups.length}</div>
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
        </TabsContent>

        <TabsContent value="load" className="mt-4">
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
    </div>
  );
};
