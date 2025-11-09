import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Share2, Settings, Users, Map, Trash2, Castle, Palette } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSessionStore } from '../stores/sessionStore';
import { useRegionStore } from '../stores/regionStore';
import { useDungeonStore } from '../stores/dungeonStore';
import { WATABOU_STYLES } from '../lib/watabouStyles';
import { toast } from 'sonner';

interface ToolbarProps {
  sessionId?: string;
}

export const Toolbar = ({ sessionId }: ToolbarProps) => {
  const { tokens } = useSessionStore();
  const { regions } = useRegionStore();
  const { renderingMode, setRenderingMode, setWatabouStyle } = useDungeonStore();
  
  const toggleRenderingMode = () => {
    const newMode = renderingMode === 'edit' ? 'play' : 'edit';
    setRenderingMode(newMode);
    toast.success(`Switched to ${newMode === 'play' ? 'Play' : 'Edit'} mode`);
  };
  
  const selectStyle = (styleName: string) => {
    const style = WATABOU_STYLES[styleName];
    if (style) {
      setWatabouStyle(style);
      toast.success(`Applied "${styleName}" style`);
    }
  };
  
  const shareSession = () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    navigator.clipboard.writeText(url);
    toast.success('Session URL copied to clipboard!');
  };

  const clearStorage = () => {
    localStorage.clear();
    // Also clear the Zustand store
    const { getState } = useSessionStore;
    const state = getState();
    state.tokens.length = 0; // Clear tokens array
    toast.success('Storage and tokens cleared! Reload page to start fresh.');
    setTimeout(() => window.location.reload(), 1000);
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
          
          {renderingMode === 'play' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-foreground border-border hover:bg-secondary"
                  title="Select map style"
                >
                  <Palette className="h-4 w-4 mr-2" />
                  Style
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                {Object.keys(WATABOU_STYLES).map((styleName) => (
                  <DropdownMenuItem key={styleName} onClick={() => selectStyle(styleName)}>
                    {styleName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Button 
            variant="outline" 
            size="sm"
            className="text-foreground border-border hover:bg-secondary"
          >
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearStorage}
            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            title="Clear storage if experiencing issues"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};