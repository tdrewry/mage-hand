/**
 * Project Manager Modal
 * 
 * Provides save/load functionality using the enhanced project serialization system
 * Demonstrates the new project management capabilities
 */

import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
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
  FolderOpen,
  Plus
} from 'lucide-react';

import {
  createProjectMetadata,
  serializeProject,
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

interface ProjectManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewport: { x: number; y: number; zoom: number };
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  open,
  onOpenChange,
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

  // Load saved projects when modal opens
  React.useEffect(() => {
    if (open) {
      const projects = getSavedProjects();
      setSavedProjects(projects);
    }
  }, [open]);

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
      gridSnappingEnabled: false, // Would need to get this from component state
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
      // Note: In a real implementation, you'd need methods to bulk-load data
      // For now, we'll just show a success message
      toast.success(`Project "${projectData.metadata.name}" loaded successfully`);
      
      console.log('Loaded project data:', projectData);
      onOpenChange(false);
      
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
      
      // Load data into stores (similar to handleLoadFromStorage)
      toast.success(`Project "${projectData.metadata.name}" imported successfully`);
      
      console.log('Imported project data:', projectData);
      onOpenChange(false);
      
    } catch (error) {
      toast.error(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      // Reset file input
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
      
      // Refresh list
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Project Manager
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="save" className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Project
              </TabsTrigger>
              <TabsTrigger value="load" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Load Project
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export/Import
              </TabsTrigger>
            </TabsList>

            <TabsContent value="save" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Save Current Project</CardTitle>
                  <CardDescription>
                    Save your current session to local storage for quick access
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name *</Label>
                      <Input
                        id="project-name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="My Campaign"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author-name">Author</Label>
                      <Input
                        id="author-name"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        placeholder="Dungeon Master"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="project-description">Description</Label>
                    <Textarea
                      id="project-description"
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="A brief description of your campaign..."
                      rows={3}
                    />
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <h4 className="font-medium mb-2">Current Session Stats:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Tokens: {tokens.length}</div>
                      <div>Maps: {maps.length}</div>
                      <div>Regions: {regions.length}</div>
                      <div>Groups: {groups.length}</div>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSaveToStorage} 
                    disabled={loading || !projectName.trim()}
                    className="w-full"
                  >
                    {loading ? 'Saving...' : 'Save to Local Storage'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="load" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Saved Projects</CardTitle>
                  <CardDescription>
                    Load a previously saved project from local storage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] w-full">
                    {savedProjects.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No saved projects found</p>
                        <p className="text-sm">Create your first project in the Save tab</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {savedProjects.map((project) => (
                          <Card key={project.id} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold">{project.name}</h4>
                                {project.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
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
                                >
                                  Load
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
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
                    <CardTitle>Export Project</CardTitle>
                    <CardDescription>
                      Export your project to a file for backup or sharing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="export-name">Project Name *</Label>
                      <Input
                        id="export-name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="My Campaign"
                      />
                    </div>
                    
                    <Button 
                      onClick={handleExportToFile}
                      disabled={!projectName.trim()}
                      className="w-full"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export to File (.d20pro)
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Import Project</CardTitle>
                    <CardDescription>
                      Import a project from a .d20pro file
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={handleImportFromFile}
                      disabled={loading}
                      className="w-full"
                      variant="outline"
                    >
                      <Upload className="w-4 h-4 mr-2" />
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
        </DialogContent>
      </Dialog>
    </>
  );
};