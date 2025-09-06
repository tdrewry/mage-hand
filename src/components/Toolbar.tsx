import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Share2, Settings, Users, Map } from 'lucide-react';

interface ToolbarProps {
  sessionId: string;
}

export const Toolbar = ({ sessionId }: ToolbarProps) => {
  const shareSession = () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    navigator.clipboard.writeText(url);
    // Toast handled by parent component
  };

  return (
    <div className="bg-card border-b border-border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Map className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">D20PRO Virtual Tabletop</h1>
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Session: {sessionId.slice(0, 8)}
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
            variant="outline" 
            size="sm"
            className="text-foreground border-border hover:bg-secondary"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};