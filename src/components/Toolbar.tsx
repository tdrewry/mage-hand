import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Share2, Users, Map, Trash2, Castle, Save, FolderOpen } from 'lucide-react';
import { MapControlsModal } from './modals/MapControlsModal';
import { Canvas as FabricCanvas } from 'fabric';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSessionStore } from '../stores/sessionStore';
import { useRegionStore } from '../stores/regionStore';
import { useDungeonStore } from '../stores/dungeonStore';
import { toast } from 'sonner';

interface ToolbarProps {
  sessionId?: string;
  fabricCanvas?: FabricCanvas | null;
}

export const Toolbar = ({ sessionId, fabricCanvas }: ToolbarProps) => {
  const { tokens } = useSessionStore();
  const { regions } = useRegionStore();
  const { renderingMode, setRenderingMode } = useDungeonStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mapControlsOpen, setMapControlsOpen] = useState(false);
  
  const toggleRenderingMode = () => {
    const newMode = renderingMode === 'edit' ? 'play' : 'edit';
    setRenderingMode(newMode);
    toast.success(`Switched to ${newMode === 'play' ? 'Play' : 'Edit'} mode`);
  };
  
  const shareSession = () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    navigator.clipboard.writeText(url);
    toast.success('Session URL copied to clipboard!');
  };

  const clearStorage = () => {
    setDeleteDialogOpen(false);
    localStorage.clear();
    // Also clear the Zustand store
    const { getState } = useSessionStore;
    const state = getState();
    state.tokens.length = 0; // Clear tokens array
    toast.success('Storage and tokens cleared! Reload page to start fresh.');
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    toast.info('Save functionality coming soon');
  };

  const handleLoad = () => {
    // TODO: Implement load functionality
    toast.info('Load functionality coming soon');
  };

  return (
    <div className="bg-card/95 backdrop-blur-sm border-b border-border p-3 relative z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Map className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">D20PRO Virtual Tabletop</h1>
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Session: {sessionId?.slice(0, 8) || 'paper-demo'}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Tokens: {tokens.length}
              {tokens.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (actual count)
                </span>
              )}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Regions: {regions.length}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={shareSession}
            className="text-foreground border-border hover:bg-secondary"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Session
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            className="text-foreground border-border hover:bg-secondary"
          >
            <Users className="h-4 w-4 mr-2" />
            Players (1)
          </Button>
          
          <Button 
            variant={renderingMode === 'play' ? 'default' : 'outline'}
            size="sm"
            onClick={toggleRenderingMode}
            className={renderingMode === 'play' ? '' : 'text-foreground border-border hover:bg-secondary'}
            title="Toggle between Edit and Play mode"
          >
            <Castle className="h-4 w-4 mr-2" />
            {renderingMode === 'play' ? 'Play Mode' : 'Edit Mode'}
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Save Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSave}
            className="text-foreground border-border hover:bg-secondary"
            title="Save project"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>

          {/* Load Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLoad}
            className="text-foreground border-border hover:bg-secondary"
            title="Load project"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Load
          </Button>

          <Separator orientation="vertical" className="h-6" />
          
          {/* Delete Button with confirmation */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            title="Clear all data"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setMapControlsOpen(true)}
            className="text-foreground border-border hover:bg-secondary"
          >
            <Map className="h-4 w-4 mr-2" />
            Map Controls
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all tokens, 
              regions, maps, and settings from your local storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={clearStorage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Map Controls Modal */}
      <MapControlsModal
        open={mapControlsOpen}
        onOpenChange={setMapControlsOpen}
        fabricCanvas={fabricCanvas || null}
      />
    </div>
  );
};