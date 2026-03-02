import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Map as MapIcon } from 'lucide-react';
import { MapManagerCardContent } from './cards/MapManagerCard';

interface MapManagerProps {
  onClose: () => void;
}

/**
 * Standalone floating Map Manager panel.
 * Delegates all logic to MapManagerCardContent.
 */
export const MapManager: React.FC<MapManagerProps> = ({ onClose }) => {
  return (
    <div className="fixed top-4 right-4 w-96 max-h-[calc(100vh-2rem)] z-50">
      <Card className="bg-background/95 backdrop-blur-sm border shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5" />
              Map Manager
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MapManagerCardContent />
        </CardContent>
      </Card>
    </div>
  );
};
